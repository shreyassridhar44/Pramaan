"""The direct reminder computation matches filtering the full schedule, for any window."""

from datetime import date, timedelta

from hypothesis import given
from hypothesis import strategies as st

from app.domain.rules.maturity import reminder_schedule, reminders_between
from app.domain.rules.params import MaturityRules

RULES = MaturityRules()
DAY = st.integers(min_value=-4000, max_value=4000)


@given(maturity_offset=DAY, start_offset=DAY, length=st.integers(min_value=0, max_value=60))
def test_between_matches_filtered_schedule(
    maturity_offset: int, start_offset: int, length: int
) -> None:
    base = date(2026, 10, 25)
    maturity = base + timedelta(days=maturity_offset)
    start = base + timedelta(days=start_offset)
    end = start + timedelta(days=length)
    expected = [r for r in reminder_schedule(maturity, end, RULES) if start <= r.due_on <= end]
    assert reminders_between(maturity, start, end, RULES) == expected
