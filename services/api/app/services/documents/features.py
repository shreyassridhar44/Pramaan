"""Token features for the FDR field extractor.

Shared by training (ml/train/field_extractor.py) and inference, so both compute identical features.
Pure Python and numpy only: no application imports.
"""

import re
from dataclasses import dataclass

import numpy as np

CLASSES = (
    "other",
    "number",
    "amount",
    "issue_date",
    "maturity_date",
    "ifsc",
    "holders",
    "lien",
    "branch",
    "rate",
    "amount_words",
)

_MONTHS = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*"
RE_DATE = re.compile(
    rf"^\d{{1,2}}[\s./-]*({_MONTHS}|[0O][a-z]{{2,8}}|[a-z]{{2}}[a-z01|]{{1,7}}|\d{{1,2}})[\s./-]*\d{{4}}$",
    re.IGNORECASE,
)
RE_AMOUNT = re.compile(
    r"^(rs\.?|inr|₹)?\s*\d{1,3}(,\d{2})*,\d{3}(\.\d{2})?(/-)?$|^(rs\.?|inr|₹)\s*\d+(\.\d{2})?(/-)?$",
    re.IGNORECASE,
)
RE_IFSC = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
RE_LONG_NUMBER = re.compile(r"^\d{9,20}$")

KEYWORDS: dict[str, tuple[str, ...]] = {
    "number": (
        "fdr no",
        "deposit no",
        "receipt no",
        "account no",
        "td no",
        "term deposit no",
        "fd receipt",
    ),
    "amount": ("amount", "principal", "deposit amount"),
    "issue_date": ("date of issue", "date of deposit", "issue date"),
    "maturity_date": ("maturity", "due date"),
    "ifsc": ("ifsc",),
    "holders": ("in the name", "depositor", "holders"),
    "lien": ("lien",),
    "branch": ("branch",),
    "rate": ("rate of interest", "interest"),
    "amount_words": ("in words",),
}
KW_ORDER = tuple(KEYWORDS)


@dataclass(frozen=True, slots=True)
class Token:
    text: str
    box: tuple[float, float, float, float]  # x0, y0, x1, y1
    conf: float = 1.0


def _keyword_class(text: str) -> str | None:
    """Label keyword in a token, ignoring spaces because OCR often drops them ("DueDate")."""
    t = text.lower().replace(" ", "")
    for name in KW_ORDER:
        if any(k.replace(" ", "") in t for k in KEYWORDS[name]):
            return name
    return None


def clean_value(text: str) -> str:
    """Strips a leading label (for example "IFSC: ") that OCR sometimes merges into the value."""
    return re.sub(r"^[A-Za-z .()]{2,30}:\s*", "", text).strip()


def token_features(tokens: list[Token], width: float, height: float) -> np.ndarray:
    """One feature row per token."""
    rows = []
    kw = [_keyword_class(t.text) for t in tokens]
    for i, t in enumerate(tokens):
        x0, y0, x1, y1 = t.box
        text = clean_value(t.text)
        compact = text.replace(" ", "")
        n = max(1, len(compact))
        digits = sum(c.isdigit() for c in compact)
        alpha = sum(c.isalpha() for c in compact)
        upper = sum(c.isupper() for c in compact)
        cy, h = (y0 + y1) / 2, max(1.0, y1 - y0)

        # Nearest keyword label on the same line to the left, and directly above.
        left_kw = [0.0] * len(KW_ORDER)
        left_dist = 1.0
        above_kw = [0.0] * len(KW_ORDER)
        for j, other in enumerate(tokens):
            if j == i or kw[j] is None:
                continue
            ox0, oy0, ox1, oy1 = other.box
            ocy = (oy0 + oy1) / 2
            if abs(ocy - cy) < 0.8 * h and ox1 <= x0 + 5:
                d = (x0 - ox1) / width
                if d < left_dist:
                    left_dist = d
                    left_kw = [0.0] * len(KW_ORDER)
                    left_kw[KW_ORDER.index(kw[j])] = 1.0
            elif 0 < y0 - oy1 < 2.5 * h and abs(ox0 - x0) < 0.15 * width:
                above_kw[KW_ORDER.index(kw[j])] = 1.0
        own_kw = [0.0] * len(KW_ORDER)
        if kw[i]:
            own_kw[KW_ORDER.index(kw[i])] = 1.0

        rows.append(
            [
                x0 / width,
                y0 / height,
                (x1 - x0) / width,
                h / height,
                t.conf,
                len(compact),
                digits / n,
                alpha / n,
                upper / max(1, alpha),
                float("," in text),
                float("/" in text),
                float("-" in text),
                float("." in text),
                float("%" in text),
                float(bool(RE_DATE.match(text))),
                float(bool(RE_AMOUNT.match(text))),
                float(bool(RE_IFSC.match(compact))),
                float(bool(RE_LONG_NUMBER.match(compact))),
                float("aicte" in text.lower()),
                float("secretary" in text.lower()),
                float(text.lower().startswith("rupees")),
                float("lien" in text.lower()),
                float(":" in t.text),
                left_dist,
                *left_kw,
                *above_kw,
                *own_kw,
            ]
        )
    return (
        np.asarray(rows, dtype=np.float32)
        if rows
        else np.zeros((0, 24 + 3 * len(KW_ORDER)), np.float32)
    )
