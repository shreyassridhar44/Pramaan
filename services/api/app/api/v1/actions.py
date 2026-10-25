"""Officer actions on instruments and resolution of signals. Every action goes through the state
machine where it changes state, and writes an event and an audit entry in the same transaction."""

from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.deps import DbSession, Principal, instrument_scope, require_roles
from app.domain.state_machine import TransitionRefused, check_transition
from app.domain.types import FieldName, Role, Status
from app.models import Event, Institution, Instrument, Letter, Signal, User
from app.services import audit, corrections, letters
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
            letter = await _deficiency_letter(db, inst, body.reason or "", principal, today)
            message = f"Returned to the institution with deficiency letter {letter.reference}."
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


async def _deficiency_letter(
    db: DbSession, inst: Instrument, reason: str, principal: Principal, today: date
) -> Letter:
    institution = await db.get(Institution, inst.institution_id)
    assert institution is not None
    return await letters.issue(
        db,
        kind="deficiency",
        entity_type="instrument",
        entity_id=inst.id,
        institution_id=institution.id,
        recipient="\n".join(
            (f"The Secretary, {institution.trust_name}", f"{institution.name}, {institution.city}")
        ),
        fields={
            "institution": institution.name,
            "trust": institution.trust_name,
            "aicte_id": institution.aicte_id,
            "address": f"{institution.city}, {institution.state}",
            "amount_paise": str(inst.amount_paise),
            "reason": reason,
            "respond_within_days": 15,
            "discrepancies": await corrections.discrepancies(db, inst, today),
            "instruments": [
                {
                    "number": inst.number,
                    "kind_label": {"joint_fdr": "Joint FDR", "rpgf": "RPGF"}.get(inst.kind, "RTGS"),
                    "bank": inst.bank.name,
                    "branch": inst.branch,
                    "issue_date": inst.issue_date.isoformat(),
                    "maturity_date": inst.maturity_date.isoformat(),
                    "amount_paise": str(inst.amount_paise),
                }
            ],
            "authority": {
                "name": principal.user.name,
                "designation": principal.user.designation,
            },
        },
        actor_id=principal.user.id,
        actor_label=principal.label,
        on=today,
    )


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


class CorrectionBody(BaseModel):
    field: str
    value: str = Field(min_length=1, max_length=400)
    reason: str = Field(min_length=3, max_length=2000)


class CorrectionResult(BaseModel):
    instrument_id: int
    field: str
    corrected_from: str | None
    corrected_to: str
    conflict_remaining: bool
    message: str


@router.post("/instruments/{instrument_id}/corrections", response_model=CorrectionResult)
async def correct(
    instrument_id: int, body: CorrectionBody, principal: Officer, db: DbSession
) -> CorrectionResult:
    """Corrects a declared value with a reason. The original stays in the history, and extracted
    and bank-confirmed values are never changed, so a correction cannot hide an altered receipt."""
    inst = await _instrument(db, principal, instrument_id)
    try:
        fld = FieldName(body.field)
    except ValueError as exc:
        raise HTTPException(422, "Unknown field.") from exc
    if fld not in corrections.CORRECTABLE:
        raise HTTPException(422, "This field identifies the deposit and cannot be corrected.")
    if inst.released_on or inst.renewed_on or inst.forfeited_on:
        raise HTTPException(409, "A closed instrument cannot be corrected.")
    today = date.today()
    try:
        change = await corrections.declare(
            db,
            inst,
            fld,
            body.value,
            evidence_type="correction",
            actor_id=principal.user.id,
            note=body.reason.strip(),
            on=today,
        )
    except ValueError as exc:
        raise HTTPException(422, "The value could not be read for this field.") from exc
    if change is None:
        raise HTTPException(409, "The value is the same as the current declared value.")
    remaining = await corrections.refresh_conflict(db, inst, today)
    db.add(
        Event(
            entity_type="instrument",
            entity_id=inst.id,
            type="officer.correction",
            payload={
                "field": fld.value,
                "from": change.old,
                "to": change.new,
                "reason": body.reason.strip(),
            },
            actor_id=principal.user.id,
            occurred_on=today,
        )
    )
    await audit.append(
        db,
        actor_id=principal.user.id,
        actor_label=principal.label,
        action="instrument.correction",
        entity_type="instrument",
        entity_id=inst.id,
        data={"field": fld.value, "from": change.old, "to": change.new},
        note=body.reason.strip(),
    )
    await psvc.bump_data_version(db)
    await db.commit()
    return CorrectionResult(
        instrument_id=inst.id,
        field=fld.value,
        corrected_from=change.old,
        corrected_to=change.new,
        conflict_remaining=remaining,
        message="Corrected. The original value stays in the history."
        + (" Another source still disagrees." if remaining else ""),
    )
