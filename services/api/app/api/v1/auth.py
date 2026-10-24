from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.api.deps import CurrentPrincipal, DbSession, set_session_cookie
from app.config import get_settings
from app.models import Bank, Institution, Region, User
from app.services import audit
from app.services.auth import (
    CSRF_COOKIE,
    LOCKOUT_MINUTES,
    MAX_FAILED_LOGINS,
    SESSION_COOKIE,
    new_csrf_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Me(BaseModel):
    id: int
    name: str
    email: str
    designation: str
    role: str
    cell: str | None
    region: str | None
    region_name: str | None
    institution_id: int | None
    institution_name: str | None
    bank_id: int | None
    bank_name: str | None
    demo_mode: bool


class Persona(BaseModel):
    key: str
    name: str
    designation: str
    role: str
    context: str


async def _me(db: DbSession, user: User) -> Me:
    region = await db.get(Region, user.region_id) if user.region_id else None
    inst = await db.get(Institution, user.institution_id) if user.institution_id else None
    bank = await db.get(Bank, user.bank_id) if user.bank_id else None
    return Me(
        id=user.id,
        name=user.name,
        email=user.email,
        designation=user.designation,
        role=user.role,
        cell=user.cell,
        region=region.code if region else None,
        region_name=region.name if region else None,
        institution_id=user.institution_id,
        institution_name=inst.name if inst else None,
        bank_id=user.bank_id,
        bank_name=bank.name if bank else None,
        demo_mode=get_settings().demo_mode,
    )


def _start_session(response: Response, user: User) -> None:
    set_session_cookie(response, user)
    secure = get_settings().environment == "production"
    response.set_cookie(
        CSRF_COOKIE, new_csrf_token(), httponly=False, secure=secure, samesite="lax"
    )


@router.post("/login", response_model=Me)
async def login(body: LoginRequest, request: Request, response: Response, db: DbSession) -> Me:
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    now = datetime.now(UTC)
    if user and user.locked_until and user.locked_until > now:
        raise HTTPException(401, "Too many failed attempts. Try again in a few minutes.")
    if user is None or not user.is_active or not verify_password(user.password_hash, body.password):
        if user is not None:
            user.failed_logins += 1
            if user.failed_logins >= MAX_FAILED_LOGINS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
                user.failed_logins = 0
            await db.commit()
        raise HTTPException(401, "Email or password is incorrect.")
    user.failed_logins = 0
    user.locked_until = None
    await audit.append(
        db,
        actor_id=user.id,
        actor_label=user.name,
        action="auth.sign_in",
        entity_type="user",
        entity_id=user.id,
        data={"ip": request.client.host if request.client else None},
    )
    await db.commit()
    _start_session(response, user)
    return await _me(db, user)


@router.post("/logout", status_code=204)
async def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


@router.get("/me", response_model=Me)
async def me(principal: CurrentPrincipal, db: DbSession) -> Me:
    return await _me(db, principal.user)


@router.get("/personas", response_model=list[Persona])
async def personas(db: DbSession) -> list[Persona]:
    """Demo personas shown on the sign-in page. Empty unless demo mode is on."""
    if not get_settings().demo_mode:
        return []
    users = (
        await db.scalars(select(User).where(User.persona_key.is_not(None)).order_by(User.id))
    ).all()
    result = []
    for u in users:
        me_ = await _me(db, u)
        context = me_.institution_name or me_.bank_name or me_.region_name or "AICTE Headquarters"
        if u.cell:
            context = {
                "pgrc": "Public Grievance Redressal Cell",
                "vigilance": "Vigilance Cell",
                "grants": "Grants bureaus",
            }[u.cell]
        result.append(
            Persona(
                key=u.persona_key or "",
                name=u.name,
                designation=u.designation,
                role=u.role,
                context=context,
            )
        )
    return result


@router.post("/persona/{key}", response_model=Me)
async def sign_in_as_persona(key: str, request: Request, response: Response, db: DbSession) -> Me:
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")
    user = await db.scalar(select(User).where(User.persona_key == key))
    if user is None:
        raise HTTPException(404, "Unknown persona")
    await audit.append(
        db,
        actor_id=user.id,
        actor_label=user.name,
        action="auth.sign_in_persona",
        entity_type="user",
        entity_id=user.id,
        data={"ip": request.client.host if request.client else None},
    )
    await db.commit()
    _start_session(response, user)
    return await _me(db, user)
