"""Single-owner password gate for a hosted deployment. Not multi-user accounts."""
import hashlib
import hmac
import logging
import secrets
import time

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from .config import settings

log = logging.getLogger("applypilot.auth")
_RANDOM = secrets.token_hex(32)
COOKIE, TTL = "ap_session", 7 * 86400
EXEMPT = ("/api/auth/", "/api/health")
_attempts: dict[str, list[float]] = {}
if settings.app_password and not settings.secret_key:
    log.warning("SECRET_KEY not set: sessions reset whenever the server restarts.")


def _secret() -> bytes:
    return (settings.secret_key or _RANDOM).encode()


def _mac(exp: str) -> str:
    return hmac.new(_secret(), exp.encode(), hashlib.sha256).hexdigest()


def _valid(tok: str) -> bool:
    exp, _, sig = tok.partition(".")
    return exp.isdigit() and int(exp) > time.time() and hmac.compare_digest(sig, _mac(exp))


def require_auth(request: Request):
    if not settings.app_password:
        return  # local mode: no login
    p = request.url.path
    if p.startswith(EXEMPT) or not p.startswith("/api"):
        return
    if not _valid(request.cookies.get(COOKIE, "")):
        raise HTTPException(401, "Please sign in.")


router = APIRouter(prefix="/api/auth")


class LoginIn(BaseModel):
    password: str = Field(..., max_length=200)


@router.get("/status")
def status(request: Request):
    required = bool(settings.app_password)
    return {"auth_required": required, "authenticated": (not required) or _valid(request.cookies.get(COOKIE, ""))}


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response):
    if not settings.app_password:
        return {"ok": True}
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    recent = [t for t in _attempts.get(ip, []) if now - t < 60]
    if len(recent) >= 5:
        raise HTTPException(429, "Too many attempts. Wait a minute and try again.")
    if not hmac.compare_digest(body.password.encode(), settings.app_password.encode()):
        _attempts[ip] = recent + [now]
        raise HTTPException(401, "Wrong password.")
    exp = str(int(now) + TTL)
    response.set_cookie(COOKIE, f"{exp}.{_mac(exp)}", max_age=TTL, httponly=True, samesite="lax", secure=settings.cookie_secure)
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE)
    return {"ok": True}
