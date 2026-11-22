# ApplyPilot AI
### AI-Powered Resume Intelligence & Job Matching Platform

ApplyPilot is an AI-powered job discovery and career assistance platform designed to help job seekers analyze their resumes, discover relevant opportunities, understand their job compatibility, and organize their application journey in one place.

Built with a modern web stack, intelligent resume processing, job-matching algorithms, and an immersive 3D interface.

---

## Features

### Resume Intelligence
- Upload resumes in PDF and DOCX format.
- Extract resume text and automatically populate profile information.
- Analyze resumes using structured scoring criteria.
- Identify resume weaknesses and provide actionable recommendations.
- Generate before-and-after improvement examples.
- Review ATS readability and resume structure.

### Smart Job Matching
- Discover job opportunities based on preferred roles and skills.
- Calculate job compatibility scores.
- Identify matching skills and missing requirements.
- Explain why a job matches your profile.
- Filter and explore opportunities based on relevance.

### Job Discovery
Designed with a provider-based job discovery architecture.

Supported and planned integrations include:
- Remotive
- Adzuna
- Greenhouse
- Lever
- External job search platforms

Job-source availability depends on API access, configuration, and provider restrictions.

### Application Tracking
Organize your job search through an application tracking system.

- Track application progress.
- Manage application statuses.
- Search and filter applications.
- Export application data to CSV.
- Maintain an application activity history.

### AI Career Assistant
An interactive career assistant designed to help with:
- Resume reviews
- Job-match explanations
- Skill-gap analysis
- Job discovery
- Application tracking
- Career-related questions

### Immersive 3D Interface
ApplyPilot features an experimental 3D-inspired interface designed to make job discovery feel more interactive.

- Animated neural-brain visualization
- Particle-based backgrounds
- Floating job elements
- Interactive depth effects
- Motion-based transitions
- Responsive glass-style interface
- Reduced-motion support

---

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Three.js / 3D visual components

### Backend
- Python
- FastAPI
- SQLAlchemy
- Pydantic

### AI
- Groq API integration
- LLM-powered resume analysis
- AI-assisted career recommendations

### Database
- SQLite
- PostgreSQL support through database configuration

### Infrastructure
- Git & GitHub
- Docker
- Render deployment configuration

---

# Tests
cd backend && pytest -q

## Architecture

```text
ApplyPilot
│
├── frontend/
│   ├── React + TypeScript
│   ├── Interactive dashboard
│   ├── Resume analysis UI
│   ├── Job discovery
│   └── 3D visual components
│
├── backend/
│   ├── FastAPI
│   ├── Resume processing
│   ├── Job discovery providers
│   ├── Job matching & scoring
│   ├── AI integration
│   └── Application tracking
│
├── Dockerfile
├── render.yaml
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js and npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Gowthamkumar09/ApplyPilot.git
cd ApplyPilot
```

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
```

Activate the environment.

**Windows:**

```cmd
.venv\Scripts\activate
```

**Linux/macOS:**

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure environment variables:

Copy `../.env.example` into `backend/.env` and configure the required values.

Start the backend:

```bash
python -m uvicorn app.main:app --reload
```

Backend API:

```text
http://localhost:8000
```

API documentation:

```text
http://localhost:8000/docs
```

### 3. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## Configuration

ApplyPilot supports environment-based configuration.

Depending on the enabled features, configuration may include:

| Variable | Purpose |
|---|---|
| `LLM_API_KEY` | AI provider API key |
| `LLM_MODEL` | Model configuration |
| `ADZUNA_APP_ID` | Adzuna application ID |
| `ADZUNA_APP_KEY` | Adzuna application key |
| `APP_PASSWORD` | Optional single-user application password |
| `DATABASE_URL` | Database connection configuration |

Refer to `.env.example` for available settings.

Never commit real API keys, credentials, or `.env` files.

---

## Testing

Run backend tests:

```bash
cd backend
pytest -q
```

Build the frontend:

```bash
cd frontend
npm run build
```

Some external integrations have only been tested with mocked responses and may require live API verification.

---

## Privacy & Limitations

- ApplyPilot is currently designed as a single-user application.
- Resume files contain personal information and should be handled carefully.
- AI-generated results may be inaccurate and should be reviewed.
- Job availability and matching scores are not guarantees of employment.
- External job providers may have API restrictions or availability limitations.
- ApplyPilot does not automatically submit job applications.
- Application submission statuses are not independently verified.
- OCR for scanned resumes is not currently supported.

---

## Roadmap

- [ ] Reliable real-time job discovery
- [ ] Improved AI resume optimization
- [ ] Advanced job compatibility scoring
- [ ] Personalized skill-gap learning plans
- [ ] AI-generated tailored resumes
- [ ] AI-generated cover letters
- [ ] Improved application analytics
- [ ] Multi-user authentication
- [ ] PostgreSQL production deployment
- [ ] More job provider integrations
- [ ] Improved deployment reliability

---

## Vision

ApplyPilot aims to transform job searching from a repetitive process into an intelligent, personalized workflow.

The goal is not just to find jobs, but to help people understand where they fit, what they are missing, how they can improve, and which opportunities deserve their attention.

**Find opportunities. Understand your potential. Apply smarter.**

---

## Developer

**Gowtham Kumar**

AI & Machine Learning Engineering Student | Building AI-powered applications

GitHub: [@Gowthamkumar09](https://github.com/Gowthamkumar09)

---

## License

License not yet specified.
