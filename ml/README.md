# Pramaan ML kit

Everything needed to generate the synthetic FDR data, train the two models, evaluate them and hand the exported files to the API. All data is synthetic (see `DATA_SOURCES.md`). Run this on the GPU machine.

## What you will produce

| File | What it is | Used by |
|---|---|---|
| `models/localiser.onnx` (+ `.json` card) | Edit-localisation model: heatmap of possibly altered regions | API document analysis |
| `models/field_extractor.txt` | LightGBM token classifier that maps OCR text to FDR fields | API document analysis |
| `eval/results/localiser.json` | Test-split metrics for the localiser | `EVALUATION.md`, impact panel |
| `eval/results/field_extractor.json` | Test-split metrics for the extractor and the rule baseline | `EVALUATION.md` |

## 1. Set up (RTX 4090, Windows or Linux)

Requirements: Python 3.12, [uv](https://docs.astral.sh/uv/), NVIDIA driver with CUDA 12.x, about 25 GB free disk.

```bash
git clone https://github.com/shreyassridhar44/Pramaan.git
cd Pramaan/ml
uv sync --group train
# Replace the CPU build of PyTorch with the CUDA build:
uv pip install --reinstall torch --index-url https://download.pytorch.org/whl/cu128
uv run python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
uv run python -m synth.fonts          # downloads the OFL fonts once
```

The last line of the check must print `True NVIDIA GeForce RTX 4090`.

## 2. Generate the localisation dataset (about 30 to 40 minutes on 16 cores)

```bash
uv run python -m synth.build_dataset --out data/loc --train 24000 --val 2000 --test 3000 --workers 16
```

Splits are by bank layout (8 train, 2 validation, 2 test), and the `splice_field` edit is used only in the test split, so the test numbers measure generalisation to unseen layouts and an unseen edit type. Set `--workers` to your CPU core count.

## 3. Train the localiser (about 2 to 3 hours on an RTX 4090)

```bash
uv run python -m train.localiser --data data/loc --out runs/loc --epochs 24 --batch 24 --workers 12
```

One JSON line is printed per epoch with the validation pixel F1. `runs/loc/best.pt` keeps the best epoch. If you run out of GPU memory, use `--batch 16`.

## 4. Export and evaluate the localiser

```bash
uv run python -m train.export_onnx --weights runs/loc/best.pt --out models/localiser.onnx --history runs/loc/history.json
uv run python -m eval.localiser_eval --data data/loc --model models/localiser.onnx
```

The export checks ONNX against PyTorch and fails if they differ by more than 0.001.

## 5. Train and evaluate the field extractor (about 20 to 40 minutes, CPU-bound OCR)

```bash
uv run python -m train.field_extractor --train 1600 --test 300 --workers 16 --out models/field_extractor.txt
```

This reports per-field exact match on the two unseen layouts for both the trained model and the rule-based baseline.

## 6. Hand over

Copy these files into the repository's `ml/models/` and `ml/eval/results/` folders on the development machine (or send them to the team):

```
models/localiser.onnx
models/localiser.json
models/field_extractor.txt
eval/results/localiser.json
eval/results/field_extractor.json
```

ONNX and model files are not committed to git (they are large); the JSON results and model cards are committed. The API loads models from `MODELS_DIR` (default `ml/models`) and falls back to the classical forensics and the rule-based extractor if a file is missing, and it records which method produced every result.

## Smoke test (CPU, a few minutes)

```bash
uv run python -m synth.build_dataset --out data/loc_smoke --train 60 --val 16 --test 24 --workers 4
uv run python -m train.localiser --data data/loc_smoke --out runs/smoke --epochs 1 --batch 4 --workers 0 --crop 256
uv run python -m train.export_onnx --weights runs/smoke/best.pt --out models/localiser_smoke.onnx
```

Smoke-test numbers mean nothing and are never reported.

## Honesty rules

- Every number in `EVALUATION.md` comes from a file in `eval/results/` produced by these scripts.
- Results are on synthetic data and are labelled that way everywhere.
- Model outputs are review signals for officers, not findings of forgery.
