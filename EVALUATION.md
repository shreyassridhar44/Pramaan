# Evaluation

Status: results in Section 3 (26 October 2026). Every figure in Section 3 is copied from a result file written by a script (`ml/eval/`, `ml/train/field_extractor.py`, `services/api/scripts/`); each subsection names its script and file. No figure is estimated by hand.

## 1. What we evaluate

| Area | Question | Metric | Dataset |
|---|---|---|---|
| OCR and field extraction | Are FDR fields read correctly? | Per-field exact match; character error rate; on seen and unseen layouts | Synthetic FDR test split (2 unseen layouts) |
| Edit localisation | Does the model point at the edited region? | Pixel F1, IoU; image-level ROC AUC; false-positive rate on untampered scans | Synthetic tampered test split, including one unseen edit type |
| Duplicate detection | Are re-used receipts caught? | Recall and precision on injected duplicates | Synthetic portfolio |
| Discrepancy detection (end to end) | Does a conflict between document, declaration and bank surface as a signal? | Recall at the instrument level for injected mismatches | Synthetic portfolio with controlled mismatch rate |
| Portfolio anomaly (P2, not built) | Are injected anomalies ranked high? | Recall at top-k review budget | Synthetic portfolio |
| Plain-language search | Is the query turned into the right filter? | Schema-valid rate; exact filter match | 60 hand-written queries with expected filters |
| Rules | Do rule outcomes match the APH? | Pass rate of rule test cases | Unit tests with APH-derived cases |

## 2. Product-level measures (R15)

The problem statement asks the prototype to show improvements in record accuracy, verification turnaround, renewal monitoring, manual effort and pending-case visibility. Pramaan computes these from its own data and shows them on the impact panel, labelled as synthetic:

| R15 measure | How Pramaan computes it |
|---|---|
| Record accuracy | Share of material fields where declared, extracted and confirmed values agree; share of instruments at A2 or above |
| Verification turnaround | Time from submission to `verified`, median and 90th percentile, from events |
| Timely renewal monitoring | Share of instruments that received every scheduled reminder on time before maturity; count of maturities without an assigned owner |
| Manual tracking effort | Count of steps automated per instrument lifecycle (reminders, escalations, letters, checks) compared with the manual steps in the APH process, listed explicitly |
| Visibility into pending cases | Share of open items with a state, owner, age and next action |

These are demonstrations of the measurement, not claims about AICTE's current performance, because the baseline data is synthetic.

## 3. Results

System performance targets are measured and recorded in `TESTING.md` Section 5 (raw figures in `docs/perf-results.json`). Every figure below is on synthetic documents; none is a claim about real receipts.

### Edit localiser (26 October 2026)

Produced by `ml/eval/localiser_eval.py` on the test split, once, with the exported model; raw output in `ml/eval/results/localiser.json`; training run in `ml/TRAINING_REPORT.md`. The test split uses two bank layouts the model never saw and includes `splice_field`, an edit type held out of training. 3,000 images, 1,524 edited.

| Measure | Value |
|---|---|
| Image-level ROC AUC | 0.944 |
| Pixel F1 (micro, all test pixels) | 0.737 |
| Edited images flagged (score above 0.5) | 90.8% |
| Unedited images flagged (score above 0.5) | 19.0% |
| Best validation pixel F1 during training (epoch 20 of 24) | 0.966 |
| ONNX against PyTorch, largest probability difference | 0.00033 |

| Edit type | Images | Mean pixel F1 | Flagged |
|---|---|---|---|
| Copy-move digit | 338 | 0.967 | 100% |
| Erase and retype a field | 408 | 0.960 | 100% |
| Insert a digit in another font | 402 | 0.960 | 100% |
| Splice a field from another receipt (unseen in training) | 376 | 0.152 | 62.8% |

The edit types it was trained on are found and outlined almost perfectly on unseen layouts. The unseen splice type is the weak spot: most are flagged, but the marked region overlaps the true one poorly. At the raw 0.5 threshold about one unedited page in five also gets a mark, which is why the API applies the stricter rule chosen on validation data below.

### Localiser operating point (26 October 2026)

Produced by `ml/eval/calibrate.py`. At the raw 0.5 threshold too many unedited pages got a mark, and in the API a mark is a review prompt for an officer, so false marks cost officer time. The rule was chosen on 400 validation images (validation layouts, no splice edits; `ml/eval/results/localiser_calibration.json`) and then checked once on the first 600 images of the test split, regenerated from the same seeds as the full test run (`ml/eval/results/localiser_operating_point_test.json`). On the raw rule that slice gives figures close to the full test split (22.1% of unedited pages marked against 19.0%; splice edits 65.1% against 62.8%), so it is a fair sample.

| Rule (a region is kept when) | Unedited pages marked, validation | Edited pages with a mark on the edit, validation | Unedited pages marked, test slice | Edited pages with a mark on the edit, test slice |
|---|---|---|---|---|
| Probability above 0.5, at least 60 px (raw) | 29.9% | 100% | 22.1% | 90.1% |
| Probability above 0.98, at least 300 px (chosen) | 3.9% | 99.5% | 5.4% | 83.8% |

On the test slice with the chosen rule, by edit type: copy-move digit 98.2%, erase and retype 100%, inserted digit 100%, and the unseen splice 44.2% (from 65.1% on the raw rule). The chosen rule trades away part of the already weak splice detection for four times fewer false marks. A splice that changes a value is still caught by the other checks: document against declaration, figures against words, and the bank's signed confirmation. Regions that touch no value field are reported with low severity.

The demo receipts behave the same way: the altered receipt gets one mark, on the changed digit of the amount; the genuine receipt gets one low-severity mark on a printed label character, outside the value fields, which the officer can dismiss with a reason.

### Field extractor (26 October 2026)

Produced by `ml/train/field_extractor.py` on 300 test receipts from the two unseen layouts; raw output in `ml/eval/results/field_extractor.json`. Trained on 1,600 receipts (41,744 OCR tokens). Exact match per field, after normalisation:

| Field | Trained model | Rule baseline |
|---|---|---|
| Instrument number | 100% | 100% |
| IFSC | 100% | 100% |
| Amount | 99.0% | 99.0% |
| Issue date | 95.0% | 93.7% |
| Maturity date | 99.0% | 98.7% |
| Mean | 98.6% | 98.3% |

The trained model is slightly ahead of the rules, mostly on dates. Both sit on the same OCR, which limits both: most remaining misses are OCR slips in dates. The API uses the trained model and records which extractor produced each value.

### Plain-language search (25 October 2026)

Produced by `services/api/scripts/search_eval.py`; raw output in `docs/search-eval.json`. A query counts only if every filter matches exactly.

| Interpreter | Set | Queries | Exact match |
|---|---|---|---|
| Rule parser | Main set (the parser was tuned on three misses it exposed) | 60 | 100% |
| Rule parser | Held-out set, written after tuning and scored once | 15 | 100% |
| Claude Haiku 4.5 on Bedrock | Not measured: inference is blocked for the project's AWS account (DECISION D29) | | |

Every interpretation is shown to the officer as removable chips before it is applied, so a wrong reading costs a click, not a wrong result.

## 4. Threats to validity

- Synthetic documents may be easier or harder than real scans.
- The tamper generator encodes our assumptions about how receipts are altered.
- The query test set is written by the team and may not reflect officers' phrasing.
- Product measures depend on the synthetic event timings we generate.
