"""Portfolio computations for the command view, registry and forecast.

Facts are loaded once per data version and cached in process; every figure is then computed by the
as-of engine for the requested date and the principal's scope.
"""

import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.asof import (
    HELD_STATUSES,
    InstrumentFacts,
    InstrumentState,
    PortfolioSummary,
    TimelineStep,
    state_on,
    summarise,
    timeline,
)
from app.domain.rules.params import RuleSet
from app.domain.types import Assurance, Role, Status
from app.models import Bank, DataVersion, Institution, Instrument, Region, Reminder, User
from app.services.facts import load_facts, load_rules


@dataclass
class _Cache:
    version: int = -1
    facts: list[InstrumentFacts] | None = None
    rules: RuleSet | None = None
    timelines: dict[tuple[str, date, int], list[TimelineStep]] | None = None


_cache = _Cache()


async def data_version(session: AsyncSession) -> int:
    return int(await session.scalar(select(DataVersion.version).where(DataVersion.id == 1)) or 0)


async def bump_data_version(session: AsyncSession) -> None:
    row = await session.get(DataVersion, 1)
    if row is not None:
        row.version += 1


async def _load(session: AsyncSession) -> tuple[list[InstrumentFacts], RuleSet]:
    version = await data_version(session)
    if _cache.version != version or _cache.facts is None or _cache.rules is None:
        _cache.facts = await load_facts(session)
        _cache.rules = await load_rules(session)
        _cache.timelines = {}
        _cache.version = version
    return _cache.facts, _cache.rules


@dataclass(frozen=True, slots=True)
class Scope:
    """What part of the portfolio a principal may see."""

    key: str
    region: str | None = None
    institution_id: int | None = None
    bank: str | None = None


async def scope_for(session: AsyncSession, user: User) -> Scope:
    role = Role(user.role)
    if role == Role.REGIONAL_OFFICER and user.region_id:
        code = await session.scalar(select(Region.code).where(Region.id == user.region_id))
        return Scope(f"region:{code}", region=code)
    if role == Role.INSTITUTION_USER:
        return Scope(f"inst:{user.institution_id}", institution_id=user.institution_id)
    if role == Role.BANK_OFFICER and user.bank_id:
        code = await session.scalar(select(Bank.code).where(Bank.id == user.bank_id))
        return Scope(f"bank:{code}", bank=code)
    return Scope("all")


async def scoped_facts(
    session: AsyncSession, scope: Scope
) -> tuple[list[InstrumentFacts], RuleSet]:
    facts, rules = await _load(session)
    if scope.key == "all":
        return facts, rules
    if scope.region:
        return [f for f in facts if f.region == scope.region], rules
    if scope.bank:
        return [f for f in facts if f.bank == scope.bank], rules
    if scope.institution_id is not None:
        ids = set(
            (
                await session.scalars(
                    select(Instrument.id).where(Instrument.institution_id == scope.institution_id)
                )
            ).all()
        )
        return [f for f in facts if f.id in ids], rules
    return [], rules


async def summary(session: AsyncSession, scope: Scope, as_of: date) -> PortfolioSummary:
    facts, rules = await scoped_facts(session, scope)
    return summarise(facts, as_of, rules)


async def states(session: AsyncSession, scope: Scope, as_of: date) -> dict[int, InstrumentState]:
    facts, rules = await scoped_facts(session, scope)
    out: dict[int, InstrumentState] = {}
    for f in facts:
        st = state_on(f, as_of, rules)
        if st is not None:
            out[f.id] = st
    return out


async def river(
    session: AsyncSession, scope: Scope, as_of: date, months: int
) -> list[dict[str, Any]]:
    """Value maturing per week for the coming months, split by assurance level on `as_of`."""
    facts, rules = await scoped_facts(session, scope)
    start = as_of - timedelta(days=as_of.weekday())
    end = as_of + timedelta(days=round(months * 30.44))
    weeks: dict[date, dict[int, int]] = {}
    w = start
    while w <= end:
        weeks[w] = {a.value: 0 for a in Assurance}
        w += timedelta(days=7)
    counts: dict[date, int] = defaultdict(int)
    for f in facts:
        if not (as_of <= f.maturity_date <= end):
            continue
        st = state_on(f, as_of, rules)
        if (
            st is None
            or st.status not in HELD_STATUSES
            or st.status in (Status.RELEASE_REQUESTED, Status.RELEASE_CLEARED)
        ):
            continue
        wk = f.maturity_date - timedelta(days=f.maturity_date.weekday())
        if wk in weeks:
            weeks[wk][st.assurance.value] += f.amount_paise
            counts[wk] += 1
    return [
        {
            "week": wk.isoformat(),
            "count": counts[wk],
            "by_assurance_paise": {str(k): str(v) for k, v in vals.items()},
        }
        for wk, vals in weeks.items()
    ]


async def region_rows(session: AsyncSession, scope: Scope, as_of: date) -> list[dict[str, Any]]:
    s = await summary(session, scope, as_of)
    regions = (await session.scalars(select(Region).order_by(Region.id))).all()
    rows = []
    for r in regions:
        agg = s.by_region.get(r.code)
        if agg is None and scope.key != "all":
            continue
        agg = agg or {
            "held_paise": 0,
            "held_count": 0,
            "confirmed_paise": 0,
            "overdue": 0,
            "discrepancy": 0,
        }
        rows.append(
            {
                "code": r.code,
                "name": r.name,
                "office_city": r.office_city,
                "camp": r.is_camp_office,
                "lat": r.lat,
                "lng": r.lng,
                "held_paise": str(agg["held_paise"]),
                "held_count": agg["held_count"],
                "confirmed_paise": str(agg["confirmed_paise"]),
                "overdue": agg["overdue"],
                "discrepancy": agg["discrepancy"],
            }
        )
    return rows


_SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}
_KIND_RANK = {"discrepancy": 0, "overdue": 1, "maturing": 2, "verification": 3, "discharge": 4}


async def action_queue(
    session: AsyncSession, scope: Scope, as_of: date, limit: int
) -> list[dict[str, Any]]:
    """The next things to do, ranked by severity then due date."""
    facts, rules = await scoped_facts(session, scope)
    items: list[dict[str, Any]] = []
    for f in facts:
        st = state_on(f, as_of, rules)
        if st is None:
            continue
        item: dict[str, Any] | None = None
        if st.status == Status.DISCREPANCY:
            item = {
                "kind": "discrepancy",
                "severity": "high",
                "title": "Resolve a mismatch with the bank record",
                "due": as_of,
            }
        elif st.status == Status.MATURED:
            days = -st.days_to_maturity
            item = {
                "kind": "overdue",
                "severity": "high" if days > 30 else "medium",
                "title": f"Matured {days} days ago with no release application or renewal",
                "due": f.maturity_date + timedelta(days=15),
                "escalation": st.escalation,
            }
        elif st.status == Status.MATURING and st.days_to_maturity <= 30:
            item = {
                "kind": "maturing",
                "severity": "medium",
                "title": f"Matures in {st.days_to_maturity} days: confirm renewal or release plan",
                "due": f.maturity_date,
            }
        elif st.status in (Status.SUBMITTED, Status.UNDER_SCRUTINY):
            age = (as_of - f.submitted_on).days
            item = {
                "kind": "verification",
                "severity": "medium" if age > 7 else "low",
                "title": f"Submission waiting for scrutiny ({age} days)",
                "due": f.submitted_on + timedelta(days=7),
            }
        elif st.status == Status.RELEASE_CLEARED:
            item = {
                "kind": "discharge",
                "severity": "low",
                "title": "Cleared for release: awaiting bank lien discharge",
                "due": as_of + timedelta(days=7),
            }
        if item:
            item.update(
                {
                    "instrument_id": f.id,
                    "amount_paise": str(f.amount_paise),
                    "owner_id": f.owner_id,
                    "region": f.region,
                    "status": st.status.value,
                }
            )
            items.append(item)
    # Severity first, then kind; within overdue items the most recently matured come first, because
    # a fresh escalation is more actionable than a years-old backlog entry.
    items.sort(
        key=lambda i: (
            _SEVERITY_RANK[i["severity"]],
            _KIND_RANK[i["kind"]],
            -i["due"].toordinal() if i["kind"] == "overdue" else i["due"].toordinal(),
        )
    )
    top = items[:limit]
    ids = [i["instrument_id"] for i in top]
    owner_ids = {i["owner_id"] for i in top if i["owner_id"]}
    rows = (
        await session.execute(
            select(Instrument.id, Instrument.number, Institution.name)
            .join(Institution, Institution.id == Instrument.institution_id)
            .where(Instrument.id.in_(ids))
        )
    ).all()
    meta = {r[0]: (r[1], r[2]) for r in rows}
    owners = dict(
        (await session.execute(select(User.id, User.name).where(User.id.in_(owner_ids)))).all()
    )
    for i in top:
        number, inst_name = meta.get(i["instrument_id"], ("", ""))
        i.update(
            {
                "number": number,
                "institution": inst_name,
                "owner": owners.get(i["owner_id"]),
                "due": i["due"].isoformat(),
            }
        )
    return top


async def timeline_steps(
    session: AsyncSession, scope: Scope, start: date, weeks: int
) -> list[TimelineStep]:
    facts, rules = await scoped_facts(session, scope)
    assert _cache.timelines is not None
    key = (scope.key, start, weeks)
    if key not in _cache.timelines:
        _cache.timelines[key] = timeline(facts, start, weeks, rules)
    return _cache.timelines[key]


async def impact(session: AsyncSession, scope: Scope, as_of: date) -> dict[str, Any]:
    """Product measures for R15, computed from the data (synthetic in this prototype)."""
    facts, rules = await scoped_facts(session, scope)
    window_start = as_of - timedelta(days=365)
    turnaround = sorted(
        (f.verified_on - f.submitted_on).days
        for f in facts
        if f.verified_on and window_start <= f.verified_on <= as_of
    )
    held = [f for f in facts if (st := state_on(f, as_of, rules)) and st.status in HELD_STATUSES]
    proven = [
        f for f in held if f.evidence.bank_confirmed_on and f.evidence.bank_confirmed_on <= as_of
    ]
    conflicted = [
        f
        for f in proven
        if f.evidence.conflict_since
        and f.evidence.conflict_since <= as_of
        and not (f.evidence.conflict_resolved_on and f.evidence.conflict_resolved_on <= as_of)
    ]
    needs_owner = [f for f in held if f.owner_id is None]
    ids = [f.id for f in facts]
    sent = await session.execute(
        select(func.count(), func.count().filter(Reminder.sent_on <= Reminder.due_on)).where(
            Reminder.instrument_id.in_(ids), Reminder.due_on <= as_of
        )
    )
    total_rem, on_time = sent.one()
    p90 = turnaround[int(0.9 * (len(turnaround) - 1))] if turnaround else None
    return {
        "data_source": "synthetic",
        "verification_turnaround_days": {
            "median": statistics.median(turnaround) if turnaround else None,
            "p90": p90,
            "sample": len(turnaround),
        },
        "field_agreement_rate": (1 - len(conflicted) / len(proven)) if proven else None,
        "bank_confirmed_share_by_count": len(proven) / len(held) if held else None,
        "reminders_on_time_rate": (on_time / total_rem) if total_rem else None,
        "reminders_sample": total_rem,
        "held_without_owner": len(needs_owner),
        "held_count": len(held),
    }
