"""Reconciling a legacy deposit register with Pramaan's records.

Before Pramaan, deposits were tracked in spreadsheets kept by different desks, each with its own
column names, number formats and date styles (PROBLEM_STATEMENT.md, Background). These pure
functions read such a register leniently, then compare each row with the records Pramaan holds:
the same deposit with the same values, the same deposit with different values, a deposit Pramaan
does not hold, a repeated row, or a row too incomplete to use. Nothing here decides which value is
right; differences are listed for an officer.
"""

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Literal

Outcome = Literal["match", "differs", "new", "duplicate", "incomplete"]

# Header synonyms seen in registers kept by different desks.
COLUMNS: dict[str, tuple[str, ...]] = {
    "number": ("fdr no", "fdr number", "receipt no", "instrument no", "fd no", "fdr", "receipt"),
    "institution": ("name of institution", "institution", "institute", "college", "name"),
    "aicte_id": ("permanent id", "aicte id", "pid", "aicte permanent id", "institute id"),
    "bank": ("issuing bank", "bank name", "bank"),
    "amount": ("amount", "amount (rs.)", "amount (rs)", "deposit amount", "value", "rs."),
    "issue": ("date of fdr", "date of issue", "issue date", "issued on", "fdr date"),
    "maturity": ("valid upto", "valid up to", "maturity date", "maturity", "due date", "expiry"),
}

_MONTHS = {
    m: i + 1
    for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    )
}


def map_columns(header: Sequence[object]) -> dict[str, int]:
    """Column index for each known field, matched on the header text."""
    names = [re.sub(r"\s+", " ", str(h or "")).strip().lower() for h in header]
    out: dict[str, int] = {}
    for key, synonyms in COLUMNS.items():
        for syn in synonyms:
            idx = next((i for i, n in enumerate(names) if n == syn), None)
            if idx is None:
                idx = next(
                    (i for i, n in enumerate(names) if syn in n and i not in out.values()), None
                )
            if idx is not None and idx not in out.values():
                out[key] = idx
                break
    return out


def normalise_number(value: object) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits.lstrip("0") or None


def parse_amount(value: object) -> int | None:
    """Paise from '15,00,000', 'Rs. 15,00,000/-', '15 lakh', '1.5 Cr' or a plain number."""
    if value is None or value == "":
        return None
    if isinstance(value, int | float):
        return round(float(value) * 100)
    text = str(value).lower().replace(",", "").replace("rs.", "").replace("rs", "")
    text = text.replace("/-", "").replace("₹", "").strip()
    m = re.fullmatch(r"([\d.]+)\s*(lakhs?|lacs?|l|crores?|cr)?", text)
    if not m:
        return None
    try:
        n = float(m.group(1))
    except ValueError:
        return None
    unit = m.group(2) or ""
    if unit.startswith(("l",)):
        n *= 1_00_000
    elif unit.startswith("c"):
        n *= 1_00_00_000
    return round(n * 100)


def parse_date(value: object) -> date | None:
    """Dates as written by different desks: 20/10/2026, 20-10-26, 2026-10-20, 20 Oct 2026."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip().lower()
    if not text:
        return None
    m = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if m:
        y, mo, d = int(m[1]), int(m[2]), int(m[3])
    else:
        m = re.fullmatch(r"(\d{1,2})[/.\-\s]([a-z]{3}|\d{1,2})[a-z]*[/.\-\s](\d{2,4})", text)
        if not m:
            return None
        d = int(m[1])
        mo = _MONTHS.get(m[2], 0) if m[2].isalpha() else int(m[2])
        y = int(m[3]) + (2000 if len(m[3]) == 2 else 0)
    try:
        return date(y, mo, d)
    except ValueError:
        return None


@dataclass(frozen=True, slots=True)
class LegacyRow:
    line: int
    number: str | None
    number_raw: str
    institution: str
    aicte_id: str
    bank: str
    amount_paise: int | None
    issue: date | None
    maturity: date | None


def read_rows(rows: Iterable[Sequence[object]]) -> tuple[dict[str, int], list[LegacyRow]]:
    """The first row that names a deposit number column is the header; rows after it are data."""
    it = iter(rows)
    cols: dict[str, int] = {}
    line = 0
    for header in it:
        line += 1
        cols = map_columns(header)
        if "number" in cols and len(cols) >= 3:
            break
    out: list[LegacyRow] = []

    def cell(r: Sequence[object], key: str) -> object:
        i = cols.get(key)
        return r[i] if i is not None and i < len(r) else None

    for r in it:
        line += 1
        if not any(str(c or "").strip() for c in r):
            continue
        out.append(
            LegacyRow(
                line=line,
                number=normalise_number(cell(r, "number")),
                number_raw=str(cell(r, "number") or "").strip(),
                institution=str(cell(r, "institution") or "").strip(),
                aicte_id=str(cell(r, "aicte_id") or "").strip(),
                bank=str(cell(r, "bank") or "").strip(),
                amount_paise=parse_amount(cell(r, "amount")),
                issue=parse_date(cell(r, "issue")),
                maturity=parse_date(cell(r, "maturity")),
            )
        )
    return cols, out


@dataclass(frozen=True, slots=True)
class Known:
    id: int
    number: str
    amount_paise: int
    issue: date
    maturity: date
    institution: str


@dataclass(slots=True)
class Finding:
    row: LegacyRow
    outcome: Outcome
    instrument_id: int | None = None
    differences: list[tuple[str, str, str]] = field(default_factory=list)
    problem: str | None = None


def _show_date(d: date | None) -> str:
    return d.isoformat() if d else "blank"


def reconcile(rows: Sequence[LegacyRow], known: Iterable[Known]) -> list[Finding]:
    by_number = {k.number: k for k in known}
    seen: set[str] = set()
    out: list[Finding] = []
    for r in rows:
        if not r.number or r.amount_paise is None:
            out.append(
                Finding(
                    r,
                    "incomplete",
                    problem="No deposit number" if not r.number else "Amount cannot be read",
                )
            )
            continue
        if r.number in seen:
            out.append(Finding(r, "duplicate", problem="Same deposit number appears earlier"))
            continue
        seen.add(r.number)
        k = by_number.get(r.number)
        if k is None:
            if r.issue and r.maturity and r.maturity <= r.issue:
                out.append(Finding(r, "incomplete", problem="Maturity is not after issue"))
            else:
                out.append(Finding(r, "new"))
            continue
        diffs: list[tuple[str, str, str]] = []
        if r.amount_paise != k.amount_paise:
            diffs.append(("amount_paise", str(r.amount_paise), str(k.amount_paise)))
        if r.issue and r.issue != k.issue:
            diffs.append(("issue_date", _show_date(r.issue), _show_date(k.issue)))
        if r.maturity != k.maturity:
            diffs.append(("maturity_date", _show_date(r.maturity), _show_date(k.maturity)))
        out.append(Finding(r, "differs" if diffs else "match", k.id, diffs))
    return out
