"""Officer actions on instruments and resolution of signals. Every action goes through the state
machine where it changes state, and writes an event and an audit entry in the same transaction."""

from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DbSession, Principal, instrument_scope, require_roles
from app.domain.state_machine import TransitionRefused, check_transition
from app.domain.types import Role, Status
from app.models import Event, Institution, Instrument, Signal, User
from app.services import audit
from app.services import portfolio as psvc

router = APIRouter(tags=["actions"])
Officer = Annotated[
    Principal,
    Depends(require_roles(Role.BUREAU_OFFICER, Role.REGIONAL_OFFICER, Role.SECTION_HEAD)),
]

Action = Literal["start_scrutiny", "verify", "return", "assign", "observe"]


class ActionBody(BaseModel):
    reason: str | None = Field(default=None, max_length=2000)
    owner_id: int | None = None


class ActionResult(BaseModel):
    instrument_id: int
    status: str
    message: str


async def _instrument(db: DbSession, principal: Principal, instrument_id: int) -> Instrument:
    inst = await db.scalar(
        select(Instrument)
        .join(Institution, Institution.id == Instrument.institution_id)
        .where(Instrument.id == instrument_id, instrument_scope(principal))
    )
    if inst is None:
        raise HTTPException(404, "Instrument not found.")
    return inst


async def _open_high(db: DbSession, instrument_id: int) -> int:
    return int(
        await db.scalar(
            select(func.count())
            .select_from(Signal)
            .where(
                Signal.entity_type == "instrument",
                Signal.entity_id == instrument_id,
                Signal.status == "open",
                Signal.severity == "high",
            )
        )
        or 0
    )


@router.post("/instruments/{instrument_id}/actions/{action}", response_model=ActionResult)
async def act(
    instrument_id: int, action: Action, body: ActionBody, principal: Officer, db: DbSession
) -> ActionResult:
    inst = await _instrument(db, principal, instrument_id)
    today = date.today()
    message = ""
    if action in ("start_scrutiny", "verify", "return"):
        if action == "verify" and await _open_high(db, inst.id):
            raise HTTPException(409, "Resolve the open high-severity signals before verifying.")
        if action == "verify" and inst.conflict_since and not inst.conflict_resolved_on:
            raise HTTPException(
                409, "A field conflicts with the bank record. Resolve it before verifying."
            )
        try:
            target = check_transition(action, Status(inst.status), principal.role, body.reason)
        except TransitionRefused as exc:
            raise HTTPException(409, exc.message) from exc
        inst.status = target.value
        if action == "verify":
            inst.verified_on = today
            if inst.predecessor_id:
                pred = await db.get(Instrument, inst.predecessor_id)
                if pred is not None and pred.renewed_on is None:
                    pred.renewed_on = today
                    pred.status = Status.RENEWED.value
                    pred.next_action, pred.next_action_due = None, None
                    db.add(
                        Event(
                            entity_type="instrument",
                            entity_id=pred.id,
                            type="instrument.renewed",
                            payload={"successor_id": inst.id},
                            actor_id=principal.user.id,
                            occurred_on=today,
                        )
                    )
            inst.returned_on = None
            inst.next_action, inst.next_action_due = (
                "Request bank confirmation",
                today + timedelta(days=7),
            )
            message = "Verified. The instrument is now active."
        elif action == "return":
            inst.returned_on = today
            inst.next_action, inst.next_action_due = (
                "Await corrected submission",
                today + timedelta(days=15),
            )
            message = "Returned to the institution with your reason."
        else:
            inst.next_action = "Complete scrutiny"
            message = "Scrutiny started."
    elif action == "assign":
        owner = await db.get(User, body.owner_id) if body.owner_id else None
        if owner is None or owner.role not in (
            Role.BUREAU_OFFICER,
            Role.REGIONAL_OFFICER,
            Role.SECTION_HEAD,
        ):
            raise HTTPException(422, "Choose an officer to assign.")
        inst.owner_id = owner.id
        message = f"Assigned to {owner.name}."
    elif action == "observe":
        if not body.reason or not body.reason.strip():
            raise HTTPException(422, "Write the observation.")
        message = "Observation recorded."
    db.add(
        Event(
            entity_type="instrument",
            entity_id=inst.id,
            type=f"officer.{action}",
            payload={"reason": body.reason} if body.reason else {},
            actor_id=principal.user.id,
            occurred_on=today,
        )
    )
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action=f"instrument.{action}",
        entity_type="instrument",
        entity_id=inst.id,
        data={"reason": body.reason, "owner_id": body.owner_id},
    )
    await psvc.bump_data_version(db)
    await db.commit()
    return ActionResult(instrument_id=inst.id, status=inst.status, message=message)


class ResolveBody(BaseModel):
    outcome: Literal["confirmed", "dismissed", "resolved"]
    note: str = Field(min_length=3, max_length=2000)


class ResolveResult(BaseModel):
    signal_id: int
    status: str
    open_high_remaining: int


@router.post("/signals/{signal_id}/resolve", response_model=ResolveResult)
async def resolve(
    signal_id: int, body: ResolveBody, principal: Officer, db: DbSession
) -> ResolveResult:
    sig = await db.get(Signal, signal_id)
    if sig is None or sig.entity_type != "instrument":
        raise HTTPException(404, "Signal not found.")
    inst = await _instrument(db, principal, sig.entity_id)
    if sig.status != "open":
        raise HTTPException(409, "This signal has already been handled.")
    today = date.today()
    sig.status = body.outcome
    sig.resolution_note = body.note
    sig.resolved_by = principal.user.id
    sig.resolved_on = today
    if body.outcome == "confirmed" and not inst.conflict_since:
        # The officer agrees the document is not reliable: treat it as a discrepancy.
        inst.conflict_since = today
        inst.status = Status.DISCREPANCY.value
        inst.next_action, inst.next_action_due = (
            "Resolve discrepancy with institution and bank",
            today + timedelta(days=7),
        )
    remaining = await _open_high(db, inst.id) - (1 if sig.severity == "high" else 0)
    if remaining <= 0 and inst.high_signal_since and not inst.high_signal_resolved_on:
        inst.high_signal_resolved_on = today
    db.add(
        Event(
            entity_type="instrument",
            entity_id=inst.id,
            type=f"signal.{body.outcome}",
            payload={"signal": sig.title, "note": body.note},
            actor_id=principal.user.id,
            occurred_on=today,
        )
    )
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action=f"signal.{body.outcome}",
        entity_type="instrument",
        entity_id=inst.id,
        data={"signal_id": sig.id, "note": body.note},
    )
    await psvc.bump_data_version(db)
    await db.commit()
    return ResolveResult(signal_id=sig.id, status=sig.status, open_high_remaining=max(0, remaining))
