"""Penalties that apply before release (APH 2024-27 Clauses 7.7, 2.21 h and i).

These compute what the rules say. Imposing a penalty is always a decision by an authorised officer.
"""

from dataclasses import dataclass

from app.domain.rules.params import PenaltyRules


@dataclass(frozen=True, slots=True)
class Penalty:
    code: str
    fraction: float
    amount_paise: int
    reason: str
    aph_ref: str


def applicable_penalties(
    amount_paise: int,
    encashed_before_maturity: bool,
    closure_incomplete: bool,
    no_eoa_application_six_years: bool,
    rules: PenaltyRules,
) -> list[Penalty]:
    found: list[Penalty] = []
    if encashed_before_maturity:
        found.append(
            Penalty(
                "premature_encashment",
                rules.premature_encashment,
                round(amount_paise * rules.premature_encashment),
                "FDR encashed before the date of maturity",
                "APH 2024-27 Clause 7.7",
            )
        )
    if no_eoa_application_six_years:
        found.append(
            Penalty(
                "closure_not_applied",
                rules.closure_not_applied_six_years,
                round(amount_paise * rules.closure_not_applied_six_years),
                "Institution closed after not applying for EoA for six years",
                "APH 2024-27 Clause 2.21 i",
            )
        )
    elif closure_incomplete:
        found.append(
            Penalty(
                "closure_incomplete",
                rules.closure_incomplete,
                round(amount_paise * rules.closure_incomplete),
                "Institution closed after an incomplete closure application",
                "APH 2024-27 Clause 2.21 h",
            )
        )
    return found
