"""Passwords, sessions and CSRF.

Sessions are a signed cookie (itsdangerous) holding the user id and the last-seen time. The cookie
is re-issued on each authenticated request, which gives a sliding idle timeout. CSRF protection is
a double-submit token: a readable cookie whose value must be echoed in the `x-csrf-token` header on
state-changing requests.
"""

import secrets
import time
from dataclasses import dataclass

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError
from itsdangerous import BadSignature, URLSafeSerializer

from app.config import get_settings
from app.domain.types import OFFICER_ROLES, Role

SESSION_COOKIE = "pramaan_session"
CSRF_COOKIE = "pramaan_csrf"
MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerificationError:
        return False


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(get_settings().session_secret, salt="pramaan.session")


@dataclass(frozen=True, slots=True)
class SessionData:
    user_id: int
    role: str
    seen: float


def idle_limit_seconds(role: str) -> int:
    s = get_settings()
    minutes = (
        s.session_idle_minutes_officer
        if Role(role) in OFFICER_ROLES
        else s.session_idle_minutes_other
    )
    return minutes * 60


def issue_session(user_id: int, role: str) -> str:
    return _serializer().dumps({"u": user_id, "r": role, "s": time.time()})


def read_session(token: str | None) -> SessionData | None:
    if not token:
        return None
    try:
        raw = _serializer().loads(token)
    except BadSignature:
        return None
    data = SessionData(int(raw["u"]), str(raw["r"]), float(raw["s"]))
    if time.time() - data.seen > idle_limit_seconds(data.role):
        return None
    return data


def new_csrf_token() -> str:
    return secrets.token_urlsafe(24)
