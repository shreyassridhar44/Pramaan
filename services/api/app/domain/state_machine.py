"""Stored lifecycle transitions. Time-derived phases (maturing, matured) are not transitions; the
as-of engine derives them from dates. Every transition names who may perform it."""

from dataclasses import dataclass

from app.domain.types import Role, Status

SYSTEM = "system"


@dataclass(frozen=True, slots=True)
class Transition:
    action: str
    sources: frozenset[Status]
    target: Status
    actors: frozenset[str]
    needs_reason: bool = False


_HELD = frozenset({Status.ACTIVE, Status.MATURING, Status.MATURED, Status.RENEWAL_PENDING})
_IN_SCRUTINY = frozenset({Status.SUBMITTED, Status.UNDER_SCRUTINY, Status.DISCREPANCY})
_OFFICERS = frozenset({Role.BUREAU_OFFICER, Role.REGIONAL_OFFICER, Role.SECTION_HEAD})

TRANSITIONS: dict[str, Transition] = {
    t.action: t
    for t in (
        Transition(
            "start_scrutiny", frozenset({Status.SUBMITTED}), Status.UNDER_SCRUTINY, _OFFICERS
        ),
        Transition("return", _IN_SCRUTINY, Status.RETURNED, _OFFICERS, needs_reason=True),
        Transition(
            "resubmit",
            frozenset({Status.RETURNED}),
            Status.SUBMITTED,
            frozenset({Role.INSTITUTION_USER}),
        ),
        Transition(
            "flag_discrepancy", _IN_SCRUTINY | _HELD, Status.DISCREPANCY, _OFFICERS | {SYSTEM}
        ),
        Transition("verify", _IN_SCRUTINY, Status.ACTIVE, _OFFICERS),
        Transition(
            "request_release", _HELD, Status.RELEASE_REQUESTED, frozenset({Role.INSTITUTION_USER})
        ),
        Transition(
            "clear_release",
            frozenset({Status.RELEASE_REQUESTED}),
            Status.RELEASE_CLEARED,
            frozenset({Role.APPROVING_AUTHORITY}),
        ),
        Transition(
            "discharge",
            frozenset({Status.RELEASE_CLEARED}),
            Status.RELEASED,
            frozenset({Role.BANK_OFFICER, SYSTEM}),
        ),
        Transition("mark_renewed", _HELD, Status.RENEWED, frozenset({SYSTEM})),
        Transition(
            "hold_lien",
            _HELD | {Status.RELEASE_REQUESTED},
            Status.LIEN_HOLD,
            frozenset({Role.SECTION_HEAD, Role.APPROVING_AUTHORITY}),
            needs_reason=True,
        ),
        Transition(
            "lift_lien",
            frozenset({Status.LIEN_HOLD}),
            Status.ACTIVE,
            frozenset({Role.SECTION_HEAD, Role.APPROVING_AUTHORITY}),
            needs_reason=True,
        ),
        Transition(
            "record_premature_encashment",
            _HELD,
            Status.ENCASHED_PREMATURELY,
            frozenset({SYSTEM, Role.BUREAU_OFFICER}),
        ),
        Transition(
            "forfeit",
            _HELD | {Status.LIEN_HOLD},
            Status.FORFEITED,
            frozenset({Role.APPROVING_AUTHORITY}),
            needs_reason=True,
        ),
    )
}


class TransitionRefused(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def check_transition(action: str, current: Status, actor: str, reason: str | None) -> Status:
    """Returns the target status, or raises TransitionRefused with a user-facing reason."""
    transition = TRANSITIONS.get(action)
    if transition is None:
        raise TransitionRefused("unknown_action", f"Unknown action: {action}")
    if actor not in transition.actors:
        raise TransitionRefused("not_permitted", "Your role cannot perform this action.")
    if current not in transition.sources:
        raise TransitionRefused(
            "invalid_state", f"This action is not available while the instrument is {current}."
        )
    if transition.needs_reason and not (reason and reason.strip()):
        raise TransitionRefused("reason_required", "A reason is required for this action.")
    return transition.target
