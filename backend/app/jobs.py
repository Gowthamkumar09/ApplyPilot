"""Provider-adapter interface for job sources. Only the demo provider exists in Milestone 1."""
from abc import ABC, abstractmethod
import html
import logging
import re
from datetime import datetime, timezone

import httpx

from .config import settings
from .parsing import SKILL_VOCAB

log = logging.getLogger("applypilot.jobs")

_FLAG_RULES = [
    (r"may require payment|registration fee|pay (a |an )?(\w+ )?fee|purchase (a |your )?(kit|starter|equipment)|training fee|send (us )?money", "danger", "May ask you to pay. Avoid."),
    (r"commission[- ]only|100% commission", "warn", "Commission-only pay"),
    (r"per task|per word|per article|per 100 words|per completed task", "warn", "Paid per task or word, not a salary"),
    (r"\bunpaid\b", "warn", "Mentions unpaid work"),
    (r"independent contractor|\bfreelance\b", "info", "Contract or freelance, not employment"),
    (r"(resided|reside|live|lived) in the (united states|us|u\.s\.)|us citizens? only|must be (located|based) in the (us|united states|usa)", "warn", "Country restriction in the text"),
]


def flags_for(text: str) -> list[dict]:
    low = text.lower()
    return [{"level": lvl, "text": msg} for pat, lvl, msg in _FLAG_RULES if re.search(pat, low)]


def _csv(s: str) -> list[str]:
    return [x.strip() for x in s.split(",") if x.strip()]


def _parse_dt(v):
    if not v:
        return None
    try:
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(v / 1000, tz=timezone.utc)
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except (ValueError, OSError):
        return None


class JobProvider(ABC):
    name: str
    is_demo: bool = False
    setup_hint: str = ""  # shown to the user when the source is not configured; empty = stay silent

    def configured(self) -> bool:
        return True

    @abstractmethod
    def fetch(self, queries: list[str]) -> list[dict]:
        """Return normalised job dicts. Real providers must use official APIs or licensed feeds."""


def dedupe_key(title: str, company: str, location: str) -> str:
    norm = lambda s: re.sub(r"[^a-z0-9]+", "", s.lower())
    return f"{norm(title)}|{norm(company)}|{norm(location)}"


def _j(i, title, company, loc, remote, jtype, exp, req, pref, sal, desc):
    return dict(source="demo", source_job_id=f"demo-{i}", title=title, company=company, location=loc,
                remote=remote, job_type=jtype, experience_min=exp, required_skills=req, preferred_skills=pref,
                salary=sal, description=desc, url="", apply_method="manual_link", automation_eligible=False)


class DemoProvider(JobProvider):
    name = "demo"
    is_demo = True

    def fetch(self, queries=None):
        return [
            _j(1, "Machine Learning Intern", "Example Labs", "Bengaluru", False, "internship", 0, ["python", "machine learning", "pandas"], ["pytorch", "scikit-learn"], "₹25,000/mo", "Build and evaluate baseline models for a recommendation team."),
            _j(2, "Junior Backend Developer", "Sample Systems", "Hyderabad", False, "full-time", 0, ["python", "fastapi", "sql"], ["docker", "postgresql", "git"], "₹5-7 LPA", "Develop REST APIs and database schemas."),
            _j(3, "Frontend Developer (Fresher)", "Demo Studio", "Remote", True, "full-time", 0, ["javascript", "react", "html", "css"], ["typescript", "tailwind"], "₹4-6 LPA", "Build responsive React interfaces."),
            _j(4, "Data Analyst Intern", "Placeholder Analytics", "Pune", False, "internship", 0, ["sql", "excel", "data analysis"], ["power bi", "tableau", "python"], "₹15,000/mo", "Create dashboards and weekly reports."),
            _j(5, "AI Engineer", "Mock AI Co", "Remote", True, "full-time", 2, ["python", "deep learning", "pytorch", "nlp"], ["llm", "langchain", "docker"], "₹12-18 LPA", "Ship LLM-powered features to production."),
            _j(6, "Full Stack Developer", "Test Corp", "Vijayawada", False, "full-time", 1, ["react", "node.js", "mongodb"], ["typescript", "aws"], "₹6-9 LPA", "Own features end to end."),
            _j(7, "Computer Vision Intern", "Vision Demo", "Chennai", False, "internship", 0, ["python", "computer vision", "pytorch"], ["numpy"], "₹20,000/mo", "Work on object detection pipelines."),
            _j(8, "DevOps Engineer", "Infra Example", "Remote", True, "full-time", 3, ["docker", "kubernetes", "aws", "linux"], ["ci/cd"], "₹14-20 LPA", "Maintain CI/CD and cloud infrastructure."),
            _j(9, "Software Engineering Intern", "Sandbox Tech", "Visakhapatnam", False, "internship", 0, ["java", "git"], ["sql", "spring"], "₹18,000/mo", "Contribute to internal tools."),
            _j(10, "NLP Research Intern", "Demo Research", "Remote", True, "internship", 0, ["python", "nlp", "pytorch"], ["llm", "machine learning"], "₹30,000/mo", "Assist with text classification experiments."),
        ]


def _clean(t: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(t or ""))).strip()[:2500]


def _skills(text: str) -> list[str]:
    low = text.lower()
    return [s for s in SKILL_VOCAB if re.search(rf"(?<![\w+#]){re.escape(s)}(?![\w+#])", low)]


def _exp(text: str) -> float:
    m = re.search(r"(\d+)\s*\+?\s*(?:-\s*\d+\s*)?years?", text.lower())
    return float(m.group(1)) if m and float(m.group(1)) <= 15 else 0.0


def _safe_url(u: str) -> str:
    return u if re.match(r"https?://", u or "") else ""


def _build(source, sid, title, company, location, remote, desc, url, salary="", jtype=None, posted=None):
    title, company, desc = _clean(title)[:300], _clean(company)[:200], _clean(desc)
    skills = _skills(f"{title} {desc}")
    head = f"{title} {desc[:400]}".lower()
    req = [s for s in skills if s in head] or skills[:3]
    low = f"{title} {desc}".lower()
    return dict(source=source, source_job_id=str(sid), title=title, company=company, location=(location or "Not stated")[:200],
                remote=bool(remote) or "remote" in low[:300], job_type=jtype or ("internship" if "intern" in title.lower() else "full-time"),
                experience_min=_exp(desc), required_skills=req, preferred_skills=[s for s in skills if s not in req],
                salary=salary, description=desc, url=_safe_url(url), apply_method="external_link", automation_eligible=False,
                posted_at=_parse_dt(posted))


class AdzunaProvider(JobProvider):
    """Official Adzuna API (aggregates many job boards; requires a free key)."""
    name = "adzuna"
    setup_hint = "Not set up: add ADZUNA_APP_ID and ADZUNA_APP_KEY to backend/.env and restart."

    def configured(self):
        return bool(settings.adzuna_app_id and settings.adzuna_app_key)

    def fetch(self, queries):
        out = []
        for q in queries[:4]:
            r = httpx.get(f"https://api.adzuna.com/v1/api/jobs/{settings.adzuna_country}/search/1", timeout=20,
                          params={"app_id": settings.adzuna_app_id, "app_key": settings.adzuna_app_key,
                                  "results_per_page": 25, "what": q, "sort_by": "date", "max_days_old": 21})
            r.raise_for_status()
            for j in r.json().get("results", []):
                sal = f"{int(j['salary_min']):,}-{int(j.get('salary_max') or j['salary_min']):,} per year" if j.get("salary_min") else ""
                out.append(_build("adzuna", j.get("id"), j.get("title"), (j.get("company") or {}).get("display_name"),
                                  (j.get("location") or {}).get("display_name"), False, j.get("description"),
                                  j.get("redirect_url"), sal, posted=j.get("created")))
        return out


class RemotiveProvider(JobProvider):
    """Remotive public API (remote jobs; credit Remotive and link back to the listing)."""
    name = "remotive"

    def fetch(self, queries):
        out = []
        for q in queries[:3]:
            r = httpx.get("https://remotive.com/api/remote-jobs", params={"search": q, "limit": 25}, timeout=20)
            r.raise_for_status()
            for j in r.json().get("jobs", []):
                out.append(_build("remotive", j.get("id"), j.get("title"), j.get("company_name"),
                                  j.get("candidate_required_location") or "Remote", True, j.get("description"),
                                  j.get("url"), j.get("salary") or "", posted=j.get("publication_date")))
        return out


class GreenhouseProvider(JobProvider):
    """Public Greenhouse job-board feeds for companies listed in GREENHOUSE_BOARDS."""
    name = "greenhouse"

    def configured(self):
        return bool(_csv(settings.greenhouse_boards))

    def fetch(self, queries):
        words = {w for q in queries for w in q.lower().split() if len(w) > 2}
        out = []
        for board in _csv(settings.greenhouse_boards)[:20]:
            try:
                r = httpx.get(f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs", params={"content": "true"}, timeout=20)
                r.raise_for_status()
            except Exception as e:
                log.warning("greenhouse board %s failed: %s", board, type(e).__name__)
                continue
            n = 0
            for j in r.json().get("jobs", []):
                title = j.get("title") or ""
                if words and not any(w in title.lower() for w in words):
                    continue
                out.append(_build("greenhouse", j.get("id"), title, board.replace("-", " ").title(), (j.get("location") or {}).get("name"),
                                  False, j.get("content"), j.get("absolute_url"), posted=j.get("updated_at")))
                n += 1
                if n >= 30: break
        return out


class LeverProvider(JobProvider):
    """Public Lever postings feeds for companies listed in LEVER_COMPANIES."""
    name = "lever"

    def configured(self):
        return bool(_csv(settings.lever_companies))

    def fetch(self, queries):
        words = {w for q in queries for w in q.lower().split() if len(w) > 2}
        out = []
        for co in _csv(settings.lever_companies)[:20]:
            try:
                r = httpx.get(f"https://api.lever.co/v0/postings/{co}", params={"mode": "json"}, timeout=20)
                r.raise_for_status()
            except Exception as e:
                log.warning("lever company %s failed: %s", co, type(e).__name__)
                continue
            n = 0
            for j in r.json():
                title = j.get("text") or ""
                if words and not any(w in title.lower() for w in words):
                    continue
                cat = j.get("categories") or {}
                out.append(_build("lever", j.get("id"), title, co.replace("-", " ").title(), cat.get("location"), "remote" in (cat.get("location") or "").lower(),
                                  j.get("descriptionPlain"), j.get("hostedUrl"), posted=j.get("createdAt")))
                n += 1
                if n >= 30: break
        return out


PROVIDERS: dict[str, JobProvider] = {"demo": DemoProvider(), "adzuna": AdzunaProvider(), "remotive": RemotiveProvider(),
                                     "greenhouse": GreenhouseProvider(), "lever": LeverProvider()}
