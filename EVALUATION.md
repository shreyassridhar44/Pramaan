# Evaluation

Status: plan. Results tables are filled only by the evaluation scripts in `ml/eval/` and `services/api/tests/eval/`. Each result row links to the script, dataset version and model version that produced it. No figure is entered by hand.

## 1. What we evaluate

| Area | Question | Metric | Dataset |
|---|---|---|---|
| OCR and field extraction | Are FDR fields read correctly? | Per-field exact match; character error rate; on seen and unseen layouts | Synthetic FDR test split (2 unseen layouts) |
| Edit localisation | Does the model point at the edited region? | Pixel F1, IoU; image-level ROC AUC; false-positive rate on untampered scans | Synthetic tampered test split, including one unseen edit type |
| Duplicate detection | Are re-used receipts caught? | Recall and precision on injected duplicates | Synthetic portfolio |
| Discrepancy detection (end to end) | Does a conflict between document, declaration and bank surface as a signal? | Recall at the instrument level for injected mismatches | Synthetic portfolio with controlled mismatch rate |
| Portfolio anomaly (P2) | Are injected anomalies ranked high? | Recall at top-k review budget | Synthetic portfolio |
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

System performance targets are measured and recorded in `TESTING.md` Section 5 (raw figures in `docs/perf-results.json`). Model metrics (localiser, field extractor) and product measures are added after the GPU training run and the Step 10 evaluation scripts.

## 4. Threats to validity

- Synthetic documents may be easier or harder than real scans.
- The tamper generator encodes our assumptions about how receipts are altered.
- The query test set is written by the team and may not reflect officers' phrasing.
- Product measures depend on the synthetic event timings we generate.
