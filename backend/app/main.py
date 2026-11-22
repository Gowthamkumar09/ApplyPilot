import csv
import io
import logging
import re
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import llm, parsing, scoring
from .auth import require_auth, router as auth_router
from .config import settings
from .db import Application, AuditLog, Document, Job, Profile, Resume, SessionLocal, get_db, init_db
from .jobs import PROVIDERS, dedupe_key, flags_for
from .matching import match

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("applypilot")

STATUSES = ["discovered", "shortlisted", "application_prepared", "awaiting_approval", "submission_in_progress",
            "submitted_confirmed", "submission_failed", "interview", "assessment", "offer", "rejected", "withdrawn"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="ApplyPilot AI", version="0.2.0", lifespan=lifespan, dependencies=[Depends(require_auth)])
app.include_router(auth_router)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins.split(","), allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True}


def get_profile(db: Session) -> Profile:
    p = db.get(Profile, 1)
    if not p:
        p = Profile(id=1)
        db.add(p); db.commit()
    return p


def audit(db: Session, action: str, **detail):
    db.add(AuditLog(action=action, detail=detail)); db.commit()
    log.info("audit %s %s", action, detail)


def profile_dict(p: Profile):
    return {c: getattr(p, c) for c in ["name", "email", "phone", "education", "skills", "projects", "experience",
            "certifications", "preferred_roles", "preferred_locations", "remote_ok", "experience_years"]}


def job_dict(j: Job, p: Profile | None = None):
    d = {c: getattr(j, c) for c in ["id", "source", "title", "company", "location", "remote", "job_type",
         "experience_min", "required_skills", "preferred_skills", "salary", "description", "url", "deadline",
         "apply_method", "automation_eligible", "is_demo"]}
    d["discovered_at"] = j.discovered_at.isoformat()
    d["last_verified_at"] = j.last_verified_at.isoformat() if j.last_verified_at else None
    d["posted_at"] = j.posted_at.isoformat() if j.posted_at else None
    d["flags"] = flags_for(f"{j.title} {j.description}")
    if p is not None:
        d["match"] = match(p, j)
    return d


# ---------- profile & resume ----------
class ProfileIn(BaseModel):
    name: str = Field("", max_length=200)
    email: str = Field("", max_length=200)
    phone: str = Field("", max_length=50)
    education: list[str] = []
    skills: list[str] = []
    projects: list[str] = []
    experience: list[str] = []
    certifications: list[str] = []
    preferred_roles: list[str] = []
    preferred_locations: list[str] = []
    remote_ok: bool = True
    experience_years: float = Field(0, ge=0, le=60)


@app.get("/api/profile")
def read_profile(db: Session = Depends(get_db)):
    return profile_dict(get_profile(db))


@app.put("/api/profile")
def update_profile(body: ProfileIn, db: Session = Depends(get_db)):
    p = get_profile(db)
    for k, v in body.model_dump().items():
        setattr(p, k, [s.strip() for s in v if s.strip()] if isinstance(v, list) else v)
    db.commit()
    return profile_dict(p)


@app.post("/api/resume")
async def upload_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read()
    ext = parsing.validate_upload(file.filename or "", data, settings.max_upload_mb)
    text = parsing.extract_text(ext, data)
    parsed = parsing.parse_resume(text)
    analysis = scoring.analyze(parsed, text)
    analysis["method"] = "rule_based"
    ai_error = ""
    if llm.available():
        try:
            analysis = llm.analyze_resume(text)
            ex = analysis["extracted"]
            for k in ["skills", "education", "projects", "experience", "certifications"]:
                if ex.get(k):
                    parsed[k] = [str(x)[:300] for x in ex[k]][:30]
            parsed["suggested_roles"] = ex.get("suggested_roles", [])[:5]
        except Exception as e:
            log.error("AI analysis failed, using rule-based: %s", e)
            ai_error = "AI analysis failed, so the basic rule-based score is shown. Check your API key and try again."
    else:
        ai_error = "No LLM_API_KEY set, so the basic rule-based score is shown."
    analysis["notice"] = ai_error
    db.query(Resume).delete()  # one active CV; replacing removes the old text
    db.add(Resume(filename=re.sub(r"[^\w.\- ]", "_", file.filename or "cv")[:200], text=text, analysis=analysis))
    p = get_profile(db)
    for k in ["name", "email", "phone"]:
        setattr(p, k, parsed[k])
    for k in ["education", "skills", "projects", "experience", "certifications"]:
        setattr(p, k, parsed[k])
    if parsed.get("suggested_roles") and not p.preferred_roles:
        p.preferred_roles = parsed["suggested_roles"]
    db.commit()
    audit(db, "resume_uploaded", filename=file.filename)
    return {"analysis": analysis, "profile": profile_dict(p)}


@app.get("/api/resume")
def read_resume(db: Session = Depends(get_db)):
    r = db.scalars(select(Resume)).first()
    return {"filename": r.filename, "analysis": r.analysis, "uploaded_at": r.uploaded_at.isoformat()} if r else None


@app.delete("/api/resume")
def delete_resume(db: Session = Depends(get_db)):
    db.query(Resume).delete(); db.commit()
    audit(db, "resume_deleted")
    return {"deleted": True}


@app.delete("/api/account-data")
def delete_all(db: Session = Depends(get_db)):
    for m in (Application, Resume, Profile):
        db.query(m).delete()
    db.commit()
    audit(db, "account_data_deleted")
    return {"deleted": True}


# ---------- jobs ----------
@app.post("/api/jobs/refresh")
def refresh_jobs(db: Session = Depends(get_db)):
    added = 0
    for prov in [PROVIDERS['demo']]:
        try:
            for raw in prov.fetch([]):
                key = dedupe_key(raw["title"], raw["company"], raw["location"])
                if db.scalar(select(Job).where(Job.dedupe_key == key)):
                    continue
                db.add(Job(dedupe_key=key, is_demo=prov.is_demo, **raw)); added += 1
        except Exception as e:  # one failing source must not break the others
            log.error("provider %s failed: %s", prov.name, e)
    db.commit()
    return {"added": added}


@app.post("/api/jobs/discover")
def discover_jobs(db: Session = Depends(get_db)):
    """Fetch real listings from configured sources, based on the profile. Never bypasses source rules."""
    p = get_profile(db)
    queries = list(p.preferred_roles[:3]) or [s for s in p.skills[:3]]
    if not queries:
        raise HTTPException(422, "Upload your resume or add preferred roles first, so I know what to search for.")
    added, errors, used, suspicious, stale = 0, {}, [], 0, 0
    for name, prov in PROVIDERS.items():
        if prov.is_demo:
            continue
        if not prov.configured():
            if prov.setup_hint:
                errors[name] = prov.setup_hint
            continue
        try:
            raws = prov.fetch(queries)
        except Exception as e:
            log.error("provider %s failed: %s", name, type(e).__name__)
            errors[name] = "Could not fetch jobs right now. Try again later."
            continue
        used.append(name)
        for raw in raws:
            if any(f["level"] == "danger" for f in flags_for(f"{raw['title']} {raw['description']}")):
                suspicious += 1; continue
            pa = raw.get("posted_at")
            if pa and (datetime.now(timezone.utc) - pa).days > settings.max_job_age_days:
                stale += 1; continue
            key = dedupe_key(raw["title"], raw["company"], raw["location"])
            if db.scalar(select(Job).where(Job.dedupe_key == key)):
                continue
            db.add(Job(dedupe_key=key, is_demo=False, last_verified_at=datetime.now(timezone.utc), **raw)); added += 1
        db.commit()
    if db.scalar(select(func.count()).select_from(Job).where(Job.is_demo.is_(False))):
        db.query(Job).filter(Job.is_demo.is_(True), Job.id.not_in(select(Application.job_id))).delete(synchronize_session=False)
        db.commit()
    audit(db, "jobs_discovered", added=added, sources=used)
    return {"added": added, "sources_used": used, "errors": errors, "queries": queries,
            "skipped_suspicious": suspicious, "skipped_old": stale}


@app.get("/api/jobs")
def list_jobs(q: str = "", location: str = "", remote: bool | None = None, job_type: str = "", source: str = "",
              min_score: int = 0, max_experience: float | None = None, sort: str = "match",
              db: Session = Depends(get_db)):
    p = get_profile(db)
    out = []
    for j in db.scalars(select(Job)).all():
        if q and q.lower() not in f"{j.title} {j.company} {j.description}".lower(): continue
        if location and location.lower() not in j.location.lower(): continue
        if remote is not None and j.remote != remote: continue
        if job_type and j.job_type != job_type: continue
        if source and j.source != source: continue
        if max_experience is not None and j.experience_min > max_experience: continue
        d = job_dict(j, p)
        if d["match"]["score"] < min_score: continue
        out.append(d)
    out.sort(key=(lambda d: -d["match"]["score"]) if sort == "match" else (lambda d: d["title"]))
    return out


@app.get("/api/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j: raise HTTPException(404, "Job not found.")
    return job_dict(j, get_profile(db))


# ---------- applications ----------
class AppIn(BaseModel):
    job_id: int


class AppPatch(BaseModel):
    status: str | None = None
    notes: str | None = Field(None, max_length=4000)


def app_dict(a: Application, j: Job, cover: str = ""):
    return {"cover_letter": cover, "id": a.id, "job_id": a.job_id, "status": a.status, "confirmation_source": a.confirmation_source,
            "notes": a.notes, "error": a.error, "created_at": a.created_at.isoformat(),
            "updated_at": a.updated_at.isoformat(), "title": j.title, "company": j.company, "source": j.source,
            "url": j.url, "is_demo": j.is_demo}


@app.post("/api/applications", status_code=201)
def create_application(body: AppIn, db: Session = Depends(get_db)):
    j = db.get(Job, body.job_id)
    if not j: raise HTTPException(404, "Job not found.")
    if db.scalar(select(Application).where(Application.job_id == j.id)):
        raise HTTPException(409, "You already track this job.")
    a = Application(job_id=j.id, status="shortlisted")
    db.add(a); db.commit()
    audit(db, "application_created", job_id=j.id)
    return app_dict(a, j)


class PrepareIn(BaseModel):
    min_score: int = Field(60, ge=0, le=100)
    limit: int = Field(10, ge=1, le=200)
    per_source_daily: int = Field(15, ge=1, le=50)


@app.post("/api/applications/prepare")
def prepare_batch(body: PrepareIn, db: Session = Depends(get_db)):
    """Prepare (never submit) applications for the best-matching jobs not already tracked."""
    p = get_profile(db)
    if not p.skills:
        raise HTTPException(422, "Upload your resume first so jobs can be matched.")
    tracked = set(db.scalars(select(Application.job_id)))
    ranked = sorted(((match(p, j)["score"], j) for j in db.scalars(select(Job)).all() if j.id not in tracked),
                    key=lambda t: -t[0])
    today = datetime.now(timezone.utc).date()
    used: dict[str, int] = {}
    for a, j in db.execute(select(Application, Job).join(Job, Job.id == Application.job_id)).all():
        if a.created_at.date() == today:
            used[j.source] = used.get(j.source, 0) + 1
    chosen = []
    for sc, j in ranked:
        if sc < body.min_score or used.get(j.source, 0) >= body.per_source_daily:
            continue
        chosen.append((sc, j)); used[j.source] = used.get(j.source, 0) + 1
        if len(chosen) >= body.limit:
            break
    pdict = profile_dict(p)
    prepared, ai_used = [], 0
    for score, j in chosen:
        jd = {"title": j.title, "company": j.company, "required_skills": j.required_skills,
              "preferred_skills": j.preferred_skills, "description": j.description}
        by, text = "template", ""
        if llm.available():
            try:
                text, by = llm.cover_letter(pdict, jd), "ai"; ai_used += 1
            except Exception as e:
                log.error("cover letter failed for job %s: %s", j.id, e)
        if not text:
            text = llm.template_letter(pdict, jd)
        a = Application(job_id=j.id, status="application_prepared")
        db.add(a); db.flush()
        db.add(Document(application_id=a.id, kind="cover_letter", content=text, generated_by=by))
        prepared.append({"title": j.title, "company": j.company, "score": score})
    db.commit()
    audit(db, "applications_prepared", count=len(prepared), min_score=body.min_score)
    return {"prepared": len(prepared), "ai_letters": ai_used, "items": prepared,
            "skipped_below_threshold": sum(1 for s, _ in ranked if s < body.min_score)}


@app.get("/api/applications")
def list_applications(status: str = "", q: str = "", db: Session = Depends(get_db)):
    rows = db.execute(select(Application, Job).join(Job, Job.id == Application.job_id)
                      .order_by(Application.updated_at.desc())).all()
    covers = {d.application_id: d.content for d in db.scalars(select(Document).where(Document.kind == "cover_letter"))}
    return [app_dict(a, j, covers.get(a.id, "")) for a, j in rows
            if (not status or a.status == status) and (not q or q.lower() in f"{j.title} {j.company}".lower())]


@app.patch("/api/applications/{app_id}")
def patch_application(app_id: int, body: AppPatch, db: Session = Depends(get_db)):
    a = db.get(Application, app_id)
    if not a: raise HTTPException(404, "Application not found.")
    j = db.get(Job, a.job_id)
    if body.status:
        if body.status not in STATUSES: raise HTTPException(422, f"Unknown status. Use one of: {', '.join(STATUSES)}")
        if body.status == "submitted_confirmed":
            if j.is_demo:
                raise HTTPException(422, "Demo jobs cannot be marked as submitted. They are sample data.")
            a.confirmation_source = "user_reported"  # no integration can confirm yet
        a.status = body.status
        audit(db, "status_changed", application_id=a.id, status=body.status)
    if body.notes is not None: a.notes = body.notes
    db.commit()
    return app_dict(a, j)


@app.delete("/api/applications/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db)):
    a = db.get(Application, app_id)
    if a: db.delete(a); db.commit()
    return {"deleted": True}


@app.get("/api/applications.csv")
def export_csv(db: Session = Depends(get_db)):
    rows = db.execute(select(Application, Job).join(Job, Job.id == Application.job_id)).all()
    buf = io.StringIO(); w = csv.writer(buf)
    w.writerow(["title", "company", "source", "status", "confirmation", "url", "notes", "updated_at"])
    for a, j in rows:
        # prefix risky leading chars to avoid spreadsheet formula injection
        safe = lambda s: ("'" + s) if s[:1] in "=+-@" else s
        w.writerow([safe(j.title), safe(j.company), j.source, a.status, a.confirmation_source, j.url, safe(a.notes), a.updated_at.isoformat()])
    buf.seek(0)
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=applications.csv"})


# ---------- dashboard ----------
@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    p = get_profile(db)
    r = db.scalars(select(Resume)).first()
    jobs = db.scalars(select(Job)).all()
    counts = dict(db.execute(select(Application.status, func.count()).group_by(Application.status)).all())
    matching = sum(1 for j in jobs if match(p, j)["score"] >= 60) if r else 0
    recent = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(8)).all()
    return {"resume_score": r.analysis["score"] if r else None, "jobs_discovered": len(jobs),
            "demo_jobs_only": all(j.is_demo for j in jobs) if jobs else False, "jobs_matching": matching,
            "prepared": counts.get("application_prepared", 0), "awaiting_approval": counts.get("awaiting_approval", 0),
            "confirmed": counts.get("submitted_confirmed", 0),
            "interviews_offers": counts.get("interview", 0) + counts.get("offer", 0),
            "tracked": sum(counts.values()),
            "recent": [{"action": a.action, "at": a.at.isoformat(), "detail": a.detail} for a in recent]}


# ---------- chat (rule-based tool router; no LLM in Milestone 1) ----------
class ChatIn(BaseModel):
    message: str = Field(..., max_length=2000)


@app.post("/api/chat")
def chat(body: ChatIn, db: Session = Depends(get_db)):
    m = body.message.lower()
    p = get_profile(db)
    r = db.scalars(select(Resume)).first()
    jobs = [job_dict(j, p) for j in db.scalars(select(Job)).all()]
    jobs.sort(key=lambda d: -d["match"]["score"])
    fmt = lambda d: f"- {d['title']} at {d['company']} ({d['location']}) — {d['match']['score']}% match"
    note = "\n\n(These are demo listings, not real openings.)" if jobs and all(j["is_demo"] for j in jobs) else ""

    if re.search(r"why .*(\d+)\s*%|why was|why is", m) and jobs:
        top = next((j for j in jobs if j["title"].lower() in m), jobs[0])
        mt = top["match"]
        return {"reply": f"{top['title']} at {top['company']}: {mt['score']}%.\nWhy it fits:\n" + "\n".join("- " + x for x in mt["reasons"]) +
                "\nGaps:\n" + ("\n".join("- " + x for x in mt["gaps"]) or "- none found")}
    if re.search(r"resume|cv", m) and re.search(r"wrong|improve|issue|score|fix|review", m):
        if not r: return {"reply": "Upload your CV on the Resume page first, then I can review it."}
        a = r.analysis
        return {"reply": f"Your score is {a['score']}/100 ({a['grade']}).\nIssues:\n" + ("\n".join("- " + i for i in a["issues"]) or "- none detected") +
                "\nNext steps:\n" + "\n".join("- " + i for i in a["recommendations"])}
    if re.search(r"submitted|my applications|tracked|status", m):
        rows = db.execute(select(Application, Job).join(Job, Job.id == Application.job_id)).all()
        sub = [(a, j) for a, j in rows if "submitted" in a.status] if "submitted" in m else rows
        return {"reply": "\n".join(f"- {j.title} at {j.company}: {a.status}" for a, j in sub) or "Nothing matches yet."}
    if re.search(r"learn|skill", m) and re.search(r"learn|qualif|better", m):
        mine = {s.lower() for s in p.skills}
        from collections import Counter
        c = Counter(s for j in jobs[:10] for s in j["required_skills"] if s not in mine)
        return {"reply": "Skills that appear most in listings you don't yet cover: " + (", ".join(k for k, _ in c.most_common(5)) or "none")}
    if re.search(r"find|search|apply|jobs|internship|remote|today|highest", m):
        pool = jobs
        if "intern" in m: pool = [j for j in pool if j["job_type"] == "internship"]
        if "remote" in m: pool = [j for j in pool if j["remote"]]
        for kw in ["ai", "machine learning", "data", "frontend", "backend", "nlp"]:
            if re.search(rf"\b{kw}\b", m): pool = [j for j in pool if kw in (j["title"] + " " + " ".join(j["required_skills"])).lower()] or pool
        if not pool: return {"reply": "No listings yet. Open Jobs and choose 'Load demo jobs'."}
        return {"reply": "Top matches:\n" + "\n".join(fmt(j) for j in pool[:5]) + note +
                "\n\nI can't submit applications for you yet. Shortlist jobs on the Jobs page to track them."}
    return {"reply": "I can find jobs, explain a match score, review your resume, list your applications, or suggest skills to learn. Try: \"Find remote internships\"."}


# Serve the built frontend from the same server so only one process is needed.
from pathlib import Path  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="web")
