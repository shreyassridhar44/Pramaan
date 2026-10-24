"""Evaluate the exported ONNX localiser on the held-out test split (unseen layouts, plus the
held-out splice edit type). Uses the same preprocessing as production inference.

Usage: uv run python -m eval.localiser_eval --data data/loc --model models/localiser.onnx
Writes eval/results/localiser.json, which EVALUATION.md cites.
"""

import argparse
import json
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from sklearn.metrics import roc_auc_score
from tqdm import tqdm

MAX_SIDE = 1700


def preprocess(rgb: np.ndarray) -> tuple[np.ndarray, tuple[int, int], float]:
    """Resize so the long side is at most MAX_SIDE, pad to multiples of 32 (edge replicate)."""
    h, w = rgb.shape[:2]
    scale = min(1.0, MAX_SIDE / max(h, w))
    if scale < 1.0:
        rgb = cv2.resize(rgb, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    h2, w2 = rgb.shape[:2]
    ph, pw = (-h2) % 32, (-w2) % 32
    padded = cv2.copyMakeBorder(rgb, 0, ph, 0, pw, cv2.BORDER_REPLICATE)
    x = padded.astype(np.float32).transpose(2, 0, 1)[None] / 255.0
    return x, (h2, w2), scale


def image_score(prob: np.ndarray) -> float:
    """Max of a 9x9 mean-filtered probability map: robust to isolated noisy pixels."""
    return float(cv2.blur(prob, (9, 9)).max())


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data/loc")
    p.add_argument("--model", default="models/localiser.onnx")
    p.add_argument("--split", default="test")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--out", default="eval/results/localiser.json")
    a = p.parse_args()
    root = Path(a.data)
    providers = [
        p
        for p in ("CUDAExecutionProvider", "CPUExecutionProvider")
        if p in ort.get_available_providers()
    ]
    sess = ort.InferenceSession(a.model, providers=providers)
    images = sorted((root / "images" / a.split).glob("*.jpg"))
    if a.limit:
        images = images[: a.limit]

    per_type: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    labels, scores = [], []
    tp_all = fp_all = fn_all = 0.0
    for path in tqdm(images):
        rgb = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)
        mask = (
            cv2.imread(str(root / "masks" / a.split / f"{path.stem}.png"), cv2.IMREAD_GRAYSCALE)
            > 127
        )
        ann = json.loads((root / "ann" / a.split / f"{path.stem}.json").read_text())
        x, (h2, w2), scale = preprocess(rgb)
        logits = sess.run(None, {"image": x})[0][0, 0, :h2, :w2]
        prob = 1 / (1 + np.exp(-logits))
        if scale < 1.0:
            prob = cv2.resize(prob, (mask.shape[1], mask.shape[0]))
        pred = prob > 0.5
        tampered = bool(mask.any())
        kind = ann["tamper"]["type"]
        labels.append(int(tampered))
        scores.append(image_score(prob))
        tp = float((pred & mask).sum())
        fp = float((pred & ~mask).sum())
        fn = float((~pred & mask).sum())
        tp_all, fp_all, fn_all = tp_all + tp, fp_all + fp, fn_all + fn
        if tampered:
            per_type[kind]["f1"].append(2 * tp / max(1.0, 2 * tp + fp + fn))
            per_type[kind]["iou"].append(tp / max(1.0, tp + fp + fn))
        per_type[kind]["score"].append(scores[-1])

    labels_arr, scores_arr = np.array(labels), np.array(scores)
    clean_scores = scores_arr[labels_arr == 0]
    edited_scores = scores_arr[labels_arr == 1]
    result = {
        "evaluated_at": datetime.now(UTC).isoformat(),
        "model": a.model,
        "data": str(root),
        "split": a.split,
        "data_source": "synthetic (held-out layouts; splice edits unseen in training)",
        "images": len(images),
        "edited_images": int(labels_arr.sum()),
        "image_auc": float(roc_auc_score(labels_arr, scores_arr))
        if 0 < labels_arr.sum() < len(labels_arr)
        else None,
        "pixel_f1_micro": 2 * tp_all / max(1.0, 2 * tp_all + fp_all + fn_all),
        "false_positive_rate_at_0_5": float((clean_scores > 0.5).mean())
        if len(clean_scores)
        else None,
        "true_positive_rate_at_0_5": float((edited_scores > 0.5).mean())
        if len(edited_scores)
        else None,
        "by_type": {
            k: {
                "n": len(v["score"]),
                "pixel_f1_mean": float(np.mean(v["f1"])) if v["f1"] else None,
                "iou_mean": float(np.mean(v["iou"])) if v["iou"] else None,
                "detected_at_0_5": float(np.mean(np.array(v["score"]) > 0.5)),
            }
            for k, v in sorted(per_type.items())
        },
    }
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
