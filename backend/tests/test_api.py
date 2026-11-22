import io, os
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
import docx
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine

Base.metadata.drop_all(engine)
client = TestClient(app)
client.__enter__()

CV = """Asha Rao
asha@example.com
+91 98765 43210
Education
B.Tech Computer Science, 2025
Skills
Python, FastAPI, SQL, Git, Docker, Machine Learning, Pandas
Projects
Built a churn model with scikit-learn reaching 91% accuracy on 20000 rows
Worked on a React dashboard
Experience
Intern at Foo, built REST API serving 500 users
"""


def make_docx():
    d = docx.Document()
    for l in CV.splitlines(): d.add_paragraph(l)
    b = io.BytesIO(); d.save(b); return b.getvalue()


def test_rejects_bad_files():
    assert client.post("/api/resume", files={"file": ("a.exe", b"MZ", "application/octet-stream")}).status_code == 400
    assert client.post("/api/resume", files={"file": ("a.pdf", b"notpdf", "application/pdf")}).status_code == 400


def test_upload_scores_and_fills_profile():
    r = client.post("/api/resume", files={"file": ("cv.docx", make_docx(), "application/octet-stream")})
    assert r.status_code == 200, r.text
    a = r.json()["analysis"]
    assert 0 <= a["score"] <= 100 and a["methodology"]
    assert "python" in client.get("/api/profile").json()["skills"]


def test_jobs_dedupe_and_match():
    assert client.post("/api/jobs/refresh").json()["added"] == 10
    assert client.post("/api/jobs/refresh").json()["added"] == 0
    jobs = client.get("/api/jobs").json()
    assert jobs[0]["match"]["score"] >= jobs[-1]["match"]["score"] and jobs[0]["is_demo"]


def test_tracker_no_duplicates_and_no_fake_submission():
    jid = client.get("/api/jobs").json()[0]["id"]
    a = client.post("/api/applications", json={"job_id": jid})
    assert a.status_code == 201
    assert client.post("/api/applications", json={"job_id": jid}).status_code == 409
    bad = client.patch(f"/api/applications/{a.json()['id']}", json={"status": "submitted_confirmed"})
    assert bad.status_code == 422  # demo job cannot be "submitted"
    assert client.get("/api/applications.csv").status_code == 200


def test_chat_and_dashboard():
    assert "match" in client.post("/api/chat", json={"message": "Find AI internships"}).json()["reply"]
    d = client.get("/api/dashboard").json()
    assert d["tracked"] == 1 and d["confirmed"] == 0


def test_prepare_batch_never_submits_and_skips_tracked():
    client.put("/api/profile", json={**client.get("/api/profile").json(), "preferred_roles": ["intern", "developer"]})
    r = client.post("/api/applications/prepare", json={"min_score": 40, "limit": 3})
    assert r.status_code == 200, r.text
    assert 0 < r.json()["prepared"] <= 3
    apps = client.get("/api/applications").json()
    assert all(a["status"] != "submitted_confirmed" for a in apps)
    assert any(a["status"] == "application_prepared" and a["cover_letter"] for a in apps)
    again = client.post("/api/applications/prepare", json={"min_score": 40, "limit": 200}).json()
    assert again["prepared"] + len(apps) <= 10  # already-tracked jobs are not duplicated


def test_ai_analysis_validated_and_injection_text_ignored(monkeypatch):
    from app import llm
    monkeypatch.setattr(llm.settings, "llm_api_key", "test")
    monkeypatch.setattr(llm, "_call", lambda *a, **k: '''```json
{"score": 82, "ats_readability": "Good", "issues": [], "recommendations": ["x"], "extracted": {"skills": ["python"]}}
```''')
    cv = make_docx()
    r = client.post("/api/resume", files={"file": ("cv.docx", cv, "application/octet-stream")})
    assert r.json()["analysis"]["method"] == "ai" and r.json()["analysis"]["score"] == 82
    monkeypatch.setattr(llm, "_call", lambda *a, **k: '{"score": 9999}')  # invalid -> falls back
    r = client.post("/api/resume", files={"file": ("cv.docx", cv, "application/octet-stream")})
    assert r.json()["analysis"]["method"] == "rule_based" and r.json()["analysis"]["notice"]


def test_daily_cap_per_source():
    client.delete("/api/account-data")
    client.put("/api/profile", json={"skills": ["python"], "education": ["B.Tech"], "remote_ok": True})
    r = client.post("/api/applications/prepare", json={"min_score": 0, "limit": 200, "per_source_daily": 3}).json()
    assert r["prepared"] == 3  # all demo jobs share one source
    assert client.post("/api/applications/prepare", json={"min_score": 0, "limit": 200, "per_source_daily": 3}).json()["prepared"] == 0


class FakeResp:
    def __init__(self, data): self._d = data
    def raise_for_status(self): pass
    def json(self): return self._d


def test_real_job_discovery_dedupes_and_replaces_demo(monkeypatch):
    from app import jobs
    client.delete("/api/account-data"); client.post("/api/jobs/refresh")
    client.put("/api/profile", json={"skills": ["python"], "preferred_roles": ["python developer"], "education": ["B.Tech"]})
    monkeypatch.setattr(jobs.settings, "adzuna_app_id", "x"); monkeypatch.setattr(jobs.settings, "adzuna_app_key", "y")
    def fake_get(url, **kw):
        if "adzuna" in url:
            return FakeResp({"results": [{"id": 1, "title": "Python Developer", "company": {"display_name": "Acme"},
                "location": {"display_name": "Hyderabad"}, "description": "<p>Python and SQL, 2 years</p>",
                "redirect_url": "https://example.com/apply/1", "salary_min": 500000, "salary_max": 800000},
                {"id": 2, "title": "Bad Link", "company": {"display_name": "Evil"}, "location": {"display_name": "X"},
                 "description": "python", "redirect_url": "javascript:alert(1)"}]})
        return FakeResp({"jobs": [{"id": 9, "title": "Python Developer", "company_name": "Acme", "candidate_required_location": "Hyderabad",
                                   "description": "dup", "url": "https://remotive.com/x"}]})
    monkeypatch.setattr(jobs.httpx, "get", fake_get)
    r = client.post("/api/jobs/discover").json()
    assert r["added"] == 2 and not r["errors"]  # remotive duplicate of Acme job is dropped
    listing = client.get("/api/jobs").json()
    assert all(not j["is_demo"] for j in listing) and len(listing) == 2
    assert next(j for j in listing if j["company"] == "Evil")["url"] == ""  # unsafe URL removed
    assert next(j for j in listing if j["company"] == "Acme")["experience_min"] == 2


def test_scoring_is_strict():
    from types import SimpleNamespace as NS
    from app.matching import match
    me = NS(skills=["python", "sql"], experience_years=0, preferred_roles=["python developer"], preferred_locations=["Hyderabad"],
            remote_ok=True, education=["B.Tech"])
    def job(**kw):
        base = dict(title="Python Developer", required_skills=["python", "sql"], preferred_skills=[], experience_min=0,
                    location="Hyderabad", remote=False)
        return NS(**{**base, **kw})
    good = match(me, job())["score"]
    sales = match(me, job(title="Inside Sales Contractor", required_skills=[], location="Worldwide", remote=True))["score"]
    senior = match(me, job(title="Senior Python Developer", experience_min=5))["score"]
    locked = match(me, job(location="USA", remote=True))
    assert good >= 85 and sales <= 30 and senior <= 45 and locked["score"] <= 55
    assert any("limited to" in g for g in locked["gaps"])


def test_flags_and_auth(monkeypatch):
    from app.jobs import flags_for
    assert any(f["level"] == "danger" for f in flags_for("access may require payment to start"))
    assert any(f["level"] == "warn" for f in flags_for("100% commission based"))
    from app import auth
    monkeypatch.setattr(auth.settings, "app_password", "pw")
    c = TestClient(app)
    assert c.get("/api/health").status_code == 200
    assert c.get("/api/profile").status_code == 401
    assert c.post("/api/auth/login", json={"password": "bad"}).status_code == 401
    assert c.post("/api/auth/login", json={"password": "pw"}).status_code == 200
    assert c.get("/api/profile").status_code == 200
    auth._attempts.clear()
