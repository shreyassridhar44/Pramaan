"""Assurance level: how well an instrument is proven, computed from evidence (PROJECT.md 3.3)."""

from dataclasses import dataclass
from datetime import date, timedelta

from app.domain.types import Assurance


@dataclass(frozen=True, slots=True)
class EvidenceDates:
    """When each kind of evidence was first established for an instrument.

    These dates are maintained by the services whenever observations, signals or bank messages
    change, so the level can be computed for any date without replaying every observation.
    """

    document_checked_on: date | None = None
    bank_confirmed_on: date | None = None
    last_confirmed_on: date | None = None
    conflict_since: date | None = None
    conflict_resolved_on: date | None = None
    high_signal_since: date | None = None
    high_signal_resolved_on: date | None = None


def _open_on(since: date | None, resolved: date | None, as_of: date) -> bool:
    return since is not None and since <= as_of and (resolved is None or resolved > as_of)


def assurance_on(evidence: EvidenceDates, as_of: date, reconfirm_window_days: int) -> Assurance:
    if _open_on(evidence.conflict_since, evidence.conflict_resolved_on, as_of):
        return Assurance.DECLARED

    confirmed = evidence.bank_confirmed_on is not None and evidence.bank_confirmed_on <= as_of
    if confirmed:
        last = evidence.last_confirmed_on or evidence.bank_confirmed_on
        if (
            last is not None
            and last != evidence.bank_confirmed_on
            and last <= as_of
            and as_of - last <= timedelta(days=reconfirm_window_days)
        ):
            return Assurance.RECONFIRMED
        return Assurance.BANK_CONFIRMED

    checked = evidence.document_checked_on is not None and evidence.document_checked_on <= as_of
    if checked and not _open_on(
        evidence.high_signal_since, evidence.high_signal_resolved_on, as_of
    ):
        return Assurance.DOCUMENT_CHECKED
    return Assurance.DECLARED
