r"""Builds the edit-localisation dataset.

Splits are by bank layout so the test set uses layouts the model never saw, and the `splice_field`
edit type is held out of training and validation entirely (DATA_SOURCES.md 2.4).

Usage:
  uv run python -m synth.build_dataset --out data/loc --train 24000 --val 2000 --test 3000 \
    --workers 12
"""

import argparse
import json
import random
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import cv2
import numpy as np
from tqdm import tqdm

from synth.degrade import degrade, transform_fields
from synth.fdr_render import BANK_BY_CODE, FdrData, render
from synth.fonts import ensure_fonts
from synth.tamper import tamper

SPLIT_BANKS = {
    "train": ("BHNX", "VCBX", "DCCX", "KMBX", "SAHX", "NARX", "GGBX", "MFBX"),
    "val": ("KTBX", "ARVX"),
    "test": ("HUBX", "BRPX"),
}
SPLIT_TYPES = {
    "train": ("copy_move_digit", "font_insert_digit", "erase_retype_field"),
    "val": ("copy_move_digit", "font_insert_digit", "erase_retype_field"),
    "test": ("copy_move_digit", "font_insert_digit", "erase_retype_field", "splice_field"),
}
GENERATOR_VERSION = "1"


def _scan(seed: int, bank: str, rng: random.Random) -> tuple[np.ndarray, dict, FdrData]:
    data = FdrData.random(random.Random(seed), BANK_BY_CODE[bank])
    r = render(data, random.Random(seed + 1))
    img, m = degrade(r.image, rng)
    return img, transform_fields(r.fields, m, img.shape[1], img.shape[0]), data


def make_sample(args: tuple[str, int, int, str]) -> dict:
    split, index, seed, out = args
    rng = random.Random(seed)
    bank = rng.choice(SPLIT_BANKS[split])
    img, fields, data = _scan(seed, bank, rng)
    mask = np.zeros(img.shape[:2], np.uint8)
    meta: dict = {"type": "none"}
    if rng.random() < 0.5:
        kind = rng.choice(SPLIT_TYPES[split])
        donor = None
        if kind == "splice_field":
            dimg, dfields, _ = _scan(seed + 7919, rng.choice(SPLIT_BANKS[split]), rng)
            donor = (dimg, dfields)
        t = tamper(img, fields, rng, kind, donor)
        img, mask, meta = t.image, t.mask, t.meta
    else:
        from synth.degrade import jpeg

        img = jpeg(img, rng.randint(70, 95))

    root = Path(out)
    name = f"{split}_{index:06d}"
    cv2.imwrite(
        str(root / "images" / split / f"{name}.jpg"),
        cv2.cvtColor(img, cv2.COLOR_RGB2BGR),
        [cv2.IMWRITE_JPEG_QUALITY, 96],
    )
    cv2.imwrite(str(root / "masks" / split / f"{name}.png"), mask)
    ann = {
        "name": name,
        "bank": bank,
        "seed": seed,
        "tamper": meta,
        "fields": fields,
        "values": {
            "number": data.number,
            "ifsc": data.ifsc,
            "amount_rupees": data.amount_rupees,
            "issue": data.issue.isoformat(),
            "maturity": data.maturity.isoformat(),
            "holders": list(data.holders),
            "lien": data.lien,
            "bank": data.bank.name,
        },
    }
    (root / "ann" / split / f"{name}.json").write_text(json.dumps(ann))
    return {"name": name, "split": split, "tampered": meta["type"] != "none", "type": meta["type"]}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="data/loc")
    p.add_argument("--train", type=int, default=24000)
    p.add_argument("--val", type=int, default=2000)
    p.add_argument("--test", type=int, default=3000)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--seed", type=int, default=2026)
    a = p.parse_args()
    ensure_fonts()
    root = Path(a.out)
    for sub in ("images", "masks", "ann"):
        for split in SPLIT_BANKS:
            (root / sub / split).mkdir(parents=True, exist_ok=True)
    jobs = []
    for split, n, offset in (
        ("train", a.train, 0),
        ("val", a.val, 10**7),
        ("test", a.test, 2 * 10**7),
    ):
        jobs += [(split, i, a.seed * 10**8 + offset + i, str(root)) for i in range(n)]
    index = []
    with ProcessPoolExecutor(a.workers) as ex:
        for rec in tqdm(ex.map(make_sample, jobs, chunksize=16), total=len(jobs)):
            index.append(rec)
    (root / "index.json").write_text(
        json.dumps(
            {
                "generator_version": GENERATOR_VERSION,
                "seed": a.seed,
                "splits": SPLIT_BANKS,
                "tamper_types": SPLIT_TYPES,
                "samples": index,
            }
        )
    )
    print(f"wrote {len(index)} samples to {root}")


if __name__ == "__main__":
    main()
