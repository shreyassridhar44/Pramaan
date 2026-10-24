# Data sources

All data used by Pramaan in this repository is either public reference material or synthetic. No real institution, deposit, bank account or personal data is used.

## 1. Reference sources (public)

| Source | Used for | Access date | Licence or terms |
|---|---|---|---|
| SIH 2026 problem statement SIH26265, https://sih.gov.in/sih2026PS | Requirements | 24 Oct 2026 | Government website, quoted for reference |
| AICTE Approval Process Handbook 2024-2027 (PDF copy hosted at cdnbbsr.s3waas.gov.in, 231 pages) | Rule parameters: Table 1.4 amounts, term, penalties, release clearances, affidavit formats | 24 Oct 2026 | Government publication, used as reference; values are configurable |
| AICTE regional office list (aicte.gov.in, Wikipedia) | Seed data for regions | 24 Oct 2026 | Public information |
| Zaidusyy/sih-2026-problem-statements (GitHub) | Idea-count history for research only | 24 Oct 2026 | Repository licence; not shipped in the product |

## 2. Synthetic data

### 2.1 Portfolio (`ml/synth/portfolio.py`)
- About 1,200 institutions across 8 regional offices and 3 camp offices, with states and districts drawn from the real list of Indian states and union territories.
- Institution names are generated from neutral patterns (for example "Sahyadri Institute of Technology, Pune"); any resemblance to a real institution is accidental, and the generator avoids names from a blocklist of real institutions we know of.
- Programmes and levels drawn from the APH disciplines; demands computed with the Table 1.4 rule; leased premises at a set rate.
- About 3,000 instruments over 10 years: joint FDRs, a smaller share of RPGF and RTGS; maturities, renewals, releases, premature encashments at low rates.
- Simulated bank records generated alongside, with deliberate mismatches (amount, dates, holder, lien) at a controlled rate for testing discrepancy detection.
- Complaints, clearances, events and reminder history consistent with the rules.
- Deterministic by seed; version recorded in the database.

### 2.2 FDR documents (`ml/synth/fdr_render.py`)
- 12 fictional bank brands (for example "Bharat National Bank", "Deccan Cooperative Bank") with distinct layouts, colours, fonts and simple vector logos. **No real bank names, logos or layouts are used on images.**
- Fields: bank and branch, IFSC-like code, FDR number, holder names (joint with "Member Secretary, AICTE"), amount in figures and words, rate, issue and maturity dates, lien clause, signatures as generated strokes.
- Every image carries a "SYNTHETIC SPECIMEN" watermark.
- Print-scan degradation: perspective, blur, sensor noise, JPEG compression, shadows, stamps, folds.

### 2.3 Tampering (`ml/synth/tamper.py`)
- Edit types: digit copy-move within the document, digit insert with a mismatched font, field splice from another document, date edit, erase-and-retype.
- Outputs: tampered image, binary mask of edited pixels, edit metadata. Untampered controls are kept in equal proportion.

### 2.4 Splits
- By bank layout: 8 layouts for training, 2 for validation, 2 for test.
- One tamper type is held out entirely for the test set to measure generalisation to unseen edits.

## 3. What is not used

- No scraped bank websites or real FDR images.
- No pretrained weights whose licence restricts use to non-commercial research are shipped in the product.
- No real complaint or grievance records.

## 4. Data versioning

Generator versions and seeds are stored with every dataset (`dataset.json`) and with every model export (`model_card.json`). Evaluation results reference both.
