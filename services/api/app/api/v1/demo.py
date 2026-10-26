import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DbSession, Principal, require_roles
from app.config import get_settings
from app.domain.types import Role
from app.models import AuditEntry
from app.seed.load import reset_and_seed
from app.services import audit

router = APIRouter(prefix="/demo", tags=["demo"])

Admin = Annotated[Principal, Depends(require_roles(Role.ADMIN))]


class ResetResult(BaseModel):
    counts: dict[str, int]


@router.post("/reset", response_model=ResetResult)
async def reset(principal: Admin, db: DbSession) -> ResetResult:
    """Replaces all data with a fresh synthetic portfolio anchored to today. Demo mode only."""
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")
    return ResetResult(counts=await reset_and_seed(db))


DrillRole = Annotated[
    Principal,
    Depends(require_roles(Role.ADMIN, Role.AUDITOR, Role.BUREAU_OFFICER, Role.SECTION_HEAD)),
]
DRILL_KEY = "_drill_original"


class DrillResult(BaseModel):
    entry_id: int
    action: str
    field: str
    before: str
    after: str
    active: bool


async def _drilled(db: DbSession) -> AuditEntry | None:
    rows = await db.scalars(select(AuditEntry).order_by(AuditEntry.id.desc()).limit(3000))
    return next((e for e in rows if DRILL_KEY in (e.data or {})), None)


@router.post("/tamper-drill", response_model=DrillResult)
async def tamper_drill(principal: DrillRole, db: DbSession) -> DrillResult:
    """Edits one audit entry directly, as an insider with database access might, so the chain
    check can be seen catching it. Demo mode only; restore with /demo/tamper-drill/restore."""
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")
    if await _drilled(db) is not None:
        raise HTTPException(409, "A drill is already active. Restore it first.")
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="demo.tamper_drill_started",
        entity_type="audit",
        entity_id=None,
        data={},
    )
    await db.flush()
    rows = (
        await db.scalars(
            select(AuditEntry)
            .where(AuditEntry.action != "demo.tamper_drill_started")
            .order_by(AuditEntry.id.desc())
            .limit(3000)
        )
    ).all()
    # The most telling edit an insider could make: erase a mismatch the bank reported.
    target = next(
        (
            e
            for e in rows
            if e.action == "bank.response_received" and (e.data or {}).get("conflicts")
        ),
        None,
    )
    if target is not None:
        field, value = "conflicts", target.data["conflicts"]
        new_value: object = []
    else:
        target = rows[min(5, len(rows) - 1)]
        field, value, new_value = "note", None, "Approved by phone"
    before, after = json.dumps(value), json.dumps(new_value)
    # Assign a new dict so SQLAlchemy writes the change; the hash column is left as it was.
    target.data = {**(target.data or {}), field: new_value, DRILL_KEY: {field: value}}
    await db.commit()
    return DrillResult(
        entry_id=target.id,
        action=target.action,
        field=field,
        before=before,
        after=after,
        active=True,
    )


@router.post("/tamper-drill/restore", response_model=DrillResult)
async def restore_drill(principal: DrillRole, db: DbSession) -> DrillResult:
    if not get_settings().demo_mode:
        raise HTTPException(404, "Not found")
    target = await _drilled(db)
    if target is None:
        raise HTTPException(404, "No drill is active.")
    data = dict(target.data)
    original = data.pop(DRILL_KEY)
    field, before = next(iter(original.items()))
    after = json.dumps(data.get(field))
    if before is None:
        data.pop(field, None)
    else:
        data[field] = before
    target.data = data
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="demo.tamper_drill_restored",
        entity_type="audit",
        entity_id=target.id,
        data={},
    )
    await db.commit()
    return DrillResult(
        entry_id=target.id,
        action=target.action,
        field=field,
        before=after,
        after=json.dumps(before),
        active=False,
    )
