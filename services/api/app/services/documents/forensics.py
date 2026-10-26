"""Document forensics: a trained edit-localisation model (ONNX) when available, plus classical,
explainable signals that always run. Outputs are review signals, never verdicts."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import cv2
import numpy as np

MAX_SIDE = 1700
# Operating point for the learned localiser, chosen on validation data (EVALUATION.md): a region
# is kept only where the probability exceeds 0.98 over at least 300 pixels. At the raw 0.5
# threshold about a third of unedited validation pages got a mark; with this rule 3.9% do, and
# 99.5% of edited pages still get a mark on the edit.
REGION_THRESHOLD = 0.98
REGION_MIN_AREA = 300


@dataclass
class Region:
    box: tuple[int, int, int, int]
    score: float
    sources: list[str] = field(default_factory=list)


@dataclass
class ForensicsResult:
    heatmap: np.ndarray  # float32 in [0, 1], same size as the analysed image
    image_score: float
    regions: list[Region]
    method: str
    classical: dict[str, float]


def error_level(rgb: np.ndarray, quality: int = 90) -> np.ndarray:
    """Error level analysis: regions saved at a different compression level stand out after one
    more re-save. Returned as a smoothed map in [0, 1]."""
    _, buf = cv2.imencode(
        ".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, quality]
    )
    decoded = np.asarray(cv2.imdecode(buf, cv2.IMREAD_COLOR))
    resaved = np.asarray(cv2.cvtColor(decoded, cv2.COLOR_BGR2RGB), dtype=np.float32)
    raw = np.abs(rgb.astype(np.float32) - resaved).mean(axis=2).astype(np.float32)
    diff = np.asarray(cv2.blur(raw, (9, 9)), dtype=np.float32)
    hi = float(np.percentile(diff, 99.5)) or 1.0
    return np.asarray(np.clip(diff / (hi * 1.5), 0, 1), dtype=np.float32)


def noise_inconsistency(rgb: np.ndarray) -> np.ndarray:
    """Local noise level from a high-pass residual, as a z-score against the page median. Pasted or
    retyped regions often carry a different noise level from the surrounding scan."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    k = np.array([[-1, 2, -1], [2, -4, 2], [-1, 2, -1]], np.float32) / 4
    res = cv2.filter2D(gray, -1, k)
    local = cv2.blur(np.abs(res), (15, 15))
    med = np.median(local)
    mad = np.median(np.abs(local - med)) + 1e-3
    z = np.abs(local - med) / (6 * mad)
    return np.asarray(np.clip(z, 0, 1), dtype=np.float32)


class Localiser:
    def __init__(self, model_path: Path | None) -> None:
        self.session: Any = None
        self.version = "classical-1"
        if model_path and model_path.exists():
            import onnxruntime as ort

            self.session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
            self.version = f"localiser-{model_path.stem}"

    def predict(self, rgb: np.ndarray) -> np.ndarray | None:
        if self.session is None:
            return None
        h, w = rgb.shape[:2]
        ph, pw = (-h) % 32, (-w) % 32
        padded = cv2.copyMakeBorder(rgb, 0, ph, 0, pw, cv2.BORDER_REPLICATE)
        x = padded.astype(np.float32).transpose(2, 0, 1)[None] / 255.0
        logits = np.asarray(self.session.run(None, {"image": x})[0][0, 0, :h, :w])
        return np.asarray(1 / (1 + np.exp(-logits)), dtype=np.float32)


def _regions(heatmap: np.ndarray, threshold: float, min_area: int) -> list[Region]:
    raw = (heatmap > threshold).astype(np.uint8)
    binary = np.asarray(cv2.morphologyEx(raw, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8)))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        score = float(heatmap[labels == i].mean())
        out.append(Region((int(x), int(y), int(x + w), int(y + h)), score))
    return sorted(out, key=lambda r: -r.score)


def _field_outliers(heat: np.ndarray, boxes: dict[str, tuple[int, int, int, int]]) -> list[Region]:
    """Classical mode: compare each value field with the other value fields on the same page.
    Printing, watermarks and seals vary across the page, so absolute heat is unreliable; a field
    whose residuals stand out from its peers is the useful signal."""
    scores: dict[str, float] = {}
    for name, (x0, y0, x1, y1) in boxes.items():
        patch = heat[max(0, y0) : y1, max(0, x0) : x1]
        if patch.size:
            scores[name] = float(np.percentile(patch, 90))
    if len(scores) < 4:
        return []
    values = np.array(list(scores.values()))
    med = float(np.median(values))
    mad = float(np.median(np.abs(values - med))) + 1e-3
    flagged = [
        Region(boxes[n], min(1.0, 0.5 + (v - med) / (10 * mad)), ["error_level", "noise"])
        for n, v in scores.items()
        if v > med + 4 * mad and v - med > 0.08
    ]
    return sorted(flagged, key=lambda r: -r.score)[:2]


def analyse(
    rgb: np.ndarray,
    localiser: Localiser,
    value_boxes: dict[str, tuple[int, int, int, int]] | None = None,
) -> ForensicsResult:
    ela = error_level(rgb)
    noise = noise_inconsistency(rgb)
    learned = localiser.predict(rgb)
    classical = {
        "error_level_p99": float(np.percentile(ela, 99)),
        "noise_p99": float(np.percentile(noise, 99)),
    }
    if learned is not None:
        regions = _regions(learned, REGION_THRESHOLD, REGION_MIN_AREA)
        for r in regions:
            x0, y0, x1, y1 = r.box
            r.sources.append("model")
            if ela[y0:y1, x0:x1].mean() > 0.35:
                r.sources.append("error_level")
            if noise[y0:y1, x0:x1].mean() > 0.4:
                r.sources.append("noise")
        score = float(cv2.blur(learned, (9, 9)).max())
        return ForensicsResult(learned, score, regions[:8], localiser.version, classical)
    heat = np.asarray(0.5 * ela + 0.5 * noise, dtype=np.float32)
    regions = _field_outliers(heat, value_boxes or {})
    # Show heat only inside value fields: elsewhere it reflects printing, not edits.
    shown = np.zeros_like(heat)
    for x0, y0, x1, y1 in (value_boxes or {}).values():
        shown[max(0, y0) : y1, max(0, x0) : x1] = heat[max(0, y0) : y1, max(0, x0) : x1]
    score = max((r.score for r in regions), default=0.0)
    return ForensicsResult(shown, score, regions, "classical-1", classical)


def perceptual_hash(rgb: np.ndarray) -> str:
    """64-bit DCT perceptual hash as 16 hex characters. Near-identical scans differ in few bits."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    dct = cv2.dct(small)[:8, :8]
    med = np.median(dct[1:].ravel())
    bits = (dct > med).flatten()
    return f"{int(''.join('1' if b else '0' for b in bits), 2):016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def heatmap_png(heat: np.ndarray) -> bytes:
    """Heatmap as an RGBA PNG overlay: transparent where nothing is flagged, warm where flagged."""
    h8 = (np.clip(heat, 0, 1) * 255).astype(np.uint8)
    colour = cv2.applyColorMap(h8, cv2.COLORMAP_INFERNO)
    rgba = cv2.cvtColor(colour, cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = np.where(heat > 0.25, np.clip(heat * 230, 0, 230), 0).astype(np.uint8)
    ok, buf = cv2.imencode(".png", rgba)
    assert ok
    return buf.tobytes()


def fit(rgb: np.ndarray) -> np.ndarray:
    """Scale so the long side is at most MAX_SIDE, as the model was trained."""
    h, w = rgb.shape[:2]
    s = min(1.0, MAX_SIDE / max(h, w))
    return (
        rgb if s == 1.0 else cv2.resize(rgb, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
    )
