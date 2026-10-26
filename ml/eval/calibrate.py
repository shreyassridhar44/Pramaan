r"""Choose the localiser's operating point on validation data.

Runs the exported model once per validation image, keeps every candidate region (connected
component after the API's closing step) at several probability thresholds with its area and
whether it touches the true edit, then scores region rules: the probability threshold and the
smallest region kept. For each rule it reports the share of unedited pages that get any mark and
the share of edited pages with a mark on the edit, overall and per edit type. The rule is chosen
on the validation split; `--split test` then reports the chosen rule on test data.

Usage:
  uv run python -m synth.build_dataset --out data/loc_val --train 0 --val 400 --test 0
  uv run python -m eval.calibrate --data data/loc_val --out eval/results/localiser_calibration.json
"""

import argparse
import json
from datetime import UTC, datetime
from itertools import product
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from tqdm import tqdm

from eval.localiser_eval import preprocess

THRESHOLDS = (0.5, 0.7, 0.9, 0.95, 0.98)
MIN_AREAS = (60, 150, 300, 450, 600, 900)


def predict(sess: ort.InferenceSession, rgb: np.ndarray) -> np.ndarray:
    x, (h2, w2), _ = preprocess(rgb)
    logits = sess.run(None, {"image": x})[0][0, 0, :h2, :w2]
    return (1 / (1 + np.exp(-logits))).astype(np.float32)


def components(prob: np.ndarray, mask: np.ndarray | None) -> dict[float, list[tuple[int, bool]]]:
    """Per threshold: (area, touches the true edit) for each candidate region."""
    out = {}
    for t in THRESHOLDS:
        raw = (prob > t).astype(np.uint8)
        binary = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
        out[t] = [
            (int(stats[i][4]), bool(mask is not None and (mask[labels == i]).any()))
            for i in range(1, n)
        ]
    return out


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data/loc_val")
    p.add_argument("--model", default="models/localiser.onnx")
    p.add_argument("--split", default="val")
    p.add_argument("--extra", nargs="*", default=[], help="pages reported separately")
    p.add_argument("--out", default="eval/results/localiser_calibration.json")
    a = p.parse_args()
    root = Path(a.data)
    sess = ort.InferenceSession(a.model, providers=["CPUExecutionProvider"])
    pages = []
    kinds: list[str] = []
    for path in tqdm(sorted((root / "images" / a.split).glob("*.jpg"))):
        rgb = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)
        mask = (
            cv2.imread(str(root / "masks" / a.split / f"{path.stem}.png"), cv2.IMREAD_GRAYSCALE)
            > 127
        )
        ann = json.loads((root / "ann" / a.split / f"{path.stem}.json").read_text())
        kinds.append(ann["tamper"]["type"])
        pages.append((bool(mask.any()), components(predict(sess, rgb), mask)))

    rules = []
    n_edited = sum(e for e, _ in pages)
    n_clean = len(pages) - n_edited
    for t, area in product(THRESHOLDS, MIN_AREAS):
        flagged = sum(
            any(a_ >= area for a_, _ in comps[t]) for edited, comps in pages if not edited
        )
        hit = sum(any(a_ >= area and h for a_, h in comps[t]) for edited, comps in pages if edited)
        by_type: dict[str, list[bool]] = {}
        for kind, (edited, comps) in zip(kinds, pages, strict=True):
            if edited:
                found = any(a_ >= area and h for a_, h in comps[t])
            else:
                found = any(a_ >= area for a_, _ in comps[t])
            by_type.setdefault(kind, []).append(found)
        rules.append(
            {
                "threshold": t,
                "min_area": area,
                "false_positive_rate": flagged / max(1, n_clean),
                "edited_detected": hit / max(1, n_edited),
                "marked_by_type": {k: sum(v) / len(v) for k, v in sorted(by_type.items())},
            }
        )
    extra = {}
    for path in a.extra:
        rgb = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
        comps = components(predict(sess, rgb), None)
        extra[Path(path).name] = {str(t): sorted(x for x, _ in comps[t]) for t in THRESHOLDS}
    out = {
        "evaluated_at": datetime.now(UTC).isoformat(),
        "model": a.model,
        "data_source": f"synthetic {a.split} split",
        "split": a.split,
        "unedited_pages": n_clean,
        "edited_pages": n_edited,
        "rules": rules,
        "extra_pages_region_areas": extra,
    }
    Path(a.out).write_text(json.dumps(out, indent=2))
    for r in rules:
        print(r)
    print(json.dumps(extra))


if __name__ == "__main__":
    main()
