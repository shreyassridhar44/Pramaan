# Model card

Status: trained and evaluated on 26 October 2026 (`ml/TRAINING_REPORT.md`). Every figure is on synthetic data and comes from the result files named in `EVALUATION.md` Section 3.

## 1. Edit-localisation model

| Item | Detail |
|---|---|
| Task | Pixel-level localisation of regions on an FDR image that may have been digitally altered, plus an image-level score |
| Architecture | U-Net with EfficientNet-B0 encoder (segmentation-models-pytorch), input RGB plus 3 high-pass noise-residual channels, output one-channel probability map |
| Training data | 24,000 synthetic FDRs from 8 fictional bank layouts with synthetic edits and masks (`DATA_SOURCES.md` 2.2 to 2.4); 2,000 validation images on 2 further layouts |
| Training | Dice plus binary cross-entropy, AdamW (learning rate 4e-4), mixed precision, 512 by 512 crops, batch 24, 24 epochs; 3 h 13 min on one NVIDIA RTX A5000; best validation pixel F1 0.966 at epoch 20 |
| Inference | ONNX Runtime on CPU in the API (23 MB model, opset 17; ONNX matches PyTorch to 0.00033 in probability); page resized to a long side of 1,700 px. A region is reported where the probability exceeds 0.98 over at least 300 px, an operating point chosen on validation data |
| Metrics | Test split, 3,000 images on 2 unseen layouts: image-level ROC AUC 0.944; pixel F1 0.737; trained edit types found on 100% of edited images with mean pixel F1 0.96 to 0.97; the unseen splice edit flagged on 62.8% with mean pixel F1 0.15. At the operating point, see `EVALUATION.md` |
| Intended use | Prompt an AICTE officer to look closely at a region before accepting a document |
| Not intended for | Deciding that a document is forged; any automated rejection; evidence in proceedings |
| Known limits | Trained only on synthetic data; real scans, phone photos, and edit methods outside the training set may behave differently. It localises a field spliced from another receipt poorly. Some unedited pages still get a mark, often on a single printed character; marks outside the value fields are graded low |
| Human oversight | Output appears as a signal with the heatmap; an officer must confirm or dismiss with a reason |

## 2. Field extractor

| Item | Detail |
|---|---|
| Task | Assign OCR tokens to FDR fields (number, amount, dates, holders, bank, IFSC, lien) |
| Method | OCR by PP-OCR models (RapidOCR, ONNX); LightGBM token classifier on text, position and neighbourhood features; validation rules (IFSC pattern, date order, amount in words matches figures) |
| Training data | 1,600 synthetic FDRs (41,744 OCR tokens) from the training layouts |
| Metrics | Exact match on 300 receipts from 2 unseen layouts: number 100%, IFSC 100%, amount 99.0%, issue date 95.0%, maturity date 99.0%; mean 98.6% against 98.3% for the rule baseline |
| Intended use | Pre-fill and cross-check; every extracted value is stored as "extracted" with confidence and never overwrites declared or confirmed values |
| Known limits | Unseen layouts, handwritten corrections, very low-resolution scans |

## 3. OCR

Pretrained PP-OCR detection and recognition models via RapidOCR. Not retrained. Licence and version recorded in `THIRD_PARTY.md`.

## 4. Portfolio anomaly model (priority P2, not built)

Planned but not built in this prototype. The rules engine and the document, declaration and bank checks cover the same review prompts deterministically. The plan, kept for later:

| Item | Detail |
|---|---|
| Method | Isolation Forest (scikit-learn) |
| Features | Amount against Table 1.4 expectation, tenure against term rule, intimation-to-furnishing lag, branch concentration across institutions, renewal gaps |
| Training data | Synthetic portfolio with injected anomalies |
| Metric | Recall of injected anomalies at a fixed review budget |
| Intended use | Review prompt with top contributing features shown |

## 5. Plain-language search

| Item | Detail |
|---|---|
| Model | Anthropic Claude Haiku 4.5 on Amazon Bedrock, India-resident inference profile `in.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Input | The officer's query text and the filter JSON schema; no records, documents or personal data |
| Output | A filter object validated against the schema; shown to the officer as editable chips before use |
| Metric | Exact filter match: the deterministic parser scores 100% on 60 queries and 15 of 15 held out; the Bedrock model is not measured because inference is blocked for the project account (DECISION D29) |
| Fallback | Deterministic parser for common phrasings |

## 6. Ethical considerations

- Signals affect how institutions are treated, so wording is neutral and every signal can be dismissed with a reason that is audited.
- No model outputs are used to change state, impose penalties or deny release.
- Synthetic data avoids real institutions and banks; results do not claim real-world accuracy.
