# Training guide for the GPU machine

This file is written for Claude Code (or a person) working on the training machine. Read it from top to bottom before running anything. When every step is finished, report **done** in the format in Section 11. The owner then pulls the repository on the development laptop and continues there.

Repository: `https://github.com/shreyassridhar44/Pramaan.git` (branch `main`).

## 1. The job in one paragraph

Pramaan reads fixed deposit receipts (FDRs) for AICTE. Two models need training on synthetic data:

1. A **localiser**: a U-Net with an EfficientNet-B0 encoder that marks possibly edited regions on a scanned receipt. It is trained on the GPU and exported to ONNX.
2. A **field extractor**: a LightGBM model that maps OCR tokens to FDR fields (bank, number, amount, dates). It is CPU-bound because of OCR.

The API already falls back to classical forensics and a rule-based extractor when these files are missing. Your job is to produce the real models and their test results, then push them to `main`.

## 2. Rules you must follow

These are the owner's standing instructions. They are not optional.

1. **Git identity.** Commit only as `Shreyas <shreyassridhar146@gmail.com>`. Set it on this clone only (Section 9). Never add `Co-Authored-By` lines, "Generated with" lines, or any mention of Claude or AI in commits. The owner does not want any AI tool shown as an author, co-author or contributor.
2. **Scope.** Only change files under `ml/`. Do not edit `services/`, `apps/`, `infra/`, the root documents, or `.github/workflows/`. The training scripts import `services/api/app/...` for the shared feature code; read it but do not change it.
3. **Honest numbers.** Every metric comes from the JSON files written by the scripts. Never type a number by hand, never round a result up, and never describe smoke-test numbers as results.
   - Evaluate on the test split once, with the final model.
   - Do not train several models and keep the one with the best test score.
   - If a choice must be made (for example a lower learning rate), make it on the validation F1 in `runs/loc/history.json`, and write it down in the report.
4. **Wording.** The models produce review signals for officers. Never write "forgery detected" or "fraud" in the report. Write "possibly edited region" or "signal".
5. **Never commit** datasets (`ml/data/`), checkpoints (`ml/runs/`), logs, `.env` files, tokens or passwords.
6. **No emojis and no em dashes** in anything you write into the repository.
7. **If something blocks you** (no GPU, no internet, push rejected for authentication, a quota), stop and ask the owner. Do not work around it by weakening the rules above.

## 3. What you must produce

| Path (relative to the repo root) | What it is | Committed |
|---|---|---|
| `ml/models/localiser.onnx` | Exported localiser, about 23 MB | Yes |
| `ml/models/localiser.json` | Model card written by the export: sha256, ONNX parity, training history | Yes |
| `ml/models/field_extractor.txt` | LightGBM field extractor | Yes |
| `ml/eval/results/localiser.json` | Test-split metrics for the localiser | Yes |
| `ml/eval/results/field_extractor.json` | Test-split metrics for the extractor and the rule baseline | Yes |
| `ml/TRAINING_REPORT.md` | Your report (template in Section 8) | Yes |

`.gitignore` already allows exactly these two model files and still ignores smoke files, data, runs and logs. Use the exact file names; the API loads them by name (`services/api/app/services/documents/pipeline.py`).

## 4. Look at the machine first

Run these and keep the output for the report:

```bash
nvidia-smi                       # GPU model, memory, driver version, other users' jobs
nproc                            # CPU cores
free -g                          # RAM
df -h . ; df -h /scratch 2>/dev/null ; df -h /tmp   # free disk; the dataset needs about 25 GB
uname -m                         # x86_64 or aarch64
which sbatch squeue sinfo 2>/dev/null   # is this a SLURM cluster?
curl -sI https://pypi.org | head -1     # internet on this node?
```

Decide:

- **SLURM present:** heavy work runs in a batch job (Section 7B). Many clusters forbid long jobs on the login node.
- **No SLURM:** run inside `tmux` or `screen` so a dropped SSH session does not kill training (Section 7A).
- **Several GPUs:** the training script uses one GPU. Pick an idle one with `export CUDA_VISIBLE_DEVICES=<index>`.
- **Compute nodes without internet:** do every download in Section 5 on a node that has internet (usually the login node). The caches live in your home directory, which compute nodes normally share.
- **Fast scratch storage:** put the dataset there and pass `DATA=/path/on/scratch/loc` to the script.

## 5. Set up

### 5.1 uv and Python

```bash
command -v uv || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv --version
uv python install 3.12           # uv manages its own Python; no root needed
```

### 5.2 Clone and install

```bash
git clone https://github.com/shreyassridhar44/Pramaan.git
cd Pramaan/ml
uv sync --group train --group dev
```

### 5.3 Check that PyTorch sees the GPU

```bash
uv run python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '-')"
```

On Linux x86_64 the PyPI wheel already includes CUDA, so this should print `True` and the GPU name. If it prints `False`:

1. Check the driver with `nvidia-smi`. Wheels for CUDA 12.8 need a recent driver; on an older driver use the `cu126` or `cu124` index instead.
2. Reinstall the CUDA build:

   ```bash
   uv pip install --reinstall torch --index-url https://download.pytorch.org/whl/cu128
   ```

   On `aarch64` (for example GH200), the PyPI wheel is CPU-only; this same command installs the ARM CUDA build.
3. From then on, run every command with `uv run --no-sync`, and pass `UV="uv run --no-sync"` to the pipeline script. Plain `uv run` would re-sync from the lock file and put the CPU wheel back.

Do not continue until the check prints `True`.

### 5.4 One-time downloads (on a node with internet)

```bash
uv run python -m synth.fonts                                          # OFL fonts for the renderer
uv run python -c "from train.model import Localiser; Localiser('imagenet'); print('encoder weights cached')"
uv run python -c "from rapidocr_onnxruntime import RapidOCR; RapidOCR(); print('ocr ready')"
```

The first command fills `ml/assets/fonts/` (ignored by git). The second caches the ImageNet EfficientNet-B0 weights. The third confirms that the OCR models bundled with the package load.

### 5.5 Unit tests

```bash
uv run pytest -q
uv run ruff check .
```

Both must pass before any training.

## 6. Smoke run (5 to 10 minutes)

This checks the whole pipeline on this machine with tiny sizes. It writes only `*_smoke` files, which git ignores.

```bash
SMOKE=1 bash scripts/train_all.sh
```

It must end with `finished` in `logs/pipeline.log`, and these must exist: `models/localiser_smoke.onnx`, `eval/results/localiser_smoke.json` and `eval/results/field_extractor_smoke.json`. The numbers mean nothing; never report them. If a stage fails, read Section 10 before changing anything.

Then delete the smoke outputs so they cannot be confused with real ones:

```bash
rm -rf data/loc_smoke runs/smoke models/*smoke* eval/results/*smoke* logs
```

## 7. Full run

The script `ml/scripts/train_all.sh` runs these stages in order. A stage is skipped if its output already exists, so a rerun after an interruption resumes at the first unfinished stage.

| Stage | Command inside the script | Output | Typical time |
|---|---|---|---|
| dataset | `synth.build_dataset --train 24000 --val 2000 --test 3000` | `$DATA/` (about 25 GB) | 30 to 40 min on 16 cores; faster with more |
| train | `train.localiser --epochs 24 --batch 24` | `runs/loc/best.pt`, `history.json` | 2 to 3 h on an RTX 4090; about 1 to 1.5 h on an A100 or H100 |
| export | `train.export_onnx` (fails if ONNX and PyTorch differ by more than 0.001) | `models/localiser.onnx`, `.json` | 1 min |
| eval | `eval.localiser_eval` on the test split | `eval/results/localiser.json` | 5 to 15 min |
| extractor | `train.field_extractor --train 1600 --test 300` | `models/field_extractor.txt`, `eval/results/field_extractor.json` | 20 to 40 min on 16 cores |

**Keep the defaults.** Batch 24, 24 epochs and learning rate 4e-4 are the documented settings, and the report compares against them.
- If the GPU has more memory, still use batch 24; the run is just faster.
- Lower to `BATCH=16` only if training stops with CUDA out of memory, and record that in the report.

The splits are by bank layout (8 train, 2 validation, 2 test), and the `splice_field` edit appears only in the test split. The test numbers therefore measure generalisation to unseen layouts and an unseen edit type. Do not change the seeds or the split sizes.

The training stage does not save mid-run checkpoints. If it is killed, delete `runs/loc` and run the script again; it resumes at the train stage. Ask SLURM for enough time (Section 7B).

### 7A. Without SLURM

```bash
tmux new -s pramaan        # reattach later with: tmux attach -t pramaan
cd ~/Pramaan/ml            # adjust to where you cloned it
export CUDA_VISIBLE_DEVICES=0
mkdir -p logs
DATA=data/loc bash scripts/train_all.sh 2>&1 | tee logs/full_run.log
```

### 7B. With SLURM

Find a GPU partition with `sinfo -o "%P %G %l %D %t"`. Then write `ml/scripts/train_all.sbatch` (do not commit it; it is machine-specific) and adjust the partition, account and module lines to this cluster:

```bash
#!/usr/bin/env bash
#SBATCH --job-name=pramaan-train
#SBATCH --partition=<gpu partition>
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=32
#SBATCH --mem=64G
#SBATCH --time=08:00:00
#SBATCH --output=logs/slurm-%j.out
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$SLURM_SUBMIT_DIR"
# module load cuda   # only if the cluster needs it for the driver libraries
WORKERS=$SLURM_CPUS_PER_TASK DATA=${DATA:-data/loc} bash scripts/train_all.sh
```

```bash
mkdir -p logs
sbatch scripts/train_all.sbatch
squeue -u "$USER"
tail -f logs/slurm-<jobid>.out
```

If the cluster has a CPU partition with many more cores, you can run `STAGES="dataset extractor"` there first and then `STAGES="train export eval"` on the GPU partition. The skip logic keeps the stages consistent.

### 7C. While it runs

- `logs/train.log` gets one JSON line per epoch, for example `{"epoch": 3, "loss": 0.41, "val_pixel_f1": 0.52, "seconds": 380.2}`. The validation pixel F1 should rise over the first epochs.
- A loss of `NaN`, or a validation F1 stuck near 0 after 5 epochs, means the run diverged. Stop it, delete `runs/loc`, and run once more with `--lr 2e-4`. To do that, edit `TRAIN_ARGS` in a local copy of the script, or run the `train.localiser` command by hand with the same arguments plus `--lr 2e-4`. Write the reason in the report. Do this at most once; if it diverges again, stop and ask the owner.
- Check GPU use with `nvidia-smi`. If GPU use is low and the CPU is saturated, the data loader is the bottleneck; that is acceptable.

## 8. Check the results and write the report

Run these checks from `ml/`:

```bash
ls -la models/localiser.onnx models/localiser.json models/field_extractor.txt eval/results/localiser.json eval/results/field_extractor.json
python3 -c "import json; c=json.load(open('models/localiser.json')); print('parity', c['onnx_parity_max_abs_diff'], 'best val F1', c['training']['best_val_pixel_f1'])"
cat eval/results/localiser.json
cat eval/results/field_extractor.json
du -m models/localiser.onnx models/field_extractor.txt    # each must be under 95 MB
uv run python - <<'EOF'
import numpy as np, onnxruntime as ort
s = ort.InferenceSession("models/localiser.onnx", providers=["CPUExecutionProvider"])
y = s.run(None, {"image": np.random.rand(1, 3, 544, 832).astype("float32")})[0]
print("cpu inference ok", y.shape)
EOF
```

Every check must pass:
- the parity value is below 0.001;
- the CPU inference prints a shape of `(1, 1, 544, 832)`, because the production server runs ONNX on CPU;
- both model files are under 95 MB.

If a model file is 95 MB or larger, stop and ask the owner; GitHub refuses files over 100 MB.

Then create `ml/TRAINING_REPORT.md` with this structure. Fill every value from the files and the commands above:

```markdown
# Training report

Date: <YYYY-MM-DD>. Commit trained from: <git rev-parse --short HEAD before your commit>.

## Machine
GPU: <name, memory, count used>. Driver: <version>. CUDA (torch): <torch.version.cuda>. CPU cores: <n>. RAM: <GB>. OS: <uname -sr>. Scheduler: <SLURM or none>.
Python <version>, torch <version>, onnxruntime <version>, lightgbm <version>.

## Settings
Dataset: 24,000 train, 2,000 validation, 3,000 test, seed 2026, splits by layout, splice edits only in test.
Localiser: <epochs>, batch <n>, learning rate <lr>, crop 512, ImageNet-initialised encoder.
Field extractor: 1,600 training and 300 test documents on the two unseen layouts.
Deviations from the defaults and why: <none, or the exact change and the validation evidence for it>.

## Timings
Dataset <h:mm>, training <h:mm> (<s> per epoch), export and evaluation <h:mm>, field extractor <h:mm>.

## Results (synthetic test data)
Localiser, from eval/results/localiser.json: image-level ROC AUC <x>, pixel F1 (micro) <x>, true positive rate at 0.5 <x>, false positive rate at 0.5 <x>; per edit type: <type: pixel F1 mean, detected at 0.5, n>, including the unseen splice_field type.
Best validation pixel F1 during training: <x> at epoch <n>.
ONNX parity max absolute difference: <x>.
Field extractor, from eval/results/field_extractor.json: <per-field exact match for the model and for the rule baseline, as given in the file>.

## Notes
<Anything the owner should know: warnings, retries, files changed under ml/ and why. Results are on synthetic receipts and are review signals, not findings.>
```

## 9. Commit and push

```bash
cd ..                                   # repository root
git config user.name "Shreyas"
git config user.email "shreyassridhar146@gmail.com"
git pull --rebase origin main           # the owner may have pushed since you cloned
git add ml/models/localiser.onnx ml/models/localiser.json ml/models/field_extractor.txt \
        ml/eval/results/localiser.json ml/eval/results/field_extractor.json ml/TRAINING_REPORT.md
git status --short                      # only the six files above (plus any ml/ fix you were forced to make)
git commit -m "feat(ml): add trained edit localiser and field extractor" \
           -m "Trained on synthetic FDRs; test results in ml/eval/results and ml/TRAINING_REPORT.md."
git log -1 --format='%an <%ae>%n%B'     # author must be Shreyas; no Co-Authored-By line
git push origin main
```

If the push asks for credentials or is rejected for authentication, stop and ask the owner. They will either give you a GitHub personal access token for this session or run `gh auth login` themselves. Never write a token into a file in the repository or into the remote URL.

If you had to fix a script under `ml/` (Section 10), commit that fix separately and first, as `fix(ml): <what>`. Run `uv run pytest -q` and `uv run ruff check .` in `ml/` before committing it.

After pushing, confirm the files arrived:

```bash
git fetch origin && git ls-tree -r --name-only origin/main ml/models ml/eval/results ml/TRAINING_REPORT.md
```

## 10. If something fails

| Symptom | What to do |
|---|---|
| `torch.cuda.is_available()` is `False` | Section 5.3. Check the driver; reinstall the CUDA wheel; use `uv run --no-sync`. |
| `CUDA out of memory` | `BATCH=16`. If it still fails, check `nvidia-smi` for other processes on that GPU and choose another one. |
| Font or encoder download fails on a compute node | Do Section 5.4 on the login node; make sure `$HOME` is shared. |
| Dataset generation is slow or killed for memory | Lower `WORKERS`. Each worker holds a few full-size images. |
| `ModuleNotFoundError: app...` in the field extractor | Run it from `ml/` inside a full clone; it adds `services/api` to the path itself. |
| ONNX parity assertion fails | Do not loosen the threshold. Rerun the export once. If it fails again, stop and ask the owner. |
| Training diverges | Section 7C, at most one retry with `--lr 2e-4`. |
| Results look poor | Report them as they are. Do not retrain to chase the test score. |
| A script has a real bug on Linux | Make the smallest fix under `ml/`. Run the tests and ruff, commit it as `fix(ml): ...` and describe it in the report. |

## 11. Reporting done

When the push has succeeded and the files are confirmed on `origin/main`, finish with exactly this block, filled in:

```
done
commit: <short sha> pushed to origin/main
localiser: image AUC <x>, pixel F1 <x>, best val F1 <x>, parity <x>
field extractor: <one line from field_extractor.json comparing model and baseline>
training time: <h:mm> on <GPU>
deviations: <none, or a short list>
```

The owner will then pull on the laptop. These steps happen there, not on this machine:
- the API picks up the models from `ml/models`;
- `EVALUATION.md` and the docs get these results;
- the deployment ships the models.
