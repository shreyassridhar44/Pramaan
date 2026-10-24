"""Field extraction from OCR tokens: a trained LightGBM token classifier when the model file is
available, otherwise a rule-based baseline. Both return the same structure, with the method used."""

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.domain.words import words_to_rupees
from app.services.documents.features import (
    CLASSES,
    RE_AMOUNT,
    RE_DATE,
    RE_IFSC,
    RE_LONG_NUMBER,
    Token,
    _keyword_class,
    clean_value,
    token_features,
)

TARGETS = (
    "number",
    "amount",
    "amount_words",
    "issue_date",
    "maturity_date",
    "ifsc",
    "holders",
    "lien",
    "branch",
)


@dataclass(frozen=True, slots=True)
class ExtractedField:
    value: str
    box: tuple[float, float, float, float]
    confidence: float


def _valid(field: str, text: str) -> bool:
    t = clean_value(text)
    compact = t.replace(" ", "")
    return {
        "amount": bool(RE_AMOUNT.match(t)),
        "issue_date": bool(RE_DATE.match(t)),
        "maturity_date": bool(RE_DATE.match(t)),
        "ifsc": bool(RE_IFSC.match(compact)),
        "number": bool(RE_LONG_NUMBER.match(compact)),
        "amount_words": words_to_rupees(t) is not None,
    }.get(field, len(t) > 2)


def extract_rules(tokens: list[Token], width: float, height: float) -> dict[str, ExtractedField]:
    """Baseline: take the nearest valid token to the right of each label keyword."""
    out: dict[str, ExtractedField] = {}
    for label in tokens:
        name = _keyword_class(label.text)
        if name is None or name not in TARGETS or name in out:
            continue
        _, ly0, lx1, ly1 = label.box
        lcy, lh = (ly0 + ly1) / 2, ly1 - ly0
        best: Token | None = None
        best_d = 1e9
        for t in tokens:
            if t is label:
                continue
            x0, y0, _, y1 = t.box
            if abs((y0 + y1) / 2 - lcy) < 0.8 * lh and x0 >= lx1 - 5 and _valid(name, t.text):
                d = x0 - lx1
                if d < best_d:
                    best, best_d = t, d
        if best is not None:
            out[name] = ExtractedField(clean_value(best.text), best.box, 0.6)
    return out


class FieldExtractor:
    def __init__(self, model_path: Path | None) -> None:
        self.booster: Any = None
        self.version = "rules-1"
        if model_path and model_path.exists():
            import lightgbm as lgb

            self.booster = lgb.Booster(model_file=str(model_path))
            self.version = f"lgbm-{model_path.stem}"

    def extract(
        self, tokens: list[Token], width: float, height: float
    ) -> dict[str, ExtractedField]:
        if self.booster is None or not tokens:
            return extract_rules(tokens, width, height)
        probs = self.booster.predict(token_features(tokens, width, height))
        out: dict[str, ExtractedField] = {}
        for field in TARGETS:
            k = CLASSES.index(field)
            order = np.argsort(-probs[:, k])
            for idx in order[:3]:
                p = float(probs[idx, k])
                if p < 0.3:
                    break
                if _valid(field, tokens[idx].text):
                    out[field] = ExtractedField(clean_value(tokens[idx].text), tokens[idx].box, p)
                    break
        rules = extract_rules(tokens, width, height)
        for field, value in rules.items():
            out.setdefault(field, value)
        return out


def normalise_lien(text: str) -> str:
    t = text.lower()
    if "no lien" in t or "not marked" in t:
        return "no"
    return "yes" if "lien" in t or "aicte" in t else text


def holders_from(text: str) -> str:
    return re.sub(r"\s+&\s+", "; ", text)
