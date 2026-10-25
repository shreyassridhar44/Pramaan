"""Changes to declared values: officer corrections with a reason, and institution resubmissions.

Every change adds a new declared observation; the earlier value stays in the history, and the
extracted and bank-confirmed values are never touched (PROJECT.md F4, FR13).
"""

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.provenance import Observation, compare_field, display, normalise
from app.domain.types import FieldName, MatchState, Source
from app.models import FieldObservation, Instrument

# Number and bank identify the deposit; changing them means a different instrument.
CORRECTABLE: tuple[FieldName, ...] = (
    FieldName.IFSC,
    FieldName.AMOUNT,
    FieldName.ISSUE_DATE,
    FieldName.MATURITY_DATE,
    FieldName.HOLDERS,
    FieldName.LIEN,
)


@dataclass
class Change:
    field: FieldName
    old: str | None
    new: str


async def _latest_declared(
    db: AsyncSession, inst: Instrument, field: FieldName
) -> FieldObservation | None:
    return await db.scalar(
        select(FieldObservation)
        .where(
            FieldObservation.instrument_id == inst.id,
            FieldObservation.field == field.value,
            FieldObservation.source == Source.DECLARED.value,
        )
        .order_by(FieldObservation.observed_on.desc(), FieldObservation.id.desc())
        .limit(1)
    )


def _apply(inst: Instrument, field: FieldName, norm: str) -> None:
    """Keeps the instrument's current-value columns in step with the latest declared value."""
    if field == FieldName.AMOUNT:
        inst.amount_paise = int(norm)
    elif field == FieldName.ISSUE_DATE:
        inst.issue_date = date.fromisoformat(norm)
    elif field == FieldName.MATURITY_DATE:
        inst.maturity_date = date.fromisoformat(norm)
    elif field == FieldName.IFSC:
        inst.ifsc = norm


async def declare(
    db: AsyncSession,
    inst: Instrument,
    field: FieldName,
    raw: str,
    *,
    evidence_type: str,
    actor_id: int | None,
    note: str | None,
    on: date,
) -> Change | None:
    """Records a new declared value. Returns None when it equals the current one; raises
    ValueError when the value cannot be read."""
    norm = normalise(field, raw)
    current = await _latest_declared(db, inst, field)
    if current is not None and current.value_norm == norm:
        return None
    db.add(
        FieldObservation(
            instrument_id=inst.id,
            field=field.value,
            source=Source.DECLARED.value,
            value_raw=raw.strip()[:400],
            value_norm=norm,
            evidence_type=evidence_type,
            actor_id=actor_id,
            note=note,
            observed_on=on,
        )
    )
    _apply(inst, field, norm)
    old = display(field, current.value_norm) if current is not None else None
    return Change(field, old, display(field, norm))


async def refresh_conflict(db: AsyncSession, inst: Instrument, on: date) -> bool:
    """Re-evaluates whether any field conflicts after a change. Returns True if one still does."""
    await db.flush()
    rows = (
        await db.scalars(select(FieldObservation).where(FieldObservation.instrument_id == inst.id))
    ).all()
    observations = [
        Observation(FieldName(o.field), Source(o.source), o.value_norm, o.observed_on) for o in rows
    ]
    conflict = any(
        compare_field(f, observations, on).state == MatchState.CONFLICT for f in FieldName
    )
    if conflict and (inst.conflict_since is None or inst.conflict_resolved_on):
        inst.conflict_since, inst.conflict_resolved_on = on, None
    elif not conflict and inst.conflict_since and not inst.conflict_resolved_on:
        inst.conflict_resolved_on = on
    return conflict
