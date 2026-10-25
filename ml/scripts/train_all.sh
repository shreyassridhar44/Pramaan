#!/usr/bin/env bash
# Runs the whole ML pipeline: dataset, localiser training, ONNX export, evaluation and the field
# extractor. Each stage is skipped when its output already exists, so a rerun resumes after the
# last finished stage. See ml/TRAINING_GUIDE.md.
#
# Settings (environment variables):
#   SMOKE=1          tiny CPU-sized run that writes *_smoke files (ignored by git)
#   DATA=data/loc    where the localisation dataset is written (put it on fast scratch storage)
#   WORKERS=N        processes for dataset generation and OCR (default: all cores, at most 32)
#   LOADER=N         PyTorch data loader workers (default: WORKERS, at most 12)
#   BATCH=24         localiser batch size (lower to 16 only if the GPU runs out of memory)
#   EPOCHS=24        localiser epochs
#   STAGES="dataset train export eval extractor"   stages to run, in this order
#   UV="uv run"      set to "uv run --no-sync" after a manual torch reinstall
set -euo pipefail
cd "$(dirname "$0")/.."

cores=$( (command -v nproc >/dev/null && nproc) || echo 8)
SMOKE=${SMOKE:-0}
WORKERS=${WORKERS:-$((cores < 32 ? cores : 32))}
LOADER=${LOADER:-$((WORKERS < 12 ? WORKERS : 12))}
BATCH=${BATCH:-24}
EPOCHS=${EPOCHS:-24}
STAGES=${STAGES:-"dataset train export eval extractor"}
UV=${UV:-"uv run"}

if [ "$SMOKE" = "1" ]; then
  DATA=${DATA:-data/loc_smoke}
  RUN=runs/smoke
  SUFFIX=_smoke
  SIZES=(--train 60 --val 16 --test 24)
  TRAIN_ARGS=(--epochs 1 --batch 4 --workers 0 --crop 256)
  EXTRACT_SIZES=(--train 40 --test 10)
else
  DATA=${DATA:-data/loc}
  RUN=runs/loc
  SUFFIX=
  SIZES=(--train 24000 --val 2000 --test 3000)
  TRAIN_ARGS=(--epochs "$EPOCHS" --batch "$BATCH" --workers "$LOADER")
  EXTRACT_SIZES=(--train 1600 --test 300)
fi

mkdir -p logs models eval/results
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a logs/pipeline.log; }
wants() { [[ " $STAGES " == *" $1 "* ]]; }

log "start smoke=$SMOKE data=$DATA workers=$WORKERS loader=$LOADER stages=[$STAGES]"

if wants dataset; then
  if [ -f "$DATA/index.json" ]; then
    log "dataset: $DATA/index.json exists, skipping"
  else
    log "dataset: generating into $DATA"
    $UV python -m synth.build_dataset --out "$DATA" "${SIZES[@]}" --workers "$WORKERS" \
      2>&1 | tee logs/dataset.log
  fi
fi

if wants train; then
  if [ -f "$RUN/history.json" ]; then
    log "train: $RUN/history.json exists, skipping"
  else
    log "train: localiser into $RUN"
    $UV python -m train.localiser --data "$DATA" --out "$RUN" "${TRAIN_ARGS[@]}" \
      2>&1 | tee logs/train.log
  fi
fi

if wants export; then
  log "export: models/localiser$SUFFIX.onnx"
  $UV python -m train.export_onnx --weights "$RUN/best.pt" --out "models/localiser$SUFFIX.onnx" \
    --history "$RUN/history.json" 2>&1 | tee logs/export.log
fi

if wants eval; then
  log "eval: test split of $DATA"
  $UV python -m eval.localiser_eval --data "$DATA" --model "models/localiser$SUFFIX.onnx" \
    --out "eval/results/localiser$SUFFIX.json" 2>&1 | tee logs/eval.log
fi

if wants extractor; then
  log "extractor: models/field_extractor$SUFFIX.txt"
  $UV python -m train.field_extractor "${EXTRACT_SIZES[@]}" --workers "$WORKERS" \
    --out "models/field_extractor$SUFFIX.txt" \
    --results "eval/results/field_extractor$SUFFIX.json" 2>&1 | tee logs/extractor.log
fi

log "finished"
