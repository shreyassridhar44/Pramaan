r"""Train the edit-localisation model.

Usage (RTX 4090):
  uv run python -m train.localiser --data data/loc --out runs/loc --epochs 24 --batch 24 \
    --workers 12
Smoke test on CPU:
  uv run python -m train.localiser --data data/loc_smoke --out runs/smoke --epochs 1 --batch 2 \
    --workers 0 --crop 256
"""

import argparse
import json
import random
import time
from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset

from train.model import Localiser, dice_bce


class CropDataset(Dataset):
    """Random crops; most crops of edited images contain the edit so the model sees enough
    positives. JPEG re-compression and rescaling augmentations mimic re-saved uploads."""

    def __init__(self, root: Path, split: str, crop: int, train: bool) -> None:
        self.images = sorted((root / "images" / split).glob("*.jpg"))
        self.root, self.split, self.crop, self.train = root, split, crop, train

    def __len__(self) -> int:
        return len(self.images)

    def __getitem__(self, i: int) -> tuple[torch.Tensor, torch.Tensor]:
        path = self.images[i]
        img = cv2.cvtColor(cv2.imread(str(path)), cv2.COLOR_BGR2RGB)
        mask = cv2.imread(
            str(self.root / "masks" / self.split / f"{path.stem}.png"), cv2.IMREAD_GRAYSCALE
        )
        rng = random.Random(None if self.train else i)
        if self.train and rng.random() < 0.3:
            q = rng.randint(55, 95)
            _ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
            img = cv2.imdecode(buf, cv2.IMREAD_UNCHANGED)
        if self.train and rng.random() < 0.3:
            s = rng.uniform(0.7, 1.0)
            h, w = img.shape[:2]
            img = cv2.resize(
                cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA), (w, h)
            )
        h, w = mask.shape
        c = self.crop
        ys, xs = np.nonzero(mask)
        if len(ys) and rng.random() < 0.8:
            cy, cx = int(ys.mean()), int(xs.mean())
            y0 = min(max(0, cy - rng.randint(c // 6, 5 * c // 6)), h - c)
            x0 = min(max(0, cx - rng.randint(c // 6, 5 * c // 6)), w - c)
        else:
            y0, x0 = rng.randint(0, h - c), rng.randint(0, w - c)
        img_c = img[y0 : y0 + c, x0 : x0 + c].astype(np.float32) / 255.0
        mask_c = (mask[y0 : y0 + c, x0 : x0 + c] > 127).astype(np.float32)
        return torch.from_numpy(img_c).permute(2, 0, 1), torch.from_numpy(mask_c)[None]


def pixel_scores(logits: torch.Tensor, target: torch.Tensor) -> tuple[float, float, float]:
    pred = (torch.sigmoid(logits) > 0.5).float()
    tp = (pred * target).sum().item()
    fp = (pred * (1 - target)).sum().item()
    fn = ((1 - pred) * target).sum().item()
    return tp, fp, fn


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data/loc")
    p.add_argument("--out", default="runs/loc")
    p.add_argument("--epochs", type=int, default=24)
    p.add_argument("--batch", type=int, default=24)
    p.add_argument("--crop", type=int, default=512)
    p.add_argument("--lr", type=float, default=4e-4)
    p.add_argument("--workers", type=int, default=8)
    p.add_argument("--no-pretrained", action="store_true")
    a = p.parse_args()
    torch.manual_seed(2026)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    root, out = Path(a.data), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    train_ds = CropDataset(root, "train", a.crop, True)
    val_ds = CropDataset(root, "val", a.crop, False)
    train_dl = DataLoader(
        train_ds,
        a.batch,
        shuffle=True,
        num_workers=a.workers,
        pin_memory=True,
        drop_last=True,
        persistent_workers=a.workers > 0,
    )
    val_dl = DataLoader(val_ds, a.batch, shuffle=False, num_workers=a.workers)

    model = Localiser(None if a.no_pretrained else "imagenet").to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=1e-4)
    steps = a.epochs * max(1, len(train_dl))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=a.lr, total_steps=steps, pct_start=0.1)
    scaler = torch.amp.GradScaler(enabled=device == "cuda")
    best_f1, history = -1.0, []

    for epoch in range(a.epochs):
        model.train()
        t0, running = time.time(), 0.0
        for x, y in train_dl:
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            opt.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device, dtype=torch.float16, enabled=device == "cuda"):
                loss = dice_bce(model(x), y)
            scaler.scale(loss).backward()
            scaler.step(opt)
            scaler.update()
            sched.step()
            running += loss.item()
        model.eval()
        tp = fp = fn = 0.0
        with torch.no_grad():
            for x, y in val_dl:
                x, y = x.to(device), y.to(device)
                with torch.autocast(
                    device_type=device, dtype=torch.float16, enabled=device == "cuda"
                ):
                    logits = model(x)
                a_, b_, c_ = pixel_scores(logits.float(), y)
                tp, fp, fn = tp + a_, fp + b_, fn + c_
        f1 = 2 * tp / max(1.0, 2 * tp + fp + fn)
        rec = {
            "epoch": epoch + 1,
            "loss": running / max(1, len(train_dl)),
            "val_pixel_f1": f1,
            "seconds": round(time.time() - t0, 1),
        }
        history.append(rec)
        print(json.dumps(rec), flush=True)
        if f1 > best_f1:
            best_f1 = f1
            torch.save(model.state_dict(), out / "best.pt")
    torch.save(model.state_dict(), out / "last.pt")
    (out / "history.json").write_text(
        json.dumps({"best_val_pixel_f1": best_f1, "history": history, "args": vars(a)}, indent=2)
    )
    print(f"best val pixel F1 {best_f1:.3f}; weights in {out / 'best.pt'}")


if __name__ == "__main__":
    main()
