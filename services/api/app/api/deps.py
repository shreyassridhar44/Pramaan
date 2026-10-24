"""Request dependencies: database session, current user, role and scope enforcement."""

from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import ColumnElement, true
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_session
from app.domain.types import Role
from app.models import Institution, Instrument, User
from app.services.auth import CSRF_COOKIE, SESSION_COOKIE, issue_session, read_session

DbSession = Annotated[AsyncSession, Depends(get_session)]

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@dataclass(frozen=True, slots=True)
class Principal:
    user: User

    @property
    def role(self) -> Role:
        return Role(self.user.role)

    @property
    def label(self) -> str:
        return f"{self.user.name} ({self.user.role})"


def set_session_cookie(response: Response, user: User) -> None:
    secure = get_settings().environment == "production"
    response.set_cookie(
        SESSION_COOKIE,
        issue_session(user.id, user.role),
        httponly=True,
        secure=secure,
        samesite="lax",
        path="/",
    )


async def current_principal(request: Request, response: Response, db: DbSession) -> Principal:
    data = read_session(request.cookies.get(SESSION_COOKIE))
    if data is None:
        raise HTTPException(401, "Sign in to continue.")
    if request.method not in SAFE_METHODS:
        header = request.headers.get("x-csrf-token")
        if not header or header != request.cookies.get(CSRF_COOKIE):
            raise HTTPException(
                403, "The request could not be verified. Reload the page and try again."
            )
    user = await db.get(User, data.user_id)
    if user is None or not user.is_active or user.role != data.role:
        raise HTTPException(401, "Sign in to continue.")
    set_session_cookie(response, user)  # slide the idle timeout
    return Principal(user)


CurrentPrincipal = Annotated[Principal, Depends(current_principal)]


def require_roles(*roles: Role) -> Callable[..., Coroutine[Any, Any, Principal]]:
    allowed = set(roles)

    async def dependency(principal: CurrentPrincipal) -> Principal:
        if principal.role not in allowed:
            raise HTTPException(403, "Your role does not have access to this.")
        return principal

    return dependency


OFFICER_READ = (
    Role.BUREAU_OFFICER,
    Role.SECTION_HEAD,
    Role.REGIONAL_OFFICER,
    Role.APPROVING_AUTHORITY,
    Role.AUDITOR,
    Role.ADMIN,
)
OfficerReader = Annotated[Principal, Depends(require_roles(*OFFICER_READ))]


def instrument_scope(principal: Principal) -> ColumnElement[bool]:
    """SQL filter restricting instruments to what the principal may see. Joins on Institution are
    expected in the calling query."""
    u = principal.user
    match principal.role:
        case Role.REGIONAL_OFFICER:
            return Institution.region_id == u.region_id
        case Role.INSTITUTION_USER:
            return Instrument.institution_id == u.institution_id
        case Role.BANK_OFFICER:
            return Instrument.bank_id == u.bank_id
        case (
            Role.BUREAU_OFFICER
            | Role.SECTION_HEAD
            | Role.APPROVING_AUTHORITY
            | Role.AUDITOR
            | Role.ADMIN
        ):
            return true()
        case _:
            return Instrument.id == -1


def institution_scope(principal: Principal) -> ColumnElement[bool]:
    u = principal.user
    match principal.role:
        case Role.REGIONAL_OFFICER:
            return Institution.region_id == u.region_id
        case Role.INSTITUTION_USER:
            return Institution.id == u.institution_id
        case Role.BANK_OFFICER:
            return Institution.id == -1
        case _:
            return true()
