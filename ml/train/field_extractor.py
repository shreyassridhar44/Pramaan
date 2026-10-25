r"""Train and evaluate the FDR field extractor (LightGBM token classifier on OCR tokens).

OCR runs on clean degraded scans from the training layouts; evaluation uses the two unseen test
layouts and reports per-field exact match for the trained model and the rule-based baseline.

Usage:
  uv run python -m train.field_extractor --train 1600 --test 300 --workers 12 \
    --out models/field_extractor.txt
"""

import argparse
import json
import random
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import UTC, date, datetime
from pathlib import Path

import numpy as np
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.domain.provenance import normalise  # noqa: E402
from app.domain.types import FieldName  # noqa: E402
from app.services.documents.extract import FieldExtractor, extract_rules  # noqa: E402
from app.services.documents.features import CLASSES, Token, token_features  # noqa: E402

from synth.build_dataset import SPLIT_BANKS  # noqa: E402
from synth.degrade import degrade, transform_fields  # noqa: E402
from synth.fdr_render import BANK_BY_CODE, FdrData, render  # noqa: E402

_OCR = None


def _ocr():
    global _OCR
    if _OCR is None:
        from rapidocr_onnxruntime import RapidOCR

        _OCR = RapidOCR()
    return _OCR


def ocr_tokens(img: np.ndarray) -> list[Token]:
    result, _ = _ocr()(img)
    tokens = []
    for quad, text, conf in result or []:
        xs = [p[0] for p in quad]
        ys = [p[1] for p in quad]
        tokens.append(Token(text, (min(xs), min(ys), max(xs), max(ys)), float(conf)))
    return tokens


def _label(token: Token, fields: dict) -> str:
    x0, y0, x1, y1 = token.box
    area = max(1.0, (x1 - x0) * (y1 - y0))
    best, best_ov = "other", 0.0
    for name, f in fields.items():
        if name not in CLASSES:
            continue
        fx0, fy0, fx1, fy1 = f["box"]
        ix = max(0.0, min(x1, fx1) - max(x0, fx0))
        iy = max(0.0, min(y1, fy1) - max(y0, fy0))
        ov = ix * iy / area
        if ov > best_ov:
            best, best_ov = name, ov
    return best if best_ov > 0.5 else "other"


def sample(args: tuple[str, int]) -> dict:
    split, seed = args
    rng = random.Random(seed)
    bank = rng.choice(SPLIT_BANKS[split])
    data = FdrData.random(random.Random(seed), BANK_BY_CODE[bank])
    r = render(data, random.Random(seed + 1))
    img, m = degrade(r.image, rng)
    fields = transform_fields(r.fields, m, img.shape[1], img.shape[0])
    tokens = ocr_tokens(img)
    return {
        "tokens": [(t.text, t.box, t.conf) for t in tokens],
        "labels": [_label(t, fields) for t in tokens],
        "size": (img.shape[1], img.shape[0]),
        "truth": {
            "number": data.number,
            "ifsc": data.ifsc,
            "amount": str(data.amount_rupees),  # rupees, as written
            "issue_date": data.issue.isoformat(),
            "maturity_date": data.maturity.isoformat(),
        },
    }


def _norm(field: str, value: str) -> str | None:
    try:
        return normalise(FieldName(field), value)
    except ValueError:
        return None


def evaluate(samples: list[dict], extractor: FieldExtractor | None) -> dict:
    fields = ("number", "ifsc", "amount", "issue_date", "maturity_date")
    correct = dict.fromkeys(fields, 0)
    for s in samples:
        tokens = [Token(t, tuple(b), c) for t, b, c in s["tokens"]]
        w, h = s["size"]
        found = extractor.extract(tokens, w, h) if extractor else extract_rules(tokens, w, h)
        for f in fields:
            if f in found and _norm(f, found[f].value) == _norm(f, s["truth"][f]):
                correct[f] += 1
    n = max(1, len(samples))
    per_field = {f: correct[f] / n for f in fields}
    return {
        "per_field_exact_match": per_field,
        "mean_exact_match": sum(per_field.values()) / len(fields),
        "samples": len(samples),
    }


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--train", type=int, default=1600)
    p.add_argument("--test", type=int, default=300)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--seed", type=int, default=77)
    p.add_argument("--out", default="models/field_extractor.txt")
    p.add_argument("--results", default="eval/results/field_extractor.json")
    a = p.parse_args()
    import lightgbm as lgb

    jobs = [("train", a.seed * 10**7 + i) for i in range(a.train)]
    jobs += [("test", a.seed * 10**7 + 5 * 10**6 + i) for i in range(a.test)]
    with ProcessPoolExecutor(a.workers) as ex:
        out = list(tqdm(ex.map(sample, jobs, chunksize=4), total=len(jobs)))
    train, test = out[: a.train], out[a.train :]

    xs, ys = [], []
    for s in train:
        tokens = [Token(t, tuple(b), c) for t, b, c in s["tokens"]]
        xs.append(token_features(tokens, *s["size"]))
        ys += [CLASSES.index(lbl) for lbl in s["labels"]]
    x = np.concatenate(xs)
    y = np.array(ys)
    booster = lgb.train(
        {
            "objective": "multiclass",
            "num_class": len(CLASSES),
            "learning_rate": 0.08,
            "num_leaves": 31,
            "min_data_in_leaf": 10,
            "verbose": -1,
            "seed": 2026,
        },
        lgb.Dataset(x, y),
        num_boost_round=300,
    )
    out_path = Path(a.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(out_path))

    model_eval = evaluate(test, FieldExtractor(out_path))
    rules_eval = evaluate(test, None)
    result = {
        "evaluated_at": datetime.now(UTC).isoformat(),
        "data_source": "synthetic (test layouts unseen in training)",
        "train_samples": len(train),
        "train_tokens": len(y),
        "trained_model": model_eval,
        "rule_baseline": rules_eval,
        "model_file": str(out_path),
    }
    res = Path(a.results)
    res.parent.mkdir(parents=True, exist_ok=True)
    res.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    _ = date


if __name__ == "__main__":
    main()
