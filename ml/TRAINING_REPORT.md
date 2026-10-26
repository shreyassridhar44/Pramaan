# Training report

Date: 2026-10-26. Commit trained from: 5a0baf8. Export and evaluation ran from 530432a, which changes only the ONNX parity check (see Notes).

## Machine
GPU: NVIDIA RTX A5000, 24 GB (24564 MiB), 1 used. Driver: 596.51. CUDA (torch): 13.0. CPU cores: 36 logical (Intel Xeon W-2295, 18 physical). RAM: 128 GB installed, 14.6 GB usable during the run (capped, see Notes). OS: Windows 11 Pro 10.0.22631 (Git Bash: MINGW64_NT-10.0-22631). Scheduler: none.
Python 3.12.15, torch 2.14.1+cu130, onnxruntime 1.31.0, lightgbm 4.7.0.

## Settings
Dataset: 24,000 train, 2,000 validation, 3,000 test, seed 2026, splits by layout, splice edits only in test.
Localiser: 24 epochs, batch 24, learning rate 4e-4, crop 512, ImageNet-initialised encoder.
Field extractor: 1,600 training and 300 test documents on the two unseen layouts.
Deviations from the defaults and why:
- Worker counts were lowered because physical RAM was capped to about 15 GB: 12 processes for dataset generation, 2 PyTorch data loader workers for training (the script default here would have been 12), 8 processes for the field extractor OCR. Batch size, epochs, learning rate, seeds and split sizes are unchanged. The loader worker count was chosen from a 40-step throughput and memory probe on the training split (2 workers: 0.46 s per step; 4 workers: 0.29 s per step but free RAM fell to 2.7 GB). The probe weights were discarded.
- The ONNX parity check now compares sigmoid probabilities instead of raw logits, with the same 1e-3 threshold (commit 530432a). The reason and the evidence are in the Notes.
- No learning rate change; training did not diverge.

## Timings
Dataset 0:21, training 3:13 (482 s per epoch on average, 495 s for the first epoch), export and evaluation 0:33 (export 0:00:24, test evaluation 0:32), field extractor 2:11.

## Results (synthetic test data)
Localiser, from eval/results/localiser.json (3,000 test images, 1,524 edited): image-level ROC AUC 0.9439594313922142, pixel F1 (micro) 0.7372616019023482, true positive rate at 0.5 0.9081364829396326, false positive rate at 0.5 0.1897018970189702; per edit type:
- copy_move_digit: pixel F1 mean 0.9672872555407511, detected at 0.5 1.0, n 338
- erase_retype_field: pixel F1 mean 0.9598035958031912, detected at 0.5 1.0, n 408
- font_insert_digit: pixel F1 mean 0.9603258796297558, detected at 0.5 1.0, n 402
- splice_field (unseen in training): pixel F1 mean 0.1523845733043516, detected at 0.5 0.6276595744680851, n 376
- none (unedited): signal raised at 0.5 on 0.1897018970189702 of 1,476 images

Best validation pixel F1 during training: 0.9662536515625968 at epoch 20.
ONNX parity max absolute difference: 0.00033292174339294434 (sigmoid probabilities, PyTorch CPU vs onnxruntime CPU).
Field extractor, from eval/results/field_extractor.json (300 test documents):

| Field | Trained model | Rule baseline |
|---|---|---|
| number | 1.0 | 1.0 |
| ifsc | 1.0 | 1.0 |
| amount | 0.99 | 0.99 |
| issue_date | 0.95 | 0.9366666666666666 |
| maturity_date | 0.99 | 0.9866666666666667 |
| mean exact match | 0.986 | 0.9826666666666666 |

## Notes
- Results are on synthetic receipts. The localiser output is a review signal that marks possibly edited regions for an officer; it is not a finding.
- The unseen splice_field type is the weak spot: a signal is raised on 63% of those images, but the marked region overlaps the true one poorly (mean pixel F1 0.15). About 19% of unedited test images also raise a signal at the 0.5 threshold, so the threshold may need tuning on validation data before officers rely on it.
- Faulty RAM. This workstation has a failing memory module. Windows logged 4,193 corrected ECC memory errors between 2026-10-01 and 2026-10-25, all at physical addresses between about 18.7 GB and 33.5 GB, and three 0x124 machine check restarts, one of them during the first smoke run. Before the real run the owner capped usable memory with `bcdedit /set {current} truncatememory 0x440000000` (17 GB of physical address space). No memory errors were logged from then to the end of the run. The cap is why the worker counts were lowered. The smoke run was repeated with the cap in place and passed.
- ONNX parity. The first two exports failed the original check on raw logits (max absolute difference 0.0034, then 0.0024; threshold 1e-3). A read-only diagnosis on 3 random inputs and 6 validation and test images showed the trained model emits logits of about +-40, and onnxruntime's fused CPU kernels give a relative error of about 7e-5. With onnxruntime graph optimisations disabled the logit difference was below 4e-4. The largest probability difference was 3.6e-4, and no pixel changed its decision at 0.5. The API applies a sigmoid and uses probabilities (services/api/app/services/documents/forensics.py), so the owner approved checking parity on probabilities with the same threshold. The diagnosis computed no accuracy metrics and made no model choices.
- The test split was evaluated once, with the final exported model.
- Files changed under ml/: train/export_onnx.py (the parity check above; tests and ruff pass).
- The run used Windows rather than the Linux setup the guide assumes. It ran without tmux or SLURM as detached background processes, with the same scripts/train_all.sh stages.
