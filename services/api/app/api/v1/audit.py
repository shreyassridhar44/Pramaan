from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select

from app.api.deps import DbSession, Principal, require_roles
from app.domain.types import Role
from app.models import AuditEntry
from app.services import audit as svc

router = APIRouter(prefix="/audit", tags=["audit"])

AuditReader = Annotated[
    Principal,
    Depends(
        require_roles(
            Role.AUDITOR,
            Role.ADMIN,
            Role.SECTION_HEAD,
            Role.APPROVING_AUTHORITY,
            Role.BUREAU_OFFICER,
        )
    ),
]


class AuditRow(BaseModel):
    id: int
    at: str
    actor: str
    action: str
    entity_type: str
    entity_id: int | None
    data: dict[str, object]
    prev_hash: str
    hash: str


class AuditPage(BaseModel):
    total: int
    items: list[AuditRow]


class ChainResult(BaseModel):
    checked: int
    valid: bool
    first_bad_id: int | None
    reason: str | None


@router.get("", response_model=AuditPage)
async def list_audit(
    principal: AuditReader,
    db: DbSession,
    entity_type: str | None = None,
    entity_id: int | None = None,
    action: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    before_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> AuditPage:
    filters = []
    if entity_type:
        filters.append(AuditEntry.entity_type == entity_type)
    if entity_id is not None:
        filters.append(AuditEntry.entity_id == entity_id)
    if action:
        filters.append(AuditEntry.action.ilike(f"{action}%"))
    if date_from:
        filters.append(func.date(AuditEntry.at) >= date_from)
    if date_to:
        filters.append(func.date(AuditEntry.at) <= date_to)
    total = await db.scalar(select(func.count()).select_from(AuditEntry).where(*filters)) or 0
    page_filters = [*filters, AuditEntry.id < before_id] if before_id else filters
    rows = (
        await db.scalars(
            select(AuditEntry).where(*page_filters).order_by(AuditEntry.id.desc()).limit(limit)
        )
    ).all()
    return AuditPage(
        total=total,
        items=[
            AuditRow(
                id=e.id,
                at=e.at.isoformat(),
                actor=e.actor_label,
                action=e.action,
                entity_type=e.entity_type,
                entity_id=e.entity_id,
                data=e.data,
                prev_hash=e.prev_hash,
                hash=e.hash,
            )
            for e in rows
        ],
    )


@router.post("/verify", response_model=ChainResult)
async def verify(principal: AuditReader, db: DbSession) -> ChainResult:
    result = await svc.verify_chain(db)
    await svc.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="audit.chain_verified",
        entity_type="audit",
        entity_id=None,
        data={"checked": result.checked, "valid": result.valid},
    )
    await db.commit()
    return ChainResult(
        checked=result.checked,
        valid=result.valid,
        first_bad_id=result.first_bad_id,
        reason=result.reason,
    )
