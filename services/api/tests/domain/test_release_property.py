"""Release can never be ready for authorisation while any blocker is open (Clause 6.46)."""

from datetime import date, timedelta

from hypothesis import given
from hypothesis import strategies as st

from app.domain.rules.params import ReleaseRules
from app.domain.rules.release import ReleaseContext, evaluate_release
from app.domain.types import InstrumentKind

RULES = ReleaseRules()
TODAY = date(2026, 10, 25)
STATES = st.sampled_from(["cleared", "blocked", "pending"])


@given(
    matured=st.booleans(),
    docs=st.sets(st.sampled_from(RULES.required_documents)),
    pgrc=STATES,
    vigilance=STATES,
    grants=STATES,
    complaints=st.integers(0, 3),
    lien_hold=st.booleans(),
    embezzlement=st.booleans(),
    penalty=st.sampled_from([0, 50_000_00]),
    kind=st.sampled_from(list(InstrumentKind)),
)
def test_ready_only_when_every_condition_holds(
    matured: bool,
    docs: set[str],
    pgrc: str,
    vigilance: str,
    grants: str,
    complaints: int,
    lien_hold: bool,
    embezzlement: bool,
    penalty: int,
    kind: InstrumentKind,
) -> None:
    ctx = ReleaseContext(
        kind=kind,
        maturity_date=TODAY - timedelta(days=1) if matured else TODAY + timedelta(days=30),
        as_of=TODAY,
        documents=frozenset(docs),
        clearances={"pgrc": pgrc, "vigilance": vigilance, "grants": grants},
        open_complaints=complaints,
        lien_hold=lien_hold,
        embezzlement_noc_pending=embezzlement,
        penalties_due_paise=penalty,
    )
    e = evaluate_release(ctx, RULES)
    all_clear = (
        matured
        and docs == set(RULES.required_documents)
        and (pgrc, vigilance, grants) == ("cleared", "cleared", "cleared")
        and not lien_hold
        and not embezzlement
        and penalty == 0
    )
    assert e.ready_for_authorisation == all_clear
    if "blocked" in (pgrc, vigilance, grants) or lien_hold or embezzlement:
        assert e.blocked
    expected = "Sanction order" if kind == InstrumentKind.RTGS else "NOC"
    assert expected in e.authority
