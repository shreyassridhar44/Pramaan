"""Print-and-scan degradation. Returns the degraded image and the homography that maps the
original coordinates to the degraded ones, so field and character boxes stay correct."""

import random
from typing import Any

import cv2
import numpy as np


def jpeg(img: np.ndarray, quality: int) -> np.ndarray:
    ok, buf = cv2.imencode(
        ".jpg", cv2.cvtColor(img, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, quality]
    )
    assert ok
    return cv2.cvtColor(cv2.imdecode(buf, cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)


def transform_box(box: list[int], m: np.ndarray, w: int, h: int) -> list[int]:
    x0, y0, x1, y1 = box[:4]
    pts = np.array([[[x0, y0]], [[x1, y0]], [[x1, y1]], [[x0, y1]]], dtype=np.float32)
    t = cv2.perspectiveTransform(pts, m).reshape(-1, 2)
    return [
        max(0, int(t[:, 0].min())),
        max(0, int(t[:, 1].min())),
        min(w - 1, int(np.ceil(t[:, 0].max()))),
        min(h - 1, int(np.ceil(t[:, 1].max()))),
    ]


def transform_fields(
    fields: dict[str, dict[str, Any]], m: np.ndarray, w: int, h: int
) -> dict[str, dict[str, Any]]:
    out = {}
    for name, f in fields.items():
        out[name] = {
            "value": f["value"],
            "box": transform_box(f["box"], m, w, h),
            "chars": [[*transform_box(c[:4], m, w, h), c[4]] for c in f["chars"]],
        }
    return out


def degrade(
    img: np.ndarray, rng: random.Random, strength: float = 1.0
) -> tuple[np.ndarray, np.ndarray]:
    h, w = img.shape[:2]
    paper = tuple(int(v) for v in np.median(img.reshape(-1, 3), axis=0))

    jitter = 14 * strength
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32(
        [
            [rng.uniform(-jitter, jitter), rng.uniform(-jitter, jitter)],
            [w + rng.uniform(-jitter, jitter), rng.uniform(-jitter, jitter)],
            [w + rng.uniform(-jitter, jitter), h + rng.uniform(-jitter, jitter)],
            [rng.uniform(-jitter, jitter), h + rng.uniform(-jitter, jitter)],
        ]
    )
    angle = rng.uniform(-1.4, 1.4) * strength
    rot = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    rot3 = np.vstack([rot, [0, 0, 1]]).astype(np.float32)
    m = rot3 @ cv2.getPerspectiveTransform(src, dst)
    out = cv2.warpPerspective(img, m, (w, h), borderMode=cv2.BORDER_CONSTANT, borderValue=paper)

    scale = rng.uniform(0.62, 0.95)
    small = cv2.resize(out, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    out = cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)

    sigma = rng.uniform(0.2, 1.1) * strength
    out = cv2.GaussianBlur(out, (0, 0), sigma)

    # Lighting is smooth, so compute it at low resolution and upscale.
    lw, lh = 170, 110
    xx = np.linspace(-0.5, 0.5, lw, dtype=np.float32)[None, :]
    yy = np.linspace(-0.5, 0.5, lh, dtype=np.float32)[:, None]
    gx, gy = rng.uniform(-1, 1), rng.uniform(-1, 1)
    light = 1.0 + 0.08 * strength * (gx * xx + gy * yy)
    if rng.random() < 0.3:
        fx = rng.uniform(-0.3, 0.3)
        light = light - 0.06 * np.exp(-((xx - fx) ** 2) / (2 * 0.01**2))
    light = cv2.resize(light.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
    gen = np.random.default_rng(rng.randint(0, 2**31))
    noise = gen.normal(0, rng.uniform(1.5, 6) * strength, (h, w, 1)).astype(np.float32)
    out = np.clip(out.astype(np.float32) * light[..., None] + noise, 0, 255).astype(np.uint8)
    out = jpeg(out, rng.randint(62, 92))
    return out, m
