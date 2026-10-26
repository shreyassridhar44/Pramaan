"""Guilloche curves for letters: the same seeded rosettes and woven bands as the web app.

A letter's rosette is derived from its reference, so every letter carries its own pattern. This is
decoration in the tradition of security printing; the letter's authenticity rests on the signed QR
token, not on the pattern.
"""

import hashlib
import math
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Layer:
    radius: float
    petals: int
    counter: int
    depth: float
    ripple: float
    strands: int


def rosette_layers(seed: str) -> list[Layer]:
    digest = hashlib.sha256(seed.encode()).digest()

    def pick(i: int, lo: int, hi: int) -> int:
        return lo + digest[i] % (hi - lo + 1)

    def frac(i: int) -> float:
        return digest[i] / 255

    return [
        Layer(78, pick(0, 9, 18), pick(1, 3, 7), 9 + frac(2) * 6, 3 + frac(3) * 4, pick(4, 10, 16)),
        Layer(50, pick(5, 6, 12), pick(6, 2, 5), 7 + frac(7) * 6, 2 + frac(8) * 3, pick(9, 8, 12)),
        Layer(
            24, pick(10, 5, 9), pick(11, 2, 4), 6 + frac(12) * 4, 1.5 + frac(13) * 2, pick(14, 6, 9)
        ),
    ]


def rosette_strands(layer: Layer, steps: int = 360) -> list[list[tuple[float, float]]]:
    """Points of each strand around (0, 0), in units where the outer radius is about 100."""
    out = []
    for k in range(layer.strands):
        phase = 2 * math.pi * k / layer.strands
        pts = []
        for i in range(steps + 1):
            t = 2 * math.pi * i / steps
            r = (
                layer.radius
                + layer.depth * math.sin(layer.petals * t + phase)
                + layer.ripple * math.sin(layer.counter * t - phase * 2)
            )
            pts.append((r * math.cos(t), r * math.sin(t)))
        out.append(pts)
    return out


def band_strands(
    length: float, amplitude: float, wavelength: float, strands: int, step: float = 2.0
) -> list[list[tuple[float, float]]]:
    """A woven band along the x axis from 0 to `length`, centred on y = 0."""
    out = []
    for k in range(strands):
        phase = 2 * math.pi * k / strands
        pts = []
        x = 0.0
        while x <= length + step:
            y = amplitude * math.sin(
                2 * math.pi * x / wavelength + phase
            ) + amplitude * 0.6 * math.sin(2 * math.pi * x / (wavelength * 2.7) - phase)
            pts.append((x, y))
            x += step
        out.append(pts)
    return out
