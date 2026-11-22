from datetime import datetime, timezone
from sqlalchemy import (JSON, inspect, text, Boolean, DateTime, Float, ForeignKey, Integer, String, Text,
                        create_engine)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .config import settings

_url = settings.database_url
for _p in ("postgres://", "postgresql://"):
    if _url.startswith(_p):
        _url = "postgresql+psycopg://" + _url[len(_p):]
connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}
engine = create_engine(_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Profile(Base):
    """Single-user profile for Milestone 1 (auth arrives in Milestone 5)."""
    __tablename__ = "profiles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    education: Mapped[list] = mapped_column(JSON, default=list)
    skills: Mapped[list] = mapped_column(JSON, default=list)
    projects: Mapped[list] = mapped_column(JSON, default=list)
    experience: Mapped[list] = mapped_column(JSON, default=list)
    certifications: Mapped[list] = mapped_column(JSON, default=list)
    preferred_roles: Mapped[list] = mapped_column(JSON, default=list)
    preferred_locations: Mapped[list] = mapped_column(JSON, default=list)
    remote_ok: Mapped[bool] = mapped_column(Boolean, default=True)
    experience_years: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Resume(Base):
    __tablename__ = "resumes"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(300))
    text: Mapped[str] = mapped_column(Text)
    analysis: Mapped[dict] = mapped_column(JSON, default=dict)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    dedupe_key: Mapped[str] = mapped_column(String(400), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(50))
    source_job_id: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200))
    remote: Mapped[bool] = mapped_column(Boolean, default=False)
    job_type: Mapped[str] = mapped_column(String(40), default="full-time")
    experience_min: Mapped[float] = mapped_column(Float, default=0)
    required_skills: Mapped[list] = mapped_column(JSON, default=list)
    preferred_skills: Mapped[list] = mapped_column(JSON, default=list)
    salary: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(1000), default="")
    deadline: Mapped[str] = mapped_column(String(40), default="")
    apply_method: Mapped[str] = mapped_column(String(60), default="manual_link")
    automation_eligible: Mapped[bool] = mapped_column(Boolean, default=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), unique=True)  # one per job: no duplicates
    status: Mapped[str] = mapped_column(String(40), default="shortlisted")
    confirmation_source: Mapped[str] = mapped_column(String(40), default="")  # "user_reported" | "integration"
    notes: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"))
    kind: Mapped[str] = mapped_column(String(30), default="cover_letter")
    content: Mapped[str] = mapped_column(Text, default="")
    generated_by: Mapped[str] = mapped_column(String(20), default="template")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    action: Mapped[str] = mapped_column(String(80))
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


def init_db():
    Base.metadata.create_all(engine)
    # Lightweight upgrade for databases created by earlier versions.
    if "posted_at" not in {c["name"] for c in inspect(engine).get_columns("jobs")}:
        col = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "DATETIME"
        with engine.begin() as c:
            c.execute(text(f"ALTER TABLE jobs ADD COLUMN posted_at {col}"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
