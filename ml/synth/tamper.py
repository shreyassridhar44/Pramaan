"""Synthetic tampering of scanned receipts, with pixel masks (DATA_SOURCES.md 2.3).

Edits are made on the degraded scan, which is how a receipt is usually altered: scanned, edited in
software, re-saved and uploaded. Every edit records its type, the field touched, the original and
new values, and a mask of the edited pixels.
"""

import random
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageDraw

from synth.degrade import jpeg
from synth.fdr_render import font
from synth.fonts import FONTS

TAMPER_TYPES = ("copy_move_digit", "font_insert_digit", "erase_retype_field", "splice_field")
TARGET_FIELDS = ("amount", "maturity_date", "issue_date", "number")
_VALUE_FONTS = [k for k in FONTS if k.startswith(("mono", "sans", "serif"))]


@dataclass
class TamperResult:
    image: np.ndarray
    mask: np.ndarray
    meta: dict[str, Any]


def _background(img: np.ndarray, box: list[int]) -> np.ndarray:
    """Erase a region by inpainting from its surroundings."""
    x0, y0, x1, y1 = box
    m = np.zeros(img.shape[:2], np.uint8)
    m[max(0, y0 - 2) : y1 + 3, max(0, x0 - 2) : x1 + 3] = 255
    return cv2.inpaint(img, m, 3, cv2.INPAINT_TELEA)


def _ink_colour(img: np.ndarray, box: list[int]) -> tuple[int, int, int]:
    x0, y0, x1, y1 = box
    patch = img[y0:y1, x0:x1].reshape(-1, 3)
    if len(patch) == 0:
        return (30, 30, 35)
    dark = patch[patch.sum(axis=1) <= np.percentile(patch.sum(axis=1), 15)]
    return tuple(int(v) for v in dark.mean(axis=0)) if len(dark) else (30, 30, 35)  # type: ignore[return-value]


def _fit_size(text: str, font_key: str, target_h: int) -> int:
    """Font size whose rendered text height is closest to the original glyph height."""
    best, best_err = 12, 1e9
    for size in range(8, 120, 2):
        bb = font(font_key, size).getbbox(text)
        err = abs((bb[3] - bb[1]) - target_h)
        if err < best_err:
            best, best_err = size, err
    return best


def _draw_text(
    img: np.ndarray,
    box: list[int],
    text: str,
    font_key: str,
    colour: tuple[int, int, int],
    rng: random.Random,
) -> tuple[np.ndarray, list[int]]:
    """Draws `text` with its left edge at the box's left and its baseline on the box's bottom.
    Returns the new image and the box actually covered by the drawing."""
    x0, y0, _x1, y1 = box
    target_h = max(6, y1 - y0)
    size = max(8, int(_fit_size(text, font_key, target_h) * rng.uniform(0.94, 1.08)))
    f = font(font_key, size)
    pil = Image.fromarray(img)
    d = ImageDraw.Draw(pil)
    bb = d.textbbox((0, 0), text, font=f)
    ox = x0 - bb[0] + rng.uniform(-1.0, 1.0)
    oy = y1 - bb[3] + rng.uniform(-1.0, 1.0)
    d.text((ox, oy), text, font=f, fill=colour)
    drawn = [int(ox + bb[0]) - 1, int(oy + bb[1]) - 1, int(ox + bb[2]) + 2, int(oy + bb[3]) + 2]
    out = np.asarray(pil).copy()
    h, w = out.shape[:2]
    dx0, dy0 = max(0, drawn[0] - 2), max(0, drawn[1] - 2)
    dx1, dy1 = min(w, drawn[2] + 2), min(h, drawn[3] + 2)
    region = out[dy0:dy1, dx0:dx1]
    if region.size:
        out[dy0:dy1, dx0:dx1] = cv2.GaussianBlur(region, (0, 0), rng.uniform(0.3, 0.8))
    return out, [dx0, dy0, dx1 - 1, dy1 - 1]


def _mark(mask: np.ndarray, *boxes: list[int]) -> None:
    h, w = mask.shape
    for x0, y0, x1, y1 in boxes:
        mask[max(0, y0) : min(h, y1 + 1), max(0, x0) : min(w, x1 + 1)] = 255


def _digit_chars(field: dict[str, Any]) -> list[list[Any]]:
    return [c for c in field["chars"] if str(c[4]).isdigit()]


def _new_digit(old: str, rng: random.Random) -> str:
    return rng.choice([d for d in "0123456789" if d != old])


def tamper(
    img: np.ndarray,
    fields: dict[str, dict[str, Any]],
    rng: random.Random,
    kind: str,
    donor: tuple[np.ndarray, dict[str, dict[str, Any]]] | None = None,
) -> TamperResult:
    h, w = img.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    out = img.copy()
    target = rng.choice([f for f in TARGET_FIELDS if f in fields and _digit_chars(fields[f])])
    field = fields[target]
    meta: dict[str, Any] = {"type": kind, "field": target, "original": field["value"]}

    if kind in ("copy_move_digit", "font_insert_digit"):
        digits = _digit_chars(field)
        if target == "amount":
            # Change a leading digit: the edit that changes the value the most.
            candidates = digits[: max(1, min(2, len(digits)))]
        elif target in ("maturity_date", "issue_date"):
            candidates = digits[-2:]  # the year
        else:
            candidates = digits
        n_edit = 1 if rng.random() < 0.75 else min(2, len(candidates))
        chosen = rng.sample(candidates, n_edit)
        new_value = list(field["value"])
        for c in chosen:
            box = [int(v) for v in c[:4]]
            old = str(c[4])
            new = _new_digit(old, rng)
            if kind == "copy_move_digit":
                donors = [
                    d
                    for f in fields.values()
                    for d in f["chars"]
                    if str(d[4]) == new and d is not c
                ]
                if not donors:
                    kind = "font_insert_digit"
                    meta["type"] = kind
                else:
                    d = rng.choice(donors)
                    sx0, sy0, sx1, sy1 = (int(v) for v in d[:4])
                    patch = out[sy0 : sy1 + 1, sx0 : sx1 + 1]
                    out = _background(out, box)
                    tw, th = box[2] - box[0] + 1, box[3] - box[1] + 1
                    if patch.size and tw > 1 and th > 1:
                        patch = cv2.resize(patch, (tw, th), interpolation=cv2.INTER_LINEAR)
                        out[box[1] : box[3] + 1, box[0] : box[2] + 1] = patch
            if kind == "font_insert_digit":
                colour = _ink_colour(img, field["box"])
                out = _background(out, box)
                out, drawn = _draw_text(out, box, new, rng.choice(_VALUE_FONTS), colour, rng)
                _mark(mask, drawn)
            _mark(mask, box)
            idx = next(
                (i for i, ch in enumerate(field["value"]) if ch == old and i < len(new_value)), None
            )
            if idx is not None:
                new_value[idx] = new
        meta["new"] = "".join(new_value)

    elif kind == "erase_retype_field":
        box = field["box"]
        value = field["value"]
        digits = [i for i, ch in enumerate(value) if ch.isdigit()]
        chars = list(value)
        for i in rng.sample(digits, min(len(digits), rng.randint(1, 3))):
            chars[i] = _new_digit(chars[i], rng)
        new_value = "".join(chars)
        colour = _ink_colour(img, box)
        out = _background(out, box)
        out, drawn = _draw_text(out, box, new_value, rng.choice(_VALUE_FONTS), colour, rng)
        _mark(mask, box, drawn)
        meta["new"] = new_value

    elif kind == "splice_field":
        assert donor is not None, "splice needs a donor document"
        d_img, d_fields = donor
        src = d_fields.get(target) or next(iter(d_fields.values()))
        sx0, sy0, sx1, sy1 = src["box"]
        x0, y0, x1, y1 = field["box"]
        patch = d_img[sy0 : sy1 + 1, sx0 : sx1 + 1]
        th = y1 - y0 + 1
        tw = max(2, int(patch.shape[1] * th / max(1, patch.shape[0])))
        tw = min(tw, w - x0 - 1)
        out = _background(out, field["box"])
        if patch.size:
            out[y0 : y0 + th, x0 : x0 + tw] = cv2.resize(
                patch, (tw, th), interpolation=cv2.INTER_LINEAR
            )
            mask[y0 : y0 + th, x0 : x0 + tw] = 255
        mask[y0 : y1 + 1, x0 : x1 + 1] = 255
        meta["new"] = src["value"]
    else:
        raise ValueError(kind)

    out = jpeg(out, rng.randint(70, 95))
    return TamperResult(out, mask, meta)
