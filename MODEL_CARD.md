# Model card

Status: planned. Models are trained in Step 3 and Step 6 of `claude-code/STEPS.md`. This card is updated with real figures only after evaluation runs; until then every metric field reads "not yet measured".

## 1. Edit-localisation model

| Item | Detail |
|---|---|
| Task | Pixel-level localisation of regions on an FDR image that may have been digitally altered, plus an image-level score |
| Architecture | U-Net with EfficientNet-B0 encoder (segmentation-models-pytorch), input RGB plus 3 high-pass noise-residual channels, output one-channel probability map |
| Training data | Synthetic FDRs from 8 fictional bank layouts with synthetic edits and masks (`DATA_SOURCES.md` 2.2 to 2.4) |
| Training | Dice plus binary cross-entropy, AdamW, mixed precision, 512 by 512 crops, on the team's GPU machine |
| Inference | ONNX Runtime on CPU in the worker; full page resized to a fixed long side |
| Metrics | Pixel F1, IoU, image-level ROC AUC on held-out layouts and a held-out edit type: not yet measured |
| Intended use | Prompt an AICTE officer to look closely at a region before accepting a document |
| Not intended for | Deciding that a document is forged; any automated rejection; evidence in proceedings |
| Known limits | Trained only on synthetic data; real scans, phone photos, and edit methods outside the training set may behave differently; high JPEG compression can create false positives |
| Human oversight | Output appears as a signal with the heatmap; an officer must confirm or dismiss with a reason |

## 2. Field extractor

| Item | Detail |
|---|---|
| Task | Assign OCR tokens to FDR fields (number, amount, dates, holders, bank, IFSC, lien) |
| Method | OCR by PP-OCR models (RapidOCR, ONNX); LightGBM token classifier on text, position and neighbourhood features; validation rules (IFSC pattern, date order, amount in words matches figures) |
| Training data | Synthetic FDRs, split by layout |
| Metrics | Per-field exact match, precision and recall on unseen layouts: not yet measured |
| Intended use | Pre-fill and cross-check; every extracted value is stored as "extracted" with confidence and never overwrites declared or confirmed values |
| Known limits | Unseen layouts, handwritten corrections, very low-resolution scans |

## 3. OCR

Pretrained PP-OCR detection and recognition models via RapidOCR. Not retrained. Licence and version recorded in `THIRD_PARTY.md`.

## 4. Portfolio anomaly model (priority P2)

| Item | Detail |
|---|---|
| Method | Isolation Forest (scikit-learn) |
| Features | Amount against Table 1.4 expectation, tenure against term rule, intimation-to-furnishing lag, branch concentration across institutions, renewal gaps |
| Training data | Synthetic portfolio with injected anomalies |
| Metric | Recall of injected anomalies at a fixed review budget: not yet measured |
| Intended use | Review prompt with top contributing features shown |

## 5. Plain-language search

| Item | Detail |
|---|---|
| Model | Anthropic Claude Haiku 4.5 on Amazon Bedrock, India-resident inference profile `in.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Input | The officer's query text and the filter JSON schema; no records, documents or personal data |
| Output | A filter object validated against the schema; shown to the officer as editable chips before use |
| Metric | Schema-valid rate and exact filter match on a 60-query test set: not yet measured |
| Fallback | Deterministic parser for common phrasings |

## 6. Ethical considerations

- Signals affect how institutions are treated, so wording is neutral and every signal can be dismissed with a reason that is audited.
- No model outputs are used to change state, impose penalties or deny release.
- Synthetic data avoids real institutions and banks; results do not claim real-world accuracy.
