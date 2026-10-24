from datetime import date, timedelta

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.domain.asof import InstrumentFacts, state_on, status_on, summarise, timeline
from app.domain.assurance import EvidenceDates, assurance_on
from app.domain.provenance import Observation, char_diff, compare_field, normalise
from app.domain.rules.params import RuleSet
from app.domain.state_machine import TransitionRefused, check_transition
from app.domain.types import Assurance, FieldName, MatchState, Role, Source, Status

R = RuleSet()
D = date(2026, 10, 24)


class TestNormalise:
    @pytest.mark.parametrize(
        ("field", "raw", "expected"),
        [
            (FieldName.AMOUNT, "Rs. 15,00,000/-", "150000000"),
            (FieldName.AMOUNT, "₹35,00,000.50", "350000050"),
            (FieldName.ISSUE_DATE, "12/03/2027", "2027-03-12"),
            (FieldName.ISSUE_DATE, "12 Mar 2027", "2027-03-12"),
            (FieldName.IFSC, "bhnx 0001234", "BHNX0001234"),
            (FieldName.NUMBER, "000-4512/77", "451277"),
            (
                FieldName.HOLDERS,
                "Member Secretary, AICTE & Shri R. K. Rao",
                "member secretary aicte | r k rao",
            ),
            (FieldName.LIEN, "Lien marked in favour of AICTE", "yes"),
        ],
    )
    def test_normalises_each_source_format(self, field: FieldName, raw: str, expected: str) -> None:
        assert normalise(field, raw) == expected

    def test_holder_order_does_not_matter(self) -> None:
        a = normalise(FieldName.HOLDERS, "Secretary, Sahyadri Trust; Member Secretary AICTE")
        b = normalise(FieldName.HOLDERS, "Member Secretary AICTE and Secretary Sahyadri Trust")
        assert a == b

    def test_rejects_non_amount(self) -> None:
        with pytest.raises(ValueError, match="not an amount"):
            normalise(FieldName.AMOUNT, "fifteen lakh")


class TestCompareField:
    def obs(self, source: Source, value: str, day: int = 1) -> Observation:
        return Observation(FieldName.AMOUNT, source, value, date(2026, 10, day))

    def test_declared_only_is_pending(self) -> None:
        c = compare_field(FieldName.AMOUNT, [self.obs(Source.DECLARED, "1")], D)
        assert c.state == MatchState.PENDING

    def test_bank_value_differs_is_conflict(self) -> None:
        c = compare_field(
            FieldName.AMOUNT,
            [self.obs(Source.DECLARED, "350000000"), self.obs(Source.CONFIRMED, "150000000")],
            D,
        )
        assert c.state == MatchState.CONFLICT
        assert c.declared == "350000000" and c.confirmed == "150000000"

    def test_declared_value_is_never_copied_to_confirmed(self) -> None:
        c = compare_field(FieldName.AMOUNT, [self.obs(Source.DECLARED, "1")], D)
        assert c.confirmed is None

    def test_observations_after_as_of_are_ignored(self) -> None:
        c = compare_field(
            FieldName.AMOUNT,
            [self.obs(Source.DECLARED, "1", 1), self.obs(Source.CONFIRMED, "2", 30)],
            date(2026, 10, 10),
        )
        assert c.state == MatchState.PENDING


def test_char_diff_marks_only_the_changed_digit() -> None:
    runs = char_diff("15,00,000", "35,00,000")
    assert runs == [("3", True), ("5,00,000", False)]


class TestAssurance:
    def test_levels_rise_with_evidence(self) -> None:
        ev = EvidenceDates(document_checked_on=date(2026, 1, 1), bank_confirmed_on=date(2026, 2, 1))
        assert assurance_on(ev, date(2025, 12, 31), 365) == Assurance.DECLARED
        assert assurance_on(ev, date(2026, 1, 15), 365) == Assurance.DOCUMENT_CHECKED
        assert assurance_on(ev, date(2026, 3, 1), 365) == Assurance.BANK_CONFIRMED

    def test_reconfirmation_within_window_is_a3_and_lapses(self) -> None:
        ev = EvidenceDates(bank_confirmed_on=date(2024, 1, 1), last_confirmed_on=date(2026, 1, 1))
        assert assurance_on(ev, date(2026, 6, 1), 365) == Assurance.RECONFIRMED
        assert assurance_on(ev, date(2027, 6, 1), 365) == Assurance.BANK_CONFIRMED

    def test_open_conflict_caps_at_declared(self) -> None:
        ev = EvidenceDates(bank_confirmed_on=date(2026, 1, 1), conflict_since=date(2026, 5, 1))
        assert assurance_on(ev, date(2026, 6, 1), 365) == Assurance.DECLARED

    def test_open_high_signal_blocks_document_checked(self) -> None:
        ev = EvidenceDates(document_checked_on=date(2026, 1, 1), high_signal_since=date(2026, 1, 1))
        assert assurance_on(ev, date(2026, 2, 1), 365) == Assurance.DECLARED


class TestStateMachine:
    def test_officer_can_verify_submitted(self) -> None:
        assert (
            check_transition("verify", Status.SUBMITTED, Role.BUREAU_OFFICER, None) == Status.ACTIVE
        )

    def test_institution_cannot_verify(self) -> None:
        with pytest.raises(TransitionRefused) as exc:
            check_transition("verify", Status.SUBMITTED, Role.INSTITUTION_USER, None)
        assert exc.value.code == "not_permitted"

    def test_return_requires_reason(self) -> None:
        with pytest.raises(TransitionRefused) as exc:
            check_transition("return", Status.SUBMITTED, Role.BUREAU_OFFICER, " ")
        assert exc.value.code == "reason_required"

    def test_release_cannot_skip_clearance(self) -> None:
        with pytest.raises(TransitionRefused) as exc:
            check_transition("discharge", Status.RELEASE_REQUESTED, Role.BANK_OFFICER, None)
        assert exc.value.code == "invalid_state"

    def test_only_approving_authority_clears_release(self) -> None:
        with pytest.raises(TransitionRefused):
            check_transition("clear_release", Status.RELEASE_REQUESTED, Role.BUREAU_OFFICER, None)
        target = check_transition(
            "clear_release", Status.RELEASE_REQUESTED, Role.APPROVING_AUTHORITY, None
        )
        assert target == Status.RELEASE_CLEARED


def facts(**overrides: object) -> InstrumentFacts:
    base: dict[str, object] = {
        "id": 1,
        "amount_paise": 35_00_000_00,
        "maturity_date": date(2027, 3, 31),
        "region": "western",
        "bank": "BHNX",
        "owner_id": None,
        "submitted_on": date(2017, 3, 20),
        "verified_on": date(2017, 4, 2),
    }
    base.update(overrides)
    return InstrumentFacts(**base)  # type: ignore[arg-type]


class TestAsOf:
    def test_phases_follow_time(self) -> None:
        f = facts()
        assert status_on(f, date(2017, 3, 1), R) is None
        assert status_on(f, date(2017, 3, 25), R) == Status.SUBMITTED
        assert status_on(f, date(2026, 10, 24), R) == Status.ACTIVE
        assert status_on(f, date(2027, 1, 15), R) == Status.MATURING
        assert status_on(f, date(2027, 4, 1), R) == Status.MATURED

    def test_released_and_renewed_are_terminal(self) -> None:
        assert (
            status_on(facts(released_on=date(2027, 5, 1)), date(2027, 6, 1), R) == Status.RELEASED
        )
        assert status_on(facts(renewed_on=date(2027, 3, 1)), date(2027, 4, 1), R) == Status.RENEWED

    def test_matured_escalates_with_time(self) -> None:
        st_ = state_on(facts(), date(2027, 5, 10), R)
        assert st_ is not None and st_.escalation == "deputy_director"

    @given(st.integers(min_value=0, max_value=4000))
    def test_status_after_maturity_is_never_active(self, offset: int) -> None:
        f = facts()
        s = status_on(f, f.maturity_date + timedelta(days=offset), R)
        assert s not in (Status.ACTIVE, Status.MATURING)

    def test_summary_counts_held_value_and_assurance(self) -> None:
        confirmed = facts(id=2, evidence=EvidenceDates(bank_confirmed_on=date(2017, 5, 1)))
        released = facts(id=3, released_on=date(2020, 1, 1))
        s = summarise([facts(), confirmed, released], D, R)
        assert s.held_count == 2
        assert s.held_paise == 70_00_000_00
        assert s.by_assurance_paise[Assurance.BANK_CONFIRMED] == 35_00_000_00
        assert s.by_region["western"]["confirmed_paise"] == 35_00_000_00

    def test_timeline_emits_reminders_then_maturity(self) -> None:
        steps = timeline([facts()], date(2026, 12, 28), 14, R)
        kinds = [(e.kind, e.detail) for step in steps for e in step.events]
        assert ("reminder", "T-90") in kinds
        assert ("matured", "matured") in kinds
        assert kinds.index(("reminder", "T-90")) < kinds.index(("matured", "matured"))

    def test_timeline_stops_events_after_renewal(self) -> None:
        steps = timeline([facts(renewed_on=date(2027, 2, 1))], date(2027, 2, 8), 12, R)
        assert all(not step.events for step in steps)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("03Jun 2024", "2024-06-03"),
        ("01Ju1 2024", "2024-07-01"),
        ("02 0ctober 2022", "2022-10-02"),
        ("10Dec2031", "2031-12-10"),
        ("22 April 2025", "2025-04-22"),
        ("12-Nov-2017", "2017-11-12"),
    ],
)
def test_dates_tolerate_ocr_slips(raw: str, expected: str) -> None:
    assert normalise(FieldName.ISSUE_DATE, raw) == expected
