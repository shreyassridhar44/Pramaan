"""Letters (NOC and sanction orders) and their public verification (R8)."""

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import DbSession, Principal, require_roles
from app.domain.types import Role
from app.models import Institution, Letter, User
from app.services import letters as svc

router = APIRouter(tags=["letters"])

Reader = Annotated[
    Principal,
    Depends(
        require_roles(
            Role.BUREAU_OFFICER,
            Role.REGIONAL_OFFICER,
            Role.SECTION_HEAD,
            Role.APPROVING_AUTHORITY,
            Role.AUDITOR,
            Role.ADMIN,
            Role.INSTITUTION_USER,
        )
    ),
]
Revoker = Annotated[Principal, Depends(require_roles(Role.APPROVING_AUTHORITY, Role.SECTION_HEAD))]


class LetterOut(BaseModel):
    id: int
    kind: str
    title: str
    reference: str
    institution_id: int | None
    institution: str | None
    recipient: str
    amount_paise: str | None
    case_id: int | None
    issued_on: str
    issued_by: str | None
    status: str
    status_note: str | None
    verify_url: str


def _note(lt: Letter) -> str | None:
    f = lt.fields or {}
    if lt.status == "revoked":
        return f"Revoked on {f.get('revoked_on', '')}. {f.get('revoked_reason', '')}".strip()
    if lt.status == "superseded":
        return f"Superseded by {f.get('superseded_by', 'a later letter')}"
    return None


def _out(lt: Letter, institution: str | None, issuer: str | None) -> LetterOut:
    return LetterOut(
        id=lt.id,
        kind=lt.kind,
        title=svc.KINDS[lt.kind]["short_en"],
        reference=lt.reference,
        institution_id=lt.institution_id,
        institution=institution,
        recipient=lt.recipient,
        amount_paise=(lt.fields or {}).get("amount_paise"),
        case_id=lt.entity_id if lt.entity_type == "release_case" else None,
        issued_on=lt.issued_on.isoformat(),
        issued_by=issuer,
        status=lt.status,
        status_note=_note(lt),
        verify_url=svc.verify_url(svc.make_token(lt.token_id)),
    )


async def _visible(db: DbSession, principal: Principal, letter_id: int) -> Letter:
    lt = await db.get(Letter, letter_id)
    if lt is None:
        raise HTTPException(404, "Letter not found.")
    u = principal.user
    if principal.role == Role.INSTITUTION_USER and lt.institution_id != u.institution_id:
        raise HTTPException(404, "Letter not found.")
    if principal.role == Role.REGIONAL_OFFICER and lt.institution_id:
        inst = await db.get(Institution, lt.institution_id)
        if inst is None or inst.region_id != u.region_id:
            raise HTTPException(404, "Letter not found.")
    return lt


@router.get("/letters", response_model=list[LetterOut])
async def list_letters(
    principal: Reader,
    db: DbSession,
    status: Literal["issued", "superseded", "revoked"] | None = None,
) -> list[LetterOut]:
    q = (
        select(Letter, Institution.name, User.name)
        .outerjoin(Institution, Institution.id == Letter.institution_id)
        .outerjoin(User, User.id == Letter.issued_by)
        .order_by(Letter.issued_on.desc(), Letter.id.desc())
        .limit(500)
    )
    u = principal.user
    if principal.role == Role.INSTITUTION_USER:
        q = q.where(Letter.institution_id == u.institution_id)
    elif principal.role == Role.REGIONAL_OFFICER:
        q = q.where(Institution.region_id == u.region_id)
    if status:
        q = q.where(Letter.status == status)
    return [_out(lt, inst, issuer) for lt, inst, issuer in (await db.execute(q)).all()]


@router.get("/letters/{letter_id}/pdf")
async def letter_pdf(letter_id: int, principal: Reader, db: DbSession) -> Response:
    lt = await _visible(db, principal, letter_id)
    data = svc.pdf_bytes(lt)
    await db.commit()
    name = lt.reference.replace("/", "-")
    return Response(
        data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{name}.pdf"'},
    )


class RevokeBody(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)


@router.post("/letters/{letter_id}/revoke", response_model=LetterOut)
async def revoke(letter_id: int, body: RevokeBody, principal: Revoker, db: DbSession) -> LetterOut:
    lt = await _visible(db, principal, letter_id)
    if lt.status != "issued":
        raise HTTPException(409, "Only an issued letter can be revoked.")
    await svc.revoke(db, lt, body.reason.strip(), principal.user.id, principal.label, date.today())
    await db.commit()
    inst = await db.get(Institution, lt.institution_id) if lt.institution_id else None
    issuer = await db.get(User, lt.issued_by) if lt.issued_by else None
    return _out(lt, inst.name if inst else None, issuer.name if issuer else None)


# Public verification: no sign-in, minimal disclosure.


class VerifiedLetter(BaseModel):
    title: str
    title_hi: str
    reference: str
    institution: str | None
    issued_on: str
    amount_paise: str | None
    instruments: list[str]
    issuing_office: str
    status_note: str | None


class Verification(BaseModel):
    result: Literal["genuine", "superseded", "revoked", "not_recognised"]
    letter: VerifiedLetter | None
    key_id: str
    checked_at: str


@router.get("/public/verify/{token}", response_model=Verification)
async def verify(token: str, db: DbSession) -> Verification:
    key = svc.issuer_key()
    checked = datetime.now(UTC).isoformat(timespec="seconds")
    token_id = svc.read_token(token) if len(token) < 400 else None
    lt = await db.scalar(select(Letter).where(Letter.token_id == token_id)) if token_id else None
    if lt is None:
        return Verification(
            result="not_recognised", letter=None, key_id=key.key_id, checked_at=checked
        )
    f = lt.fields or {}
    meta = svc.KINDS[lt.kind]
    result: Literal["genuine", "superseded", "revoked"] = (
        "genuine" if lt.status == "issued" else lt.status  # type: ignore[assignment]
    )
    return Verification(
        result=result,
        letter=VerifiedLetter(
            title=meta["short_en"],
            title_hi=meta["short_hi"],
            reference=lt.reference,
            institution=f.get("institution"),
            issued_on=lt.issued_on.isoformat(),
            amount_paise=f.get("amount_paise"),
            instruments=[i["number"] for i in f.get("instruments", [])],
            issuing_office="Regulation Bureau, AICTE, New Delhi",
            status_note=_note(lt),
        ),
        key_id=key.key_id,
        checked_at=checked,
    )


class LetterKey(BaseModel):
    key_id: str
    algorithm: str
    public_key: str
    token_format: str


@router.get("/public/letter-keys", response_model=list[LetterKey])
async def letter_keys() -> list[LetterKey]:
    key = svc.issuer_key()
    return [
        LetterKey(
            key_id=key.key_id,
            algorithm="Ed25519",
            public_key=key.public_b64,
            token_format="fingerprint.letter_id.base64url(signature over 'fingerprint.letter_id')",  # noqa: S106
        )
    ]
