"""Security deposit demand calculation (APH 2024-27 Clause 1.12 and Table 1.4)."""

from dataclasses import dataclass

from app.domain.rules.params import DemandRules, Level
from app.domain.types import Ownership, Premises

PAISE_PER_LAKH = 100_000 * 100


@dataclass(frozen=True, slots=True)
class ProgrammeLevel:
    discipline: str
    level: Level


@dataclass(frozen=True, slots=True)
class DemandLine:
    discipline: str
    level: Level
    base_paise: int
    multiplier: int
    amount_paise: int
    note: str


@dataclass(frozen=True, slots=True)
class DemandResult:
    lines: tuple[DemandLine, ...]
    total_paise: int
    exempt: bool
    exemption_reason: str | None
    aph_ref: str


def compute_demand(
    programmes: list[ProgrammeLevel],
    premises: Premises,
    ownership: Ownership,
    years_in_existence: int,
    is_new_institution: bool,
    rules: DemandRules,
) -> DemandResult:
    """Sums the Table 1.4 amount for each distinct programme and level applied.

    Government and Government-aided institutions are exempt (Clause 1.12). Existing institutions
    in existence for more than `exempt_existing_years` are exempt when applying under Clause 1.3.3,
    which is the case for an existing institution that is not starting a new programme here.
    Private leased building or land doubles the amount (Table 1.4 note).
    """
    ref = rules.ref.aph_ref
    if ownership in (Ownership.GOVERNMENT, Ownership.AIDED):
        return DemandResult((), 0, True, "Government or Government-aided institution", ref)
    if not is_new_institution and years_in_existence > rules.exempt_existing_years:
        reason = f"Existing institution for more than {rules.exempt_existing_years} years"
        return DemandResult((), 0, True, reason, ref)

    multiplier = rules.leased_multiplier if premises == Premises.LEASED else 1
    lines: list[DemandLine] = []
    seen: set[tuple[str, str]] = set()
    for p in programmes:
        key = (p.discipline, p.level)
        if key in seen:
            continue
        seen.add(key)
        lakh = rules.rate_card_lakh.get(p.discipline, {}).get(p.level)
        if lakh is None:
            raise ValueError(f"No Table 1.4 amount for {p.discipline} at level {p.level}")
        base = lakh * PAISE_PER_LAKH
        note = "Leased premises: amount doubled" if multiplier > 1 else "Own premises"
        lines.append(DemandLine(p.discipline, p.level, base, multiplier, base * multiplier, note))

    total = sum(line.amount_paise for line in lines)
    return DemandResult(tuple(lines), total, False, None, ref)
