import random

import numpy as np
import pytest

from synth.degrade import degrade, transform_fields
from synth.fdr_render import BANKS, FdrData, inr_grouped, random_receipt, render, rupees_in_words
from synth.tamper import TAMPER_TYPES, tamper


def test_render_is_deterministic_by_seed() -> None:
    a = random_receipt(11, "BHNX")
    b = random_receipt(11, "BHNX")
    assert np.array_equal(a.image, b.image)
    assert a.fields == b.fields


@pytest.mark.parametrize("bank", [b.code for b in BANKS])
def test_every_layout_renders_all_fields_inside_the_page(bank: str) -> None:
    r = random_receipt(3, bank)
    h, w = r.image.shape[:2]
    for name in ("number", "amount", "issue_date", "maturity_date", "ifsc", "holders", "lien"):
        x0, y0, x1, y1 = r.fields[name]["box"]
        assert 0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h, name


def test_character_boxes_lie_inside_their_field_box() -> None:
    r = random_receipt(5)
    for f in r.fields.values():
        fx0, fy0, fx1, fy1 = f["box"]
        for x0, y0, x1, y1, _ in f["chars"]:
            assert fx0 - 2 <= x0 and x1 <= fx1 + 2 and fy0 - 2 <= y0 and y1 <= fy1 + 2


def test_indian_words_and_grouping() -> None:
    assert inr_grouped(3500000) == "35,00,000"
    assert rupees_in_words(3500000) == "Thirty Five Lakh"
    assert rupees_in_words(10000000) == "One Crore"
    assert rupees_in_words(1550000) == "Fifteen Lakh Fifty Thousand"


@pytest.mark.parametrize("kind", TAMPER_TYPES)
def test_tamper_changes_pixels_only_inside_the_mask(kind: str) -> None:
    rng = random.Random(9)
    data = FdrData.random(random.Random(9), BANKS[0])
    r = render(data, random.Random(10))
    img, m = degrade(r.image, rng)
    fields = transform_fields(r.fields, m, img.shape[1], img.shape[0])
    donor = None
    if kind == "splice_field":
        d = random_receipt(77)
        dimg, dm = degrade(d.image, rng)
        donor = (dimg, transform_fields(d.fields, dm, dimg.shape[1], dimg.shape[0]))
    t = tamper(img, fields, rng, kind, donor)
    assert t.mask.any()
    assert t.meta["new"] != t.meta["original"]
    # Outside a margin around the mask, only JPEG noise differs: the mean change is small.
    margin = np.zeros_like(t.mask)
    ys, xs = np.nonzero(t.mask)
    margin[max(0, ys.min() - 12) : ys.max() + 12, max(0, xs.min() - 12) : xs.max() + 12] = 1
    diff = np.abs(t.image.astype(np.int16) - img.astype(np.int16)).mean(axis=2)
    assert diff[margin == 0].mean() < 3.0
    assert diff[t.mask > 0].mean() > diff[margin == 0].mean()
