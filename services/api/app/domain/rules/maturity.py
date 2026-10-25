"""Maturity monitoring: reminder schedule and escalation level (reminder and escalation values are
team assumptions, configurable in the rules table)."""

from dataclasses import dataclass
from datetime import date, timedelta

from app.domain.rules.params import EscalationRules, MaturityRules


@dataclass(frozen=True, slots=True)
class Reminder:
    offset_days: int
    due_on: date
    overdue: bool


def reminder_schedule(maturity: date, until: date, rules: MaturityRules) -> list[Reminder]:
    """All reminders from the ladder before maturity, then periodic overdue reminders up to
    `until` (inclusive)."""
    schedule = [
        Reminder(offset, maturity - timedelta(days=offset), False)
        for offset in sorted(rules.reminder_offsets_days, reverse=True)
        if maturity - timedelta(days=offset) <= until
    ]
    step = rules.overdue_reminder_every_days
    when = maturity + timedelta(days=step)
    while when <= until:
        schedule.append(Reminder(-(when - maturity).days, when, True))
        when += timedelta(days=step)
    return schedule


def reminders_between(
    maturity: date, start: date, end: date, rules: MaturityRules
) -> list[Reminder]:
    """Reminders with a due date in [start, end]; the same as filtering `reminder_schedule`, but
    computed directly, so long-matured deposits do not regenerate years of overdue reminders."""
    out = [
        Reminder(offset, maturity - timedelta(days=offset), False)
        for offset in sorted(rules.reminder_offsets_days, reverse=True)
        if start <= maturity - timedelta(days=offset) <= end
    ]
    step = rules.overdue_reminder_every_days
    if step > 0 and end > maturity:
        k = max(1, -(-(start - maturity).days // step))  # first period on or after `start`
        when = maturity + timedelta(days=k * step)
        while when <= end:
            out.append(Reminder(-k * step, when, True))
            k += 1
            when += timedelta(days=step)
    return out


def escalation_level(days_overdue: int, rules: EscalationRules) -> str | None:
    """Highest ladder level whose threshold is met. None when not overdue."""
    if days_overdue < 0:
        return None
    level: str | None = None
    for threshold, name in rules.ladder:
        if days_overdue >= threshold:
            level = name
    return level
