"""Rule tests. Each case cites the APH 2024-27 provision it checks."""

from datetime import date

import pytest

from app.domain.rules.deadlines import furnishing_status
from app.domain.rules.demand import PAISE_PER_LAKH, ProgrammeLevel, compute_demand
from app.domain.rules.maturity import escalation_level, reminder_schedule, reminders_between
from app.domain.rules.params import RuleSet
from app.domain.rules.penalty import applicable_penalties
from app.domain.rules.release import CheckState, ReleaseContext, evaluate_release
from app.domain.types import InstrumentKind, Ownership, Premises

R = RuleSet()


class TestDemand:
    """Clause 1.12 and Table 1.4."""

    def test_engineering_ug_and_pg_own_premises(self) -> None:
        result = compute_demand(
            [
                ProgrammeLevel("engineering_technology", "ug"),
                ProgrammeLevel("engineering_technology", "pg"),
            ],
            Premises.OWN,
            Ownership.PRIVATE,
            0,
            True,
            R.demand,
        )
        assert result.total_paise == 50 * PAISE_PER_LAKH
        assert [line.amount_paise for line in result.lines] == [
            35 * PAISE_PER_LAKH,
            15 * PAISE_PER_LAKH,
        ]

    def test_leased_premises_doubles_each_line(self) -> None:
        result = compute_demand(
            [ProgrammeLevel("management", "pg")],
            Premises.LEASED,
            Ownership.PRIVATE,
            0,
            True,
            R.demand,
        )
        assert result.total_paise == 30 * PAISE_PER_LAKH
        assert result.lines[0].multiplier == 2

    def test_duplicate_programme_levels_count_once(self) -> None:
        result = compute_demand(
            [ProgrammeLevel("design", "ug"), ProgrammeLevel("design", "ug")],
            Premises.OWN,
            Ownership.PRIVATE,
            0,
            True,
            R.demand,
        )
        assert result.total_paise == 15 * PAISE_PER_LAKH

    @pytest.mark.parametrize("ownership", [Ownership.GOVERNMENT, Ownership.AIDED])
    def test_government_and_aided_are_exempt(self, ownership: Ownership) -> None:
        result = compute_demand(
            [ProgrammeLevel("engineering_technology", "ug")],
            Premises.OWN,
            ownership,
            0,
            True,
            R.demand,
        )
        assert result.exempt and result.total_paise == 0

    def test_existing_institution_over_five_years_is_exempt(self) -> None:
        result = compute_demand(
            [ProgrammeLevel("engineering_technology", "ug")],
            Premises.OWN,
            Ownership.PRIVATE,
            6,
            False,
            R.demand,
        )
        assert result.exempt

    def test_level_without_rate_is_rejected(self) -> None:
        with pytest.raises(ValueError, match=r"No Table 1.4 amount"):
            compute_demand(
                [ProgrammeLevel("management", "diploma")],
                Premises.OWN,
                Ownership.PRIVATE,
                0,
                True,
                R.demand,
            )


class TestFurnishingDeadline:
    """Chapter II item f: 15 days, then 10% to 31 May, 20% to 31 July, then withdrawal."""

    amount = 35 * PAISE_PER_LAKH

    def test_within_fifteen_days_has_no_penalty(self) -> None:
        s = furnishing_status(
            date(2027, 4, 1), date(2027, 4, 16), date(2027, 4, 16), self.amount, R.deadline
        )
        assert s.due_on == date(2027, 4, 16)
        assert s.penalty_paise == 0 and not s.withdrawn

    def test_late_before_31_may_is_ten_percent(self) -> None:
        s = furnishing_status(
            date(2027, 4, 1), date(2027, 5, 20), date(2027, 5, 20), self.amount, R.deadline
        )
        assert s.penalty_fraction == 0.10
        assert s.penalty_paise == self.amount // 10

    def test_late_in_june_or_july_is_twenty_percent(self) -> None:
        s = furnishing_status(
            date(2027, 4, 1), date(2027, 7, 31), date(2027, 7, 31), self.amount, R.deadline
        )
        assert s.penalty_fraction == 0.20

    def test_after_31_july_approval_is_withdrawn(self) -> None:
        s = furnishing_status(date(2027, 4, 1), None, date(2027, 8, 1), self.amount, R.deadline)
        assert s.withdrawn


class TestMaturity:
    def test_ladder_then_weekly_overdue(self) -> None:
        maturity = date(2027, 3, 31)
        schedule = reminder_schedule(maturity, date(2027, 4, 15), R.maturity)
        offsets = [r.offset_days for r in schedule]
        assert offsets == [90, 60, 30, 15, 7, 0, -7, -14]
        assert schedule[0].due_on == date(2026, 12, 31)

    def test_reminders_between_window(self) -> None:
        found = reminders_between(
            date(2027, 3, 31), date(2027, 3, 1), date(2027, 3, 31), R.maturity
        )
        assert [r.offset_days for r in found] == [30, 15, 7, 0]

    @pytest.mark.parametrize(
        ("days", "level"),
        [
            (-1, None),
            (0, "dealing_officer"),
            (14, "dealing_officer"),
            (15, "section_head"),
            (45, "deputy_director"),
            (90, "director"),
        ],
    )
    def test_escalation_levels(self, days: int, level: str | None) -> None:
        assert escalation_level(days, R.escalation) == level


class TestPenalties:
    def test_premature_encashment_is_ten_percent(self) -> None:
        """Clause 7.7."""
        [p] = applicable_penalties(15 * PAISE_PER_LAKH, True, False, False, R.penalty)
        assert p.amount_paise == round(1.5 * PAISE_PER_LAKH)

    def test_six_year_closure_takes_precedence_over_incomplete_closure(self) -> None:
        """Clause 2.21 h and i."""
        [p] = applicable_penalties(10 * PAISE_PER_LAKH, False, True, True, R.penalty)
        assert p.code == "closure_not_applied" and p.fraction == 0.50


def _ctx(**overrides: object) -> ReleaseContext:
    base: dict[str, object] = {
        "kind": InstrumentKind.JOINT_FDR,
        "maturity_date": date(2026, 6, 30),
        "as_of": date(2026, 10, 24),
        "documents": frozenset(
            {"application_letter", "affidavit_6", "instrument_copy", "latest_loa_eoa"}
        ),
        "clearances": {"pgrc": "cleared", "vigilance": "cleared", "grants": "cleared"},
        "open_complaints": 0,
        "lien_hold": False,
        "embezzlement_noc_pending": False,
        "penalties_due_paise": 0,
    }
    base.update(overrides)
    return ReleaseContext(**base)  # type: ignore[arg-type]


class TestRelease:
    """Clause 6.46."""

    def test_all_conditions_met_is_ready(self) -> None:
        e = evaluate_release(_ctx(), R.release)
        assert e.ready_for_authorisation and not e.blocked
        assert e.authority == "NOC by the Approval Bureau"

    def test_rtgs_needs_council_sanction(self) -> None:
        assert evaluate_release(_ctx(kind=InstrumentKind.RTGS), R.release).authority.startswith(
            "Sanction"
        )

    def test_open_pgrc_complaint_keeps_case_pending(self) -> None:
        e = evaluate_release(
            _ctx(
                open_complaints=1,
                clearances={"pgrc": "pending", "vigilance": "cleared", "grants": "cleared"},
            ),
            R.release,
        )
        pgrc = next(c for c in e.checks if c.code == "clearance_pgrc")
        assert pgrc.state == CheckState.PENDING and "open complaint" in pgrc.detail
        assert not e.ready_for_authorisation

    def test_not_matured_fails(self) -> None:
        e = evaluate_release(_ctx(as_of=date(2026, 1, 1)), R.release)
        assert e.blocked

    def test_progressive_closure_with_certificate_allows_early_release(self) -> None:
        e = evaluate_release(
            _ctx(as_of=date(2026, 1, 1), progressive_closure=True, no_students_certificate=True),
            R.release,
        )
        assert next(c for c in e.checks if c.code == "term_complete").state == CheckState.PASS

    @pytest.mark.parametrize(
        "override",
        [
            {"lien_hold": True},
            {"embezzlement_noc_pending": True},
            {"clearances": {"pgrc": "cleared", "vigilance": "blocked", "grants": "cleared"}},
            {"converted_to_university": True, "disciplinary_pending": True},
        ],
    )
    def test_any_blocker_prevents_authorisation(self, override: dict[str, object]) -> None:
        e = evaluate_release(_ctx(**override), R.release)
        assert e.blocked and not e.ready_for_authorisation

    def test_missing_documents_are_listed(self) -> None:
        e = evaluate_release(_ctx(documents=frozenset({"application_letter"})), R.release)
        docs = next(c for c in e.checks if c.code == "documents")
        assert docs.state == CheckState.PENDING and "Affidavit 6" in docs.detail
