"""Release eligibility and authorisation (APH 2024-27 Clause 6.46).

The engine reports which conditions pass, fail or are pending. It never authorises a release:
that needs a human with authority, and only when every condition passes.
"""

from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum

from app.domain.rules.params import ReleaseRules
from app.domain.types import InstrumentKind


class CheckState(StrEnum):
    PASS = "pass"  # noqa: S105 (a check outcome, not a credential)
    FAIL = "fail"
    PENDING = "pending"


@dataclass(frozen=True, slots=True)
class Check:
    code: str
    label: str
    state: CheckState
    detail: str
    aph_ref: str


@dataclass(frozen=True, slots=True)
class ReleaseContext:
    kind: InstrumentKind
    maturity_date: date
    as_of: date
    documents: frozenset[str]
    clearances: dict[str, str]  # cell -> "cleared" | "blocked" | "pending"
    open_complaints: int
    lien_hold: bool
    embezzlement_noc_pending: bool
    penalties_due_paise: int
    progressive_closure: bool = False
    no_students_certificate: bool = False
    converted_to_university: bool = False
    disciplinary_pending: bool = False
    clearance_reasons: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class Eligibility:
    checks: tuple[Check, ...]
    authority: str

    @property
    def blocked(self) -> bool:
        return any(c.state == CheckState.FAIL for c in self.checks)

    @property
    def ready_for_authorisation(self) -> bool:
        return all(c.state == CheckState.PASS for c in self.checks)


DOC_LABELS = {
    "application_letter": "Application or request letter",
    "affidavit_6": "Affidavit 6",
    "instrument_copy": "Copy of the FDR or payment proof",
    "latest_loa_eoa": "Latest LoA or EoA",
}
CELL_LABELS = {"pgrc": "PGRC", "vigilance": "Vigilance Cell", "grants": "Grants bureaus"}


def evaluate_release(ctx: ReleaseContext, rules: ReleaseRules) -> Eligibility:
    checks: list[Check] = []
    matured = ctx.as_of >= ctx.maturity_date
    closure_exception = ctx.progressive_closure and ctx.no_students_certificate
    checks.append(
        Check(
            "term_complete",
            "Term completed",
            CheckState.PASS if matured or closure_exception else CheckState.FAIL,
            "Matured" if matured else f"Matures on {ctx.maturity_date:%d %b %Y}",
            "APH 2024-27 Clause 1.12 v, 6.46 h",
        )
    )

    missing = [d for d in rules.required_documents if d not in ctx.documents]
    checks.append(
        Check(
            "documents",
            "Required documents",
            CheckState.PASS if not missing else CheckState.PENDING,
            "All submitted"
            if not missing
            else "Missing: " + ", ".join(DOC_LABELS[d] for d in missing),
            "APH 2024-27 Clause 6.46 a",
        )
    )

    for cell in rules.required_cells:
        state = ctx.clearances.get(cell, "pending")
        reason = ctx.clearance_reasons.get(cell, "")
        detail = {
            "cleared": "Cleared",
            "blocked": f"Blocked. {reason}".strip(),
            "pending": "Awaiting",
        }
        if cell == "pgrc" and ctx.open_complaints and state != "cleared":
            state = "blocked" if state == "blocked" else "pending"
            n = ctx.open_complaints
            detail["pending"] = f"{n} open complaint{'s' if n > 1 else ''} to resolve"
        checks.append(
            Check(
                f"clearance_{cell}",
                f"{CELL_LABELS[cell]} clearance",
                {"cleared": CheckState.PASS, "blocked": CheckState.FAIL}.get(
                    state, CheckState.PENDING
                ),
                detail[state],
                "APH 2024-27 Clause 6.46 b",
            )
        )

    checks.append(
        Check(
            "no_lien_hold",
            "No lien hold",
            CheckState.FAIL if ctx.lien_hold else CheckState.PASS,
            "AICTE lien held during a trustee dispute" if ctx.lien_hold else "None",
            "APH 2024-27 Clause 2.20 d",
        )
    )
    checks.append(
        Check(
            "no_embezzlement",
            "No pending embezzlement NOC",
            CheckState.FAIL if ctx.embezzlement_noc_pending else CheckState.PASS,
            "NOC from the affected body required" if ctx.embezzlement_noc_pending else "None",
            "APH 2024-27 Clause 6.46 e",
        )
    )
    if ctx.converted_to_university:
        ok = not ctx.disciplinary_pending and ctx.open_complaints == 0
        checks.append(
            Check(
                "university_conversion",
                "No pending complaints or proceedings",
                CheckState.PASS if ok else CheckState.FAIL,
                "None" if ok else "Pending complaints or disciplinary proceedings",
                "APH 2024-27 Clause 6.46 g",
            )
        )
    checks.append(
        Check(
            "penalties_settled",
            "Penalties settled",
            CheckState.PASS if ctx.penalties_due_paise == 0 else CheckState.PENDING,
            "None due" if ctx.penalties_due_paise == 0 else "Penalty to be settled before release",
            "APH 2024-27 Clauses 7.7, 2.21",
        )
    )

    authority = (
        "Sanction order by the Council"
        if ctx.kind == InstrumentKind.RTGS
        else "NOC by the Approval Bureau"
    )
    return Eligibility(tuple(checks), authority)
