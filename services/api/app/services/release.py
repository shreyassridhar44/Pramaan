"""Release cases (APH 2024-27 Clause 6.46): eligibility, clearances, authorisation and discharge.

The domain engine decides which conditions pass; this module gathers the facts it needs and applies
the decisions people make. Nothing here releases money without an authorised human action.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.rules.penalty import Penalty, applicable_penalties
from app.domain.rules.release import Eligibility, ReleaseContext, evaluate_release
from app.domain.types import InstrumentKind, Status
from app.models import (
    Bank,
    Clearance,
    Complaint,
    Event,
    Institution,
    Instrument,
    ReleaseCase,
    ReleaseCaseInstrument,
    User,
)
from app.services import audit, letters
from app.services import bank as bank_svc
from app.services import portfolio as psvc
from app.services.facts import load_rules

CELLS = ("pgrc", "vigilance", "grants")
KIND_LABEL = {"joint_fdr": "Joint FDR", "rpgf": "RPGF", "rtgs": "RTGS"}


@dataclass
class CaseBundle:
    case: ReleaseCase
    institution: Institution
    instruments: list[Instrument]
    clearances: list[Clearance]


async def load(db: AsyncSession, case_id: int) -> CaseBundle | None:
    case = await db.get(ReleaseCase, case_id)
    if case is None:
        return None
    inst = await db.get(Institution, case.institution_id)
    assert inst is not None
    instruments = list(
        (
            await db.scalars(
                select(Instrument)
                .join(ReleaseCaseInstrument, ReleaseCaseInstrument.instrument_id == Instrument.id)
                .where(ReleaseCaseInstrument.release_case_id == case.id)
                .order_by(Instrument.id)
            )
        ).all()
    )
    clearances = list(
        (
            await db.scalars(
                select(Clearance).where(Clearance.release_case_id == case.id).order_by(Clearance.id)
            )
        ).all()
    )
    return CaseBundle(case, inst, instruments, clearances)


async def open_complaints(db: AsyncSession, institution_id: int) -> list[Complaint]:
    return list(
        (
            await db.scalars(
                select(Complaint)
                .where(
                    Complaint.institution_id == institution_id,
                    Complaint.status == "open",
                    Complaint.cell == "pgrc",
                )
                .order_by(Complaint.opened_on)
            )
        ).all()
    )


def penalty_record(found: list[Penalty]) -> dict[str, Any]:
    """What the rules say is due; settling it is recorded by an officer."""
    if not found:
        return {}
    return {
        "due_paise": sum(p.amount_paise for p in found),
        "items": [
            {
                "code": p.code,
                "amount_paise": p.amount_paise,
                "fraction": p.fraction,
                "reason": p.reason,
                "aph_ref": p.aph_ref,
            }
            for p in found
        ],
    }


def context(
    b: CaseBundle,
    as_of: date,
    complaints: int,
    documents: frozenset[str] | None = None,
) -> ReleaseContext:
    flags = b.institution.flags or {}
    penalty = b.case.penalty or {}
    due = 0 if penalty.get("settled_on") else int(penalty.get("due_paise", 0))
    return ReleaseContext(
        kind=InstrumentKind(b.case.kind),
        maturity_date=max(i.maturity_date for i in b.instruments),
        as_of=as_of,
        documents=documents if documents is not None else frozenset(b.case.documents),
        clearances={c.cell: c.status for c in b.clearances},
        clearance_reasons={c.cell: c.reason or "" for c in b.clearances},
        open_complaints=complaints,
        lien_hold=any(i.lien_hold_since and not i.lien_lifted_on for i in b.instruments),
        embezzlement_noc_pending=bool(flags.get("embezzlement_noc_pending")),
        penalties_due_paise=due,
        progressive_closure=bool(flags.get("progressive_closure")),
        no_students_certificate=bool(flags.get("no_students_certificate")),
        converted_to_university=bool(flags.get("converted_to_university")),
        disciplinary_pending=bool(flags.get("disciplinary_pending")),
    )


async def eligibility(db: AsyncSession, b: CaseBundle, as_of: date) -> Eligibility:
    rules = await load_rules(db)
    n = len(await open_complaints(db, b.institution.id))
    return evaluate_release(context(b, as_of, n), rules.release)


def _event(case: ReleaseCase, type_: str, actor_id: int | None, on: date, **payload: Any) -> Event:
    return Event(
        entity_type="release_case",
        entity_id=case.id,
        type=type_,
        payload=payload,
        actor_id=actor_id,
        occurred_on=on,
    )


def recompute_status(b: CaseBundle) -> None:
    """Case status while clearances are still being collected."""
    if b.case.status not in ("applied", "in_clearance", "blocked", "cleared"):
        return
    states = {c.status for c in b.clearances}
    if "blocked" in states:
        b.case.status = "blocked"
    elif states == {"cleared"}:
        b.case.status = "cleared"
    else:
        b.case.status = "in_clearance"


async def apply(
    db: AsyncSession,
    *,
    institution: Institution,
    instruments: list[Instrument],
    documents: list[str],
    actor: User,
    on: date,
) -> ReleaseCase:
    kinds = {i.kind for i in instruments}
    if len(kinds) != 1:
        raise ValueError("Apply separately for each type of deposit.")
    rules = await load_rules(db)
    flags = institution.flags or {}
    found = applicable_penalties(
        sum(i.amount_paise for i in instruments),
        any(i.encashed_on for i in instruments),
        bool(flags.get("closure_incomplete")),
        bool(flags.get("no_eoa_application_six_years")),
        rules.penalty,
    )
    # One application per instrument, so the first instrument's id makes the reference unique.
    case = ReleaseCase(
        reference=f"REL/{on:%Y}/{instruments[0].id:06d}",
        institution_id=institution.id,
        kind=kinds.pop(),
        status="in_clearance",
        documents=sorted(set(documents)),
        penalty=penalty_record(found),
        applied_on=on,
    )
    db.add(case)
    await db.flush()
    for i in instruments:
        db.add(ReleaseCaseInstrument(release_case_id=case.id, instrument_id=i.id))
        i.release_requested_on = on
        i.status = Status.RELEASE_REQUESTED.value
        i.next_action, i.next_action_due = "Collect clearances for release", None
        db.add(
            Event(
                entity_type="instrument",
                entity_id=i.id,
                type="release.requested",
                payload={"case": case.reference},
                actor_id=actor.id,
                occurred_on=on,
            )
        )
    for cell in CELLS:
        db.add(Clearance(release_case_id=case.id, cell=cell, status="pending"))
    db.add(_event(case, "release.applied", actor.id, on, instruments=[i.id for i in instruments]))
    await psvc.bump_data_version(db)
    await audit.append(
        db,
        actor_id=actor.id,
        actor_label=f"{actor.name} ({actor.role})",
        action="release.applied",
        entity_type="release_case",
        entity_id=case.id,
        data={"reference": case.reference, "instruments": [i.id for i in instruments]},
    )
    return case


async def decide_clearance(
    db: AsyncSession,
    b: CaseBundle,
    cell: str,
    decision: str,
    reason: str,
    actor: User,
    on: date,
) -> Clearance:
    clearance = next(c for c in b.clearances if c.cell == cell)
    clearance.status = "cleared" if decision == "clear" else "blocked"
    clearance.reason = reason
    clearance.officer_id = actor.id
    clearance.decided_on = on
    recompute_status(b)
    db.add(_event(b.case, f"clearance.{clearance.status}", actor.id, on, cell=cell, reason=reason))
    await audit.append(
        db,
        actor_id=actor.id,
        actor_label=f"{actor.name} ({actor.role})",
        action=f"clearance.{clearance.status}",
        entity_type="release_case",
        entity_id=b.case.id,
        data={"cell": cell},
        note=reason,
    )
    return clearance


def _recipient(b: CaseBundle, bank: Bank) -> str:
    first = b.instruments[0]
    if b.case.kind == InstrumentKind.RTGS:
        return "The Accounts Officer\nAccounts Section, AICTE\nNew Delhi"
    return f"The Branch Manager\n{bank.name}, {first.branch} (IFSC {first.ifsc})"


async def authorise(
    db: AsyncSession,
    b: CaseBundle,
    elig: Eligibility,
    actor: User,
    actor_label: str,
    note: str | None,
    on: date,
) -> tuple[Any, list[bank_svc.Outcome]]:
    """Issues the NOC or sanction order and asks each bank to discharge its lien."""
    case = b.case
    case.status = "authorised"
    case.authorised_by = actor.id
    case.authorised_on = on
    first = b.instruments[0]
    bank = await db.get(Bank, first.bank_id)
    assert bank is not None
    for i in b.instruments:
        i.release_cleared_on = on
        i.status = Status.RELEASE_CLEARED.value
        i.next_action, i.next_action_due = "Await bank discharge", None
        db.add(
            Event(
                entity_type="instrument",
                entity_id=i.id,
                type="release.cleared",
                payload={"case": case.reference},
                actor_id=actor.id,
                occurred_on=on,
            )
        )
    kind = "release_sanction" if case.kind == InstrumentKind.RTGS else "release_noc"
    total = sum(i.amount_paise for i in b.instruments)
    letter = await letters.issue(
        db,
        kind=kind,
        entity_type="release_case",
        entity_id=case.id,
        institution_id=b.institution.id,
        recipient=_recipient(b, bank),
        fields={
            "case_reference": case.reference,
            "institution": b.institution.name,
            "trust": b.institution.trust_name,
            "aicte_id": b.institution.aicte_id,
            "address": f"{b.institution.city}, {b.institution.state}",
            "amount_paise": str(total),
            "instruments": [
                {
                    "number": i.number,
                    "kind_label": KIND_LABEL.get(i.kind, i.kind),
                    "bank": i.bank.name,
                    "branch": i.branch,
                    "issue_date": i.issue_date.isoformat(),
                    "maturity_date": i.maturity_date.isoformat(),
                    "amount_paise": str(i.amount_paise),
                }
                for i in b.instruments
            ],
            "checks": [{"label": c.label, "aph_ref": c.aph_ref} for c in elig.checks],
            "authority": {"name": actor.name, "designation": actor.designation},
        },
        actor_id=actor.id,
        actor_label=actor_label,
        on=on,
    )
    await psvc.bump_data_version(db)
    db.add(_event(case, "release.authorised", actor.id, on, letter=letter.reference, note=note))
    await audit.append(
        db,
        actor_id=actor.id,
        actor_label=actor_label,
        action="release.authorised",
        entity_type="release_case",
        entity_id=case.id,
        data={"letter": letter.reference, "authority": elig.authority},
        note=note,
    )
    outcomes = []
    if case.kind != InstrumentKind.RTGS:
        for i in b.instruments:
            outcomes.append(
                await bank_svc.create_request(db, i, "discharge", actor.id, actor_label)
            )
    else:
        # RTGS deposits sit with AICTE, so the sanction order itself completes the release.
        for i in b.instruments:
            i.released_on = on
            i.status = Status.RELEASED.value
            i.next_action = None
        case.status, case.closed_on = "closed", on
    return letter, outcomes


async def after_discharge(db: AsyncSession, instrument_id: int, on: date) -> None:
    """Closes the case once every instrument in it has been discharged by its bank."""
    case_id = await db.scalar(
        select(ReleaseCaseInstrument.release_case_id).where(
            ReleaseCaseInstrument.instrument_id == instrument_id
        )
    )
    if case_id is None:
        return
    b = await load(db, case_id)
    if b is None or b.case.status not in ("authorised", "discharged"):
        return
    if all(i.released_on for i in b.instruments):
        b.case.status, b.case.closed_on = "closed", on
        db.add(_event(b.case, "release.discharged", None, on))
