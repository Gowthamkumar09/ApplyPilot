# ApplyPilot AI — Milestone 1 MVP

## Run it
```bash
# Backend (http://localhost:8000, docs at /docs)
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload

# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# Tests
cd backend && pytest -q
```

## What works (tested)
- PDF/DOCX upload with extension, magic-byte and size checks; text extraction; profile auto-fill and editing
- Rule-based resume score (6 transparent checks), issues, recommendations, before/after examples, stated limitations
- 10 **demo** jobs behind a provider-adapter interface (`backend/app/jobs.py`), deduplication, filters, per-job match score with reasons and gaps
- Application tracker: 12 statuses, one record per job (duplicates rejected), search/filter, CSV export (formula-injection safe), audit log
- Rule-based chat assistant that calls backend functions (jobs, match explanation, resume review, applications, skills gaps)
- Resume delete and full account-data delete

## What does NOT exist yet
- **No real job sources** (LinkedIn, Indeed, Internshala, Naukri need official APIs/partner access). Milestone 2.
- **No LLM**: analysis and chat are rule-based. `.env` LLM settings are placeholders.
- **No application submission or automation.** "Submitted and confirmed" is user-reported only; demo jobs cannot be marked submitted.
- No tailored resumes/cover letters (M3), no authentication (single local user), no Redis/queue, no migrations (tables auto-created; Alembic arrives with Postgres in M5). Scanned PDFs (OCR) unsupported.
- SQLite by default; PostgreSQL is supported via `DATABASE_URL` but untested.

## Update: AI analysis and prepare-applications
- Put `LLM_API_KEY=your_key` in `backend/.env` and restart the backend. Resume analysis and cover letters then use the AI model (`LLM_MODEL` optional). Without a key, the rule-based score and a template letter are used.
- The AI path is tested only with mocked model responses, not against the live API.
- "Prepare applications" drafts cover letters and tracks matching jobs. It never submits. Automatic submission to LinkedIn/Indeed/Naukri is deliberately not built.

## Update: real jobs
- Free Adzuna key (developer.adzuna.com) goes in `backend/.env` as `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`. Remotive needs no key.
- "Find real jobs for my resume" searches by your preferred roles (or top skills), dedupes, scores each job, and replaces untracked demo jobs.
- Provider code is tested with mocked responses only. It has NOT been run against the live Adzuna/Remotive APIs.

## Update: v0.2 (login, stricter matching, hosting)
- **Scoring:** irrelevant jobs capped at 30%, senior roles capped for low experience, region-locked remote jobs capped at 55%.
- **Warnings:** commission-only, per-task pay, country restrictions, freelance. Listings that ask for payment are skipped at discovery. Listings older than 45 days are skipped.
- **Extra sources (untested live):** Greenhouse and Lever public boards via `GREENHOUSE_BOARDS` / `LEVER_COMPANIES`.
- **Hosting:** `APP_PASSWORD` turns on a single-owner login (not multi-user accounts). `Dockerfile` + `render.yaml` are provided but have NOT been deployed or tested on Render or against PostgreSQL.
- Push the folder to a private GitHub repo, then in Render choose New > Blueprint, and set APP_PASSWORD. Your CV is stored in the hosted database, so use a strong password.

## Update: v0.5 (whole site in a 3D world)
- A full-screen WebGL world sits behind every page: one wireframe object per page on a ring. Changing page flies the camera to that page's object. Each page is a glass slab floating in that world: it tilts with the pointer, flips in on navigation and its cards sit on a depth layer. The sidebar is a floating angled dock. The **3D effects** switch restores the plain layout.
- Built and type-checked, NOT viewed in a browser by the author.

## Update: v0.4 (pro 3D pass)
- **Pipeline in 3D** (Overview): your six pipeline numbers as growing 3D columns. **Match map** (Jobs): every job as a planet, closer to the core = better match, hover for details, click to filter. **Skills sphere** (Profile): your skills on a rotating CSS-3D sphere. Cursor glare on tilt cards. A **3D effects** switch (sidebar) turns all WebGL/3D off and is remembered.
- Built and type-checked, NOT viewed in a browser by the author.

## Update: v0.3 (3D interface)
- WebGL globe with animated flight arcs on the login and overview screens (three.js, loaded on demand; falls back to a plain background if WebGL is unavailable). Pointer-tilt cards, 3D page transitions, rotating logo cube, floating gauges. All motion is disabled when the OS "reduce motion" setting is on.
- The 3D visuals were type-checked and built but NOT viewed in a browser by the author. Report anything that looks off.
- "Search on other platforms" links open LinkedIn, Naukri, Indeed, Internshala and Google Jobs searches in a new tab. These are plain links (no scraping or automation); the sites can change their URL formats.

## Update: v0.6 (dark redesign)
- New dark violet/cyan theme across every page (Tailwind palette in `frontend/tailwind.config.js`, plus `index.css`).
- Background is now a particle sphere of triangles (`World.tsx`, plain canvas, no WebGL): it turns and slides when you change page, and a few glowing points drift toward the core like your best matches.
- Jobs page: list rewritten as a single panel of rows (title, New badge, company/location/posted, salary and work-type pills, match gauge, Shortlist and View listing). A knowledge-universe style summary (total, strong, fair, weak, average match) sits above the match map.
- No "Apply All" button was added, on purpose: ApplyPilot still never submits applications.
- Edited without installing dependencies, so NOT type-checked, built or viewed in a browser. Run `cd frontend && npm install && npm run build` first. The old `frontend/dist` was removed because it was stale.

## Update: v0.7.2 (sphere hero with floating jobs; sphere was hidden behind the page background, now visible)
- Home is now a hero: headline on the left, a denser Dala-style particle sphere on the right with your 12 best-matching job names floating on it and turning with it. Other pages float over the sphere on a lighter glass panel.
- `start.bat` now rebuilds the frontend on every start. If the page looks unchanged, delete `frontend\dist` and run `npm run build` (the old build is served until you do).
- Still NOT type-checked or viewed in a browser by the author.

## Update: v0.8 (two background scenes)
- Home: a large Dala-style sphere (2,200 colour triangles, outlined and filled) on the right, with your best job names floating on it.
- Every other page: a Vexel-style dome of glowing cyan dashes in concentric rings with a scalloped lower edge and a slow light wave. The two scenes cross-fade when you change page. With "reduce motion" on, both are static.
- The dome was rendered and checked in a headless browser; the full app was still not run by the author. Build with `npm run build`.

## Update: v0.9 (brain instead of sphere)
- Home background is now a brain made of about 4,000 tiny triangles (`frontend/src/brain.ts`): two hemispheres with a centre groove and folded surface, temporal lobes, an amber cerebellum and a brain stem. It sways gently and follows the pointer instead of spinning fully, so it always reads as a brain. A few glowing nodes and faint links with travelling light pulses stand for neurons firing. Job names float around it.
- The brain shape was rendered and checked in a headless browser; the full app was still not run by the author. Build with `npm run build`.
"# ApplyPilot" 
