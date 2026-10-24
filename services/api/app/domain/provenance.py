"""Normalisation and comparison of field observations from different sources.

The same value arrives typed by an institution, read by OCR, or returned by a bank. Each source
formats it differently, so values are normalised before comparison. The raw value is always kept.
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime

from app.domain.types import FieldName, MatchState, Source

_DATE_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y")
_HONORIFICS = re.compile(r"\b(mr|mrs|ms|dr|shri|smt|the)\b\.?", re.IGNORECASE)


def normalise_amount(raw: str) -> str:
    """Amount in rupees (as written) to integer paise, as a decimal string."""
    cleaned = re.sub(r"(rs\.?|inr|₹|/-|\s|,)", "", raw.strip().lower())
    if not re.fullmatch(r"\d+(\.\d{1,2})?", cleaned):
        raise ValueError(f"not an amount: {raw!r}")
    rupees, _, fraction = cleaned.partition(".")
    return str(int(rupees) * 100 + int(fraction.ljust(2, "0") or 0))


_MONTH_NUM = {
    m: i
    for i, m in enumerate(
        ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"),
        start=1,
    )
}
_OCR_LETTERS = str.maketrans({"0": "o", "1": "l", "5": "s", "8": "b", "|": "l"})
_TEXT_DATE = re.compile(r"^(\d{1,2})[\s.\-/]*([A-Za-z][A-Za-z0-9|]{2,8})[\s.\-/,]*(\d{4})$")


def _text_month_date(text: str) -> str | None:
    """Day, month name, year, tolerating OCR slips such as "03Jun2024", "01Ju1 2024" or
    "02 0ctober 2022" (digits misread for letters inside the month name)."""
    m = _TEXT_DATE.match(text)
    if not m:
        m = re.match(r"^(\d{1,2})[\s.\-/]*([0O][A-Za-z]{2,8})[\s.\-/,]*(\d{4})$", text)
    if not m:
        return None
    day, month_word, year = m.groups()
    month = _MONTH_NUM.get(month_word.translate(_OCR_LETTERS).lower()[:3])
    if month is None:
        return None
    try:
        return date(int(year), month, int(day)).isoformat()
    except ValueError:
        return None


def normalise_date(raw: str) -> str:
    text = raw.strip()
    tolerant = _text_month_date(text)
    if tolerant:
        return tolerant
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"not a date: {raw!r}")


def normalise_text(raw: str) -> str:
    text = unicodedata.normalize("NFKC", raw).casefold()
    text = _HONORIFICS.sub(" ", text)
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def normalise_holders(raw: str) -> str:
    """Holder names compare as a set, so order and separators do not matter. Commas stay inside
    a holder because designations are written as "Secretary, <Trust name>"."""
    parts = re.split(r"\s*(?:;|&|\band\b|\n)\s*", raw, flags=re.IGNORECASE)
    names = sorted({normalise_text(p) for p in parts if normalise_text(p)})
    return " | ".join(names)


def normalise_lien(raw: str) -> str:
    text = normalise_text(raw)
    if text in {"yes", "y", "true", "marked", "lien marked", "aicte"} or "favour of aicte" in text:
        return "yes"
    if text in {"no", "n", "false", "none", "not marked"}:
        return "no"
    raise ValueError(f"not a lien statement: {raw!r}")


def normalise(field: FieldName, raw: str) -> str:
    match field:
        case FieldName.AMOUNT:
            return normalise_amount(raw)
        case FieldName.ISSUE_DATE | FieldName.MATURITY_DATE:
            return normalise_date(raw)
        case FieldName.IFSC:
            return re.sub(r"\s", "", raw).upper()
        case FieldName.NUMBER:
            return re.sub(r"[\s\-/]", "", raw).upper().lstrip("0") or "0"
        case FieldName.HOLDERS:
            return normalise_holders(raw)
        case FieldName.LIEN:
            return normalise_lien(raw)
        case FieldName.BANK:
            return normalise_text(raw)


@dataclass(frozen=True, slots=True)
class Observation:
    field: FieldName
    source: Source
    value_norm: str
    observed_on: date


@dataclass(frozen=True, slots=True)
class FieldComparison:
    field: FieldName
    declared: str | None
    extracted: str | None
    confirmed: str | None
    state: MatchState


def latest_by_source(observations: list[Observation], as_of: date) -> dict[Source, Observation]:
    """The most recent observation per source on or before `as_of`."""
    latest: dict[Source, Observation] = {}
    for obs in observations:
        if obs.observed_on > as_of:
            continue
        current = latest.get(obs.source)
        if current is None or obs.observed_on >= current.observed_on:
            latest[obs.source] = obs
    return latest


def compare_field(
    field: FieldName, observations: list[Observation], as_of: date
) -> FieldComparison:
    """Compares the latest declared, extracted and confirmed values of one field.

    A conflict exists when any two available values differ. With only a declared value the field
    is pending, because nothing independent has been observed yet.
    """
    latest = latest_by_source([o for o in observations if o.field == field], as_of)
    values = {src: obs.value_norm for src, obs in latest.items()}
    declared = values.get(Source.DECLARED)
    extracted = values.get(Source.EXTRACTED)
    confirmed = values.get(Source.CONFIRMED)

    present = [v for v in (declared, extracted, confirmed) if v is not None]
    if not present:
        state = MatchState.MISSING
    elif len(set(present)) > 1:
        state = MatchState.CONFLICT
    elif extracted is None and confirmed is None:
        state = MatchState.PENDING
    else:
        state = MatchState.MATCH
    return FieldComparison(field, declared, extracted, confirmed, state)


def char_diff(a: str, b: str) -> list[tuple[str, bool]]:
    """Splits `b` into runs marked as changed or unchanged relative to `a`, for highlighting.

    Uses a longest-common-subsequence alignment, which is enough for short field values.
    """
    n, m = len(a), len(b)
    lcs = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            lcs[i][j] = lcs[i + 1][j + 1] + 1 if a[i] == b[j] else max(lcs[i + 1][j], lcs[i][j + 1])
    runs: list[tuple[str, bool]] = []
    i = j = 0
    while j < m:
        if i < n and a[i] == b[j]:
            _append(runs, b[j], False)
            i += 1
            j += 1
        elif i < n and lcs[i + 1][j] >= lcs[i][j + 1]:
            i += 1
        else:
            _append(runs, b[j], True)
            j += 1
    return runs


def _append(runs: list[tuple[str, bool]], ch: str, changed: bool) -> None:
    if runs and runs[-1][1] == changed:
        runs[-1] = (runs[-1][0] + ch, changed)
    else:
        runs.append((ch, changed))
