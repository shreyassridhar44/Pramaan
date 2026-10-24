"""Furnishing deadline and late-furnishing penalty (APH 2024-27 Chapter II, item f)."""

from dataclasses import dataclass
from datetime import date, timedelta

from app.domain.rules.params import DeadlineRules


@dataclass(frozen=True, slots=True)
class FurnishingStatus:
    due_on: date
    days_left: int
    penalty_fraction: float
    penalty_paise: int
    withdrawn: bool
    explanation: str
    aph_ref: str


def slab_date(due: date, month: int, day: int) -> date:
    """The slab's calendar date on or after the due date. The APH names 31 May and 31 July of the
    calendar year, written for intimations in the April to June cycle; for a demand due later in
    the year we take the next occurrence (assumption, see PROJECT.md Section 13)."""
    candidate = date(due.year, month, day)
    return candidate if candidate >= due else date(due.year + 1, month, day)


def furnishing_status(
    intimated_on: date,
    furnished_on: date | None,
    as_of: date,
    amount_paise: int,
    rules: DeadlineRules,
) -> FurnishingStatus:
    """Deadline is `furnish_within_days` after intimation. If furnished (or still unfurnished
    as of a date) after the deadline, the penalty slab is taken from the calendar year of the
    deadline: 10% up to 31 May, 20% up to 31 July, after which approval is withdrawn.
    """
    due = intimated_on + timedelta(days=rules.furnish_within_days)
    effective = furnished_on or as_of
    days_left = (due - as_of).days
    ref = rules.ref.aph_ref

    if effective <= due:
        return FurnishingStatus(due, days_left, 0.0, 0, False, "Within the deadline", ref)

    for (month, day), fraction in rules.slabs:
        slab_end = slab_date(due, month, day)
        if effective <= slab_end:
            penalty = round(amount_paise * fraction)
            text = f"After the deadline, up to {slab_end:%d %b}: {round(fraction * 100)}% penalty"
            return FurnishingStatus(due, days_left, fraction, penalty, False, text, ref)

    last_month, last_day = rules.slabs[-1][0]
    text = f"Not furnished by {slab_date(due, last_month, last_day):%d %b %Y}: approval withdrawn"
    return FurnishingStatus(due, days_left, 0.0, 0, True, text, ref)
