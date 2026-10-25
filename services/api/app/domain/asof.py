"""The as-of engine: status, assurance, reminders and escalations for any date.

This is the only place that decides what an instrument's state is on a date. Normal screens call it
with today; the forecast calls it with future dates. Nothing here performs I/O.
"""

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, timedelta

from app.domain.assurance import EvidenceDates, assurance_on
from app.domain.rules.maturity import escalation_level, reminders_between
from app.domain.rules.params import RuleSet
from app.domain.types import Assurance, Status

HELD_STATUSES = frozenset(
    {
        Status.SUBMITTED,
        Status.UNDER_SCRUTINY,
        Status.DISCREPANCY,
        Status.RETURNED,
        Status.ACTIVE,
        Status.MATURING,
        Status.MATURED,
        Status.RENEWAL_PENDING,
        Status.RELEASE_REQUESTED,
        Status.RELEASE_CLEARED,
        Status.LIEN_HOLD,
    }
)
NEEDS_ACTION_AT_MATURITY = frozenset({Status.MATURED, Status.RENEWAL_PENDING})


@dataclass(frozen=True, slots=True)
class InstrumentFacts:
    """Dated facts about one instrument, loaded from the database."""

    id: int
    amount_paise: int
    maturity_date: date
    region: str
    bank: str
    owner_id: int | None
    submitted_on: date
    verified_on: date | None = None
    returned_on: date | None = None
    resubmitted_on: date | None = None
    release_requested_on: date | None = None
    release_cleared_on: date | None = None
    released_on: date | None = None
    renewed_on: date | None = None
    encashed_on: date | None = None
    forfeited_on: date | None = None
    lien_hold_since: date | None = None
    lien_lifted_on: date | None = None
    evidence: EvidenceDates = field(default_factory=EvidenceDates)


def _on_or_before(d: date | None, as_of: date) -> bool:
    return d is not None and d <= as_of


def status_on(f: InstrumentFacts, as_of: date, rules: RuleSet) -> Status | None:
    """None means the instrument did not exist yet on that date."""
    if f.submitted_on > as_of:
        return None
    for when, status in (
        (f.forfeited_on, Status.FORFEITED),
        (f.encashed_on, Status.ENCASHED_PREMATURELY),
        (f.released_on, Status.RELEASED),
        (f.renewed_on, Status.RENEWED),
    ):
        if _on_or_before(when, as_of):
            return status
    if _on_or_before(f.lien_hold_since, as_of) and not _on_or_before(f.lien_lifted_on, as_of):
        return Status.LIEN_HOLD
    if _on_or_before(f.release_cleared_on, as_of):
        return Status.RELEASE_CLEARED
    if _on_or_before(f.release_requested_on, as_of):
        return Status.RELEASE_REQUESTED

    ev = f.evidence
    conflict_open = _on_or_before(ev.conflict_since, as_of) and not _on_or_before(
        ev.conflict_resolved_on, as_of
    )
    if not _on_or_before(f.verified_on, as_of):
        # Returned outranks a conflict: the next move is the institution's, until it resubmits.
        returned = _on_or_before(f.returned_on, as_of)
        resubmitted = (
            returned
            and _on_or_before(f.resubmitted_on, as_of)
            and f.resubmitted_on >= f.returned_on  # type: ignore[operator]
        )
        if returned and not resubmitted:
            return Status.RETURNED
        if conflict_open:
            return Status.DISCREPANCY
        return Status.SUBMITTED
    if conflict_open:
        return Status.DISCREPANCY
    if as_of >= f.maturity_date:
        return Status.MATURED
    if (f.maturity_date - as_of).days <= rules.maturity.maturing_window_days:
        return Status.MATURING
    return Status.ACTIVE


@dataclass(frozen=True, slots=True)
class InstrumentState:
    id: int
    status: Status
    assurance: Assurance
    days_to_maturity: int
    escalation: str | None


def state_on(f: InstrumentFacts, as_of: date, rules: RuleSet) -> InstrumentState | None:
    status = status_on(f, as_of, rules)
    if status is None:
        return None
    assurance = assurance_on(f.evidence, as_of, rules.maturity.reconfirm_window_days)
    days = (f.maturity_date - as_of).days
    escalation = (
        escalation_level(-days, rules.escalation) if status in NEEDS_ACTION_AT_MATURITY else None
    )
    return InstrumentState(f.id, status, assurance, days, escalation)


@dataclass(slots=True)
class PortfolioSummary:
    as_of: date
    held_count: int = 0
    held_paise: int = 0
    by_assurance_paise: dict[int, int] = field(
        default_factory=lambda: {a.value: 0 for a in Assurance}
    )
    by_assurance_count: dict[int, int] = field(
        default_factory=lambda: {a.value: 0 for a in Assurance}
    )
    by_status_count: dict[str, int] = field(default_factory=dict)
    maturing_90_count: int = 0
    maturing_90_paise: int = 0
    overdue_count: int = 0
    discrepancy_count: int = 0
    pending_verification_count: int = 0
    escalations: dict[str, int] = field(default_factory=dict)
    by_region: dict[str, dict[str, int]] = field(default_factory=dict)
    by_bank_paise: dict[str, int] = field(default_factory=dict)


def summarise(facts: Iterable[InstrumentFacts], as_of: date, rules: RuleSet) -> PortfolioSummary:
    s = PortfolioSummary(as_of)
    status_counts: dict[str, int] = defaultdict(int)
    escalations: dict[str, int] = defaultdict(int)
    regions: dict[str, dict[str, int]] = defaultdict(
        lambda: {
            "held_paise": 0,
            "held_count": 0,
            "confirmed_paise": 0,
            "overdue": 0,
            "discrepancy": 0,
        }
    )
    banks: dict[str, int] = defaultdict(int)
    for f in facts:
        st = state_on(f, as_of, rules)
        if st is None or st.status not in HELD_STATUSES:
            continue
        status_counts[st.status] += 1
        s.held_count += 1
        s.held_paise += f.amount_paise
        s.by_assurance_paise[st.assurance.value] += f.amount_paise
        s.by_assurance_count[st.assurance.value] += 1
        region = regions[f.region]
        region["held_paise"] += f.amount_paise
        region["held_count"] += 1
        banks[f.bank] += f.amount_paise
        if st.assurance >= Assurance.BANK_CONFIRMED:
            region["confirmed_paise"] += f.amount_paise
        if st.status == Status.MATURING:
            s.maturing_90_count += 1
            s.maturing_90_paise += f.amount_paise
        if st.status in NEEDS_ACTION_AT_MATURITY:
            s.overdue_count += 1
            region["overdue"] += 1
        if st.escalation:
            escalations[st.escalation] += 1
        if st.status == Status.DISCREPANCY:
            s.discrepancy_count += 1
            region["discrepancy"] += 1
        if st.status in (Status.SUBMITTED, Status.UNDER_SCRUTINY):
            s.pending_verification_count += 1
    s.by_status_count = dict(status_counts)
    s.escalations = dict(escalations)
    s.by_region = dict(regions)
    s.by_bank_paise = dict(banks)
    return s


@dataclass(frozen=True, slots=True)
class TimelineEvent:
    on: date
    kind: str  # "reminder", "matured", "escalated"
    instrument_id: int
    region: str
    detail: str


@dataclass(frozen=True, slots=True)
class TimelineStep:
    start: date
    end: date
    summary: PortfolioSummary
    events: tuple[TimelineEvent, ...]


def timeline(
    facts: list[InstrumentFacts], start: date, weeks: int, rules: RuleSet
) -> list[TimelineStep]:
    """Weekly snapshots plus the events that fall inside each week.

    Reminders and escalations are only generated for instruments still awaiting action on that
    date, so an instrument already renewed or released produces no further events.
    """
    steps: list[TimelineStep] = []
    ladder = rules.escalation.ladder
    for w in range(weeks):
        wk_start = start + timedelta(days=7 * w)
        wk_end = wk_start + timedelta(days=6)
        events: list[TimelineEvent] = []
        for f in facts:
            st = state_on(f, wk_end, rules)
            if (
                st is None
                or st.status not in HELD_STATUSES
                or st.status
                in (
                    Status.RELEASE_REQUESTED,
                    Status.RELEASE_CLEARED,
                )
            ):
                continue
            for r in reminders_between(f.maturity_date, wk_start, wk_end, rules.maturity):
                label = f"T-{r.offset_days}" if not r.overdue else f"overdue {-r.offset_days} days"
                events.append(TimelineEvent(r.due_on, "reminder", f.id, f.region, label))
            if wk_start <= f.maturity_date <= wk_end:
                events.append(TimelineEvent(f.maturity_date, "matured", f.id, f.region, "matured"))
            for threshold, name in ladder:
                if threshold == 0:
                    continue
                crossing = f.maturity_date + timedelta(days=threshold)
                if wk_start <= crossing <= wk_end:
                    events.append(TimelineEvent(crossing, "escalated", f.id, f.region, name))
        events.sort(key=lambda e: (e.on, e.kind, e.instrument_id))
        steps.append(TimelineStep(wk_start, wk_end, summarise(facts, wk_end, rules), tuple(events)))
    return steps
