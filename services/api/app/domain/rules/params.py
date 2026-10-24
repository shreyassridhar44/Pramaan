"""Rule parameters with their Approval Process Handbook references.

Defaults below are the APH 2024-2027 values (or our stated assumptions). At runtime the values are
loaded from the `rules` table so AICTE can change them without a code release; these defaults seed
that table and are used in tests.
"""

from dataclasses import dataclass, field
from typing import Literal

Level = Literal["diploma", "ug", "pg"]

# APH 2024-2027 Table 1.4, Security Deposit in Rs. lakh by discipline and level.
DEFAULT_RATE_CARD_LAKH: dict[str, dict[Level, int | None]] = {
    "engineering_technology": {"diploma": 15, "ug": 35, "pg": 15},
    "planning": {"diploma": 15, "ug": 15, "pg": 15},
    "applied_arts_crafts": {"diploma": 15, "ug": 15, "pg": 15},
    "design": {"diploma": 15, "ug": 15, "pg": 15},
    "hmct": {"diploma": 15, "ug": 15, "pg": 15},
    "computer_applications": {"diploma": None, "ug": 5, "pg": 15},
    "management": {"diploma": None, "ug": 5, "pg": 15},
}


@dataclass(frozen=True, slots=True)
class RuleRef:
    code: str
    version: int
    aph_ref: str
    assumption: bool = False


@dataclass(frozen=True, slots=True)
class DemandRules:
    ref: RuleRef = RuleRef("demand.rate_card", 1, "APH 2024-27 Clause 1.12, Table 1.4")
    rate_card_lakh: dict[str, dict[Level, int | None]] = field(
        default_factory=lambda: DEFAULT_RATE_CARD_LAKH
    )
    leased_multiplier: int = 2
    exempt_existing_years: int = 5
    term_years: int = 10


@dataclass(frozen=True, slots=True)
class DeadlineRules:
    ref: RuleRef = RuleRef("deadline.furnishing", 1, "APH 2024-27 Chapter II, item f")
    furnish_within_days: int = 15
    # Penalty as a fraction of the deposit if furnished after the deadline, up to the given date
    # of the calendar year (month, day). After the last date, approval is withdrawn.
    slabs: tuple[tuple[tuple[int, int], float], ...] = (((5, 31), 0.10), ((7, 31), 0.20))


@dataclass(frozen=True, slots=True)
class MaturityRules:
    ref: RuleRef = RuleRef(
        "monitoring.reminders", 1, "Assumption: reminder offsets chosen by the team", True
    )
    reminder_offsets_days: tuple[int, ...] = (90, 60, 30, 15, 7, 0)
    overdue_reminder_every_days: int = 7
    maturing_window_days: int = 90
    reconfirm_window_days: int = 365


@dataclass(frozen=True, slots=True)
class EscalationRules:
    ref: RuleRef = RuleRef(
        "monitoring.escalation", 1, "Assumption: escalation ladder chosen by the team", True
    )
    # (days overdue, level name)
    ladder: tuple[tuple[int, str], ...] = (
        (0, "dealing_officer"),
        (15, "section_head"),
        (30, "deputy_director"),
        (60, "director"),
    )


@dataclass(frozen=True, slots=True)
class PenaltyRules:
    ref: RuleRef = RuleRef("penalty", 1, "APH 2024-27 Clauses 7.7, 2.21 h and i")
    premature_encashment: float = 0.10
    closure_incomplete: float = 0.10
    closure_not_applied_six_years: float = 0.50


@dataclass(frozen=True, slots=True)
class ReleaseRules:
    ref: RuleRef = RuleRef("release", 1, "APH 2024-27 Clause 6.46")
    required_documents: tuple[str, ...] = (
        "application_letter",
        "affidavit_6",
        "instrument_copy",
        "latest_loa_eoa",
    )
    required_cells: tuple[str, ...] = ("pgrc", "vigilance", "grants")


@dataclass(frozen=True, slots=True)
class RuleSet:
    demand: DemandRules = field(default_factory=DemandRules)
    deadline: DeadlineRules = field(default_factory=DeadlineRules)
    maturity: MaturityRules = field(default_factory=MaturityRules)
    escalation: EscalationRules = field(default_factory=EscalationRules)
    penalty: PenaltyRules = field(default_factory=PenaltyRules)
    release: ReleaseRules = field(default_factory=ReleaseRules)

    @property
    def version_key(self) -> str:
        parts = (self.demand, self.deadline, self.maturity, self.escalation, self.penalty)
        return "-".join(f"{p.ref.code}@{p.ref.version}" for p in (*parts, self.release))
