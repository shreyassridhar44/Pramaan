# Research

Research date: 24 October 2026. Every finding below has a source. Where a claim could not be checked, it is marked **Unverified**. Raw notes and the search log are in `claude-code/RESEARCH_LOG.md`.

## 1. Scope and method

1. Captured the official problem statement from https://sih.gov.in/sih2026PS (see `PROBLEM_STATEMENT.md`).
2. Read the AICTE Approval Process Handbook 2024-2027 (231 pages) for the rules on security deposits and FDRs.
3. Searched for evidence of real-world problems with FDR handling in public bodies.
4. Reviewed the verification channels that exist in India for bank deposits and guarantees.
5. Reviewed OCR, document-forensics and anomaly-detection options, with licences.
6. Ran a GitHub investigation of every repository we could find for this problem statement: search by ID, title, phrases and synonyms, then cloned all 18 confirmed repositories and inspected their code, commit history, tests and deployments.

## 2. Domain findings

### 2.1 How AICTE security deposits work

The binding rules are in the APH 2024-2027. They are summarised, with clause numbers, in `PROBLEM_STATEMENT.md` Section 6. The points that drive the product:

- The amount is formula-driven (Table 1.4, summed across programmes and levels, doubled for leased premises). A calculator removes arithmetic disputes at the demand stage.
- The term is 10 years (8 years appears for some older deposits in Affidavit 6). Thousands of instruments mature on different dates, so tracking maturity by hand is error-prone.
- Release needs three clearances (PGRC, Vigilance, grant-releasing bureaus), then an NOC or a sanction order. This is a multi-party workflow with clear blocking conditions.
- Bank verification today is a bank manager's letterhead certificate (Certificate 3). It is a paper attestation, not a machine-verifiable confirmation.

### 2.2 Evidence that the problem is real

| Finding | Source | Status |
|---|---|---|
| AICTE asked institutions established in 2010-11 that had not applied for release of their FDRs to apply by 07.02.2019, and asked institutions to refund FDR interest to AICTE, warning that EoA for 2019-20 would be withheld otherwise. This shows matured FDRs going unclaimed and follow-up done by public notice. | AICTE notice "Message for portal" (aicte.gov.in, PDF), as reported by search results on 24 Oct 2026 | **Partly verified**: the PDF now returns HTTP 404, so we could not read it directly. |
| The CBI registered a case over 109 fixed deposits worth over Rs 207 crore held by the Delhi Urban Shelter Improvement Board, alleging they were fake securities printed on plain A4 paper. | [Tribune India](https://www.tribuneindia.com/news/delhi/cbi-unearths-rs-207-crore-scam-in-delhi-urban-shelter-improvement-board-241296) | Verified (news report) |
| The CBI booked officials over Rs 223 crore of allegedly fake FDRs issued in the name of a Delhi forest department fund. | [Deccan Herald](https://www.deccanherald.com/india/cbi-books-delhi-governments-forest-department-officials-in-rs-223-crore-fd-scam-1153084.html) | Verified (news report) |
| A Rs 116 crore fake FDR case at Chandigarh Smart City came to light when the receipts were not found in the bank's records at encashment. | [Herald Goa](https://www.heraldgoa.in/?p=470342) | Verified (news report) |
| Fake FDRs were recovered in a railway tender investigation in Lucknow (September 2025). | [Amar Ujala](https://www.amarujala.com/lucknow/cbi-recovered-more-than-10-fake-fdrs-case-will-be-filed-for-submitting-fake-guarantee-2025-09-12) | Verified (news report, Hindi) |

What this means for the product: a receipt image alone is weak evidence. The value that matters is independent confirmation from the issuing bank, plus checks that catch altered or duplicated receipts before they are accepted. This is exactly requirement R4 and constraint C1.

### 2.3 Verification channels that exist in India

| Channel | What it covers | Fit for FDR verification | Source |
|---|---|---|---|
| Account Aggregator (RBI NBFC-AA framework, ReBIT specifications) | Consent-based sharing of financial data from banks (FIPs) to regulated users (FIUs). Term deposits are a defined FI type (Deposit, RD and TD schema v2.0.0). | Strong conceptual fit: the institution consents and the bank shares the deposit record directly. Coverage caveat: Sahamati notes that live FIPs mostly allow savings accounts of single holders, so live coverage for joint FDRs is **unverified**. AICTE would also need to onboard as an FIU. | [Sahamati consent workflow](https://developer.sahamati.org.in/sahamatinet-mvp/integration-steps/rebit-workflows-using-router/consent-workflow), [Sahamati FI types](https://sahamati.org.in/data-fi-types-available-on-aa/), [ReBIT NBFC-AA API spec](https://onemoney.in/docs/resources/ReBIT%20NBFC%20AA%20API%20Specification%20Core%20Final%2008Nov2019.pdf) |
| NeSL e-BG (National E-Governance Services Ltd) | Electronic bank guarantees. The beneficiary sees the digital guarantee on the NeSL portal at issuance. Used by NSE Clearing and state departments. | Covers bank guarantees, not FDRs. A useful model for "issued digitally, visible to the beneficiary from day one". | [NSE Clearing circular](https://nsearchives.nseindia.com/content/circulars/CMPT55708.pdf), [Punjab PSeGS order](https://dgrpg.punjab.gov.in/wp-content/uploads/2023/08/Office-Order-eBG.pdf) |
| SFMS messages (IFN 760 COV, IFN 767 COV) | Bank-to-bank structured messages for issuing and amending guarantees. | Shows that banks already exchange structured instrument messages. Not directly available to AICTE. | [NSE Clearing circulars](https://nsearchives.nseindia.com/content/circulars/CMPT55709.pdf) |
| Bank manager certificate (APH Certificate 3) | Manual letterhead attestation of FDR authenticity, ownership and freedom from loans. | The current practice. Slow, unstructured, and forgeable in the same way as the receipt. | APH 2024-2027, Certificate 3 |

**Conclusion.** There is no single public API that lets AICTE confirm an arbitrary joint FDR with any bank today. The product therefore defines a bank-confirmation adapter with one interface and three implementations: (a) a simulated bank network for the prototype, (b) an Account Aggregator adapter design, (c) a structured bank-officer confirmation desk that replaces Certificate 3 with a signed digital response. Only (a) and (c) run in the prototype, and both are labelled as simulated where they stand in for a real bank system.

## 3. Technical research

### 3.1 OCR

| Engine | Notes | Source |
|---|---|---|
| PaddleOCR (PP-OCR family) | Highest accuracy in the third-party receipt and invoice comparisons we found. Heavy framework dependency. ONNX exports exist (RapidOCR packages them). | [imagetotable.ai benchmark](https://imagetotable.ai/references/tesseract-vs-paddleocr-receipt-benchmark), [Codesota](https://codesota.com/ocr/paddleocr-vs-tesseract) |
| docTR | Close to PaddleOCR on the same receipt benchmark (CER 0.197 against 0.205), PyTorch based. | Same benchmark |
| Tesseract | Fastest and lightest, lowest accuracy of the three (CER 0.335 on receipts). | Same benchmark |

These benchmarks are on receipts and invoices, not FDRs, and their authors warn against extrapolating. We will measure OCR field accuracy on our own synthetic FDR set (see `EVALUATION.md`). Licences are verified at implementation time and recorded in `THIRD_PARTY.md`.

### 3.2 Document forensics

| Finding | Source |
|---|---|
| TruFor fuses RGB with a learned noise fingerprint and outputs a localisation map plus a reliability map. | [TruFor, CVPR 2023](https://arxiv.org/abs/2212.10957) |
| CAT-Net fuses an RGB stream with a DCT (JPEG) stream. | Cited in the ICCVW 2025 paper below |
| Scanned-document forensics is its own problem: a 2025 workshop paper detects inserted characters through noise and chromatic cues. | [Gardella et al., ICCVW 2025](https://openaccess.thecvf.com/content/ICCV2025W/VisionDocs/papers/Gardella_Scanned_documents_forensics_detecting_inserted_characters_through_noise_and_chromatic_ICCVW_2025_paper.pdf) |
| DocForge-Bench (March 2026) evaluated 14 methods on eight document datasets and found that none works reliably out of the box across document types. | [arXiv 2603.01433](https://arxiv.org/html/2603.01433v1) |

**Implication.** A general-purpose pretrained forgery model is not enough for FDR scans. We train a localisation model on our own synthetic FDR corpus, in which we control the tampering (digit swaps in amount, dates and FDR number; spliced fields; font mismatches) and the print-scan degradation. We combine it with classical, explainable signals: error level analysis, noise-residual consistency, and font-metric consistency of OCR'd digits. We report results only on held-out synthetic data and say so (see `MODEL_CARD.md`). Published pretrained weights with non-commercial licences are not shipped.

### 3.3 Anomaly detection on the deposit portfolio

Isolation Forest (scikit-learn, BSD-3) suits unlabelled tabular data and gives a per-record score we can explain with feature contributions. Inputs include amount against the Table 1.4 expectation, tenure against the 10-year rule, issue-to-intimation lag, branch concentration across institutions, and renewal history. Because there is no real labelled data, the model is trained and evaluated on synthetic data only, and the UI presents its output as a review signal, not a finding.

### 3.4 Plain-language search

Amazon Bedrock offers Anthropic models in ap-south-1. We verified on 24 October 2026 that the account can list India-resident inference profiles (`in.anthropic.claude-haiku-4-5-20251001-v1:0`, `in.anthropic.claude-sonnet-5`), so query text can stay in India. The model only returns a structured filter that matches a fixed JSON schema. It never queries the database directly.

## 4. Datasets

No public dataset of FDR images or AICTE deposit records exists. We checked the problem statement (no dataset link), the AICTE site and general searches. The product therefore uses:

1. A synthetic portfolio generator: institutions, regions, programmes, demands from Table 1.4, instruments, renewals, releases, complaints and events across 10 years.
2. A synthetic FDR document generator: fictional bank brands with distinct layouts, realistic fonts and print-scan degradation, every image watermarked "SYNTHETIC SPECIMEN".
3. A synthetic tampering generator that produces image and mask pairs for training and evaluation.

Real bank names are not used on document images, to avoid producing look-alike receipts of real banks. Details are in `DATA_SOURCES.md`.

## 5. Competitor analysis

### 5.1 How we searched

GitHub repository search on 24 October 2026 with: `SIH26265`, `26265`, `FDR` (created after 15 October), `FDR portal`, `security deposit`, `fixed deposit receipt`, `deposit AICTE`, `FDR AICTE in:readme`, `FDR vault`, `fdr management`, and product names found along the way. We downloaded the README of every repository created after 1 September 2026 that matched, kept the ones that are clearly about AICTE security deposits or FDRs, and cloned all 18. Only 4 of the 18 mention the problem statement ID in the repository name, so searching by ID alone misses most teams.

Metrics below come from `git log` on the clones and the GitHub search API. "LOC" counts lines in source files, excluding dependencies and build folders. "Tests" counts test functions found in the code; we did not run competitor code.

### 5.2 Summary table

| Repository | Commits / authors | Active window (2026) | Stack (from code) | LOC | Tests found | Deployment checked 24 Oct |
|---|---|---|---|---|---|---|
| Abhay18570/NidhiSetu | 1 / 1 | 23 Oct | React + Vite, browser storage only, no backend | 46,718 | 226 JS | Live landing page |
| Retesh-Pandey/AICTE-FDR-VALUT | 5 / 1 | 23 Oct | FastAPI, SQLAlchemy, Supabase, Tesseract OCR, React | 26,128 | 149 Py | Live sign-in page |
| Mrityun-G/FDR-Vault- | 14 / 2 | 22 to 24 Oct | PWA + Supabase, separate officer and admin sites | 15,800 | 0 | Institution app stuck on "Connecting securely"; officer sign-in live |
| Arya101005/fdr_sentinel | 7 / 1 | 24 Oct | FastAPI, SQLAlchemy, PyMuPDF, Tesseract, APScheduler, React | 15,170 | 86 Py, 20 JS | Not deployed |
| ruck-syu/aicte-fdr-portal | 26 / 2 | 23 to 24 Oct | Next.js + Supabase with row-level security and SQL functions | 12,111 | 0 | Not deployed |
| Ramanv07/Project-FDR | 2 / 1 | 24 Oct | Express, Postgres, separate mock-bank service with HMAC signatures | 9,124 | 7 JS | Live landing page |
| ayus0109/AICTE-FDR-portal | 15 / 1 | 21 to 22 Oct | FastAPI + React, AWS Lambda and EventBridge design | 9,145 | 11 Py | Live sign-in page |
| shreyank26pal-dev/fdr-portal | 3 / 1 | 24 Oct | FastAPI + Postgres backend only, Tesseract, ReportLab | 7,359 | 11 Py | Not deployed (frontend not yet built) |
| Saksham-189/sih206 | 4 / 2 | 23 to 24 Oct | Django | 5,748 | 159 Py | Not deployed |
| Juzt-nik/Project-BluePrint | 12 / 1 | 22 to 23 Oct | FastAPI backend | 2,395 | 35 Py | Not deployed |
| aisheechowdhury19801977-create/SecureFDR | 99 / 1 | 20 to 23 Oct | Express + Postgres | 2,226 | 0 | Live sign-in page |
| Ahaitsham/fdr- | 5 / 1 | 24 Oct | Express + Mongo + React | 2,073 | 8 JS | 404 (deployment not found) |
| Ahaitsham/FDR-Management-Portal | 11 / 2 | 22 to 23 Oct | Express + Mongo | 1,976 | 0 | Not deployed |
| AmruthavarshiniV/DRISHTI | 1 / 1 | 23 Oct | FastAPI, plain HTML | 1,223 | 13 Py | Not deployed |
| ankit-kuntal/AICTE-FDR-Management-Portal | 5 / 1 | 20 to 22 Oct | React stub + small Python | 576 | 0 | Not deployed |
| AryanRao10/vaultguard-sih26265 | 11 / 1 | 20 to 21 Oct | Next.js stub | 499 | 0 | Not deployed |
| shahavejkhadke/VaultIQ | 2 / 1 | 24 Oct | Vite; built bundle committed | n/a | 0 | Local only |
| joelbinoy2021-sketch/fdrflow-sih | 0 | 24 Oct | Empty repository | 0 | 0 | n/a |

All 18 had zero stars except FDR-Vault- (1), and zero forks except sih206 (3) and FDR-Management-Portal (1).

### 5.3 Notes on the strongest competitors (verified in code unless stated)

- **shreyank26pal-dev/fdr-portal.** The most complete domain model of the backend-only entries: bank-official role, scrutiny officer, approver, regional officers by region, auditor; synthetic tampered and duplicate FDR samples; a "time travel" demo flag; duplicate detection in `services/rules.py`; a hash-chained audit log with an admin endpoint that deliberately tampers an entry to show detection. The "tamper" feature is audit-log tampering, not document forensics. No frontend yet.
- **ruck-syu/aicte-fdr-portal.** Strong rules in Postgres: deposit demands with an APH rate card, discrepancy checks (maturity before issue, shortfall, duplicate numbers, malformed IFSC), renewal chains, release clearances by cell (Grievance, Vigilance, PGRC), bank-check states (`not_requested`, `requested`, `confirmed`, `mismatch`). Four roles in the enum. No tests, not deployed.
- **Retesh-Pandey/AICTE-FDR-VALUT.** The largest full-stack codebase with real OCR (Tesseract, PyMuPDF) and 149 Python tests. Dark, terminal-style UI with monospace type; the sign-in page is dense.
- **Arya101005/fdr_sentinel.** Five modules, including "matured but no release application" tracking, PDF text extraction with OCR fallback and field comparison. Clean React and FastAPI structure, not deployed.
- **Abhay18570/NidhiSetu.** Large React codebase with Hindi translations and a government-style landing page. Everything runs in the browser with mock data and local storage. The hero shows "99.8% Automated Verification Accuracy"; that figure is a hard-coded translation string (`hero.statAccuracy`), not the output of any evaluation in the repository.
- **Ramanv07/Project-FDR.** A separate mock-bank service that signs confirmations with HMAC-SHA256, labelled as simulated. Closest to our bank-confirmation idea, but HMAC is a shared-secret scheme, so it cannot give non-repudiation; ours uses asymmetric signatures.
- **Mrityun-G/FDR-Vault-.** Three surfaces (installable institution app, officer portal, admin console) on Supabase with Google sign-in. The institution app did not finish loading during our check. Purple-gradient sign-in page.
- **AmruthavarshiniV/DRISHTI.** Small codebase with a clear idea: an "evidence ladder" (claimed, checked, bank-confirmed, bank-native) and OTP links to bank registry addresses.

### 5.4 Patterns across competitors

What most of them do (so it will not differentiate us): role-based access with 4 to 9 roles, maturity reminders at fixed offsets, renewal chains, release requests, a hash-chained audit log, Tesseract OCR with field comparison, synthetic seed data, a sign-in page as the first screen.

What none of them does, verified across all 18 codebases:

1. **Trained document-forensics models.** No repository trains or runs a model that localises edits on an FDR image. OCR plus rule checks is the ceiling.
2. **Field-level provenance.** Several track instrument-level status. None shows, for each field, whether the value was declared, extracted from the document, or confirmed by the bank, with the conflicts side by side.
3. **Asymmetric signatures on bank confirmations.** The one mock bank uses HMAC.
4. **Forecasting.** No repository lets an officer move a date forward and see which instruments will mature, lapse or escalate, with the workload that follows.
5. **Spatial or portfolio views.** No maps, no bank-concentration analysis, no exposure view. We searched every `package.json` for map, 3D and motion libraries and found only one motion dependency.
6. **Plain-language search.**
7. **Verifiable outputs.** No NOC, release order or letter carries a QR code that a third party can verify.
8. **Honest evaluation.** No repository publishes measured accuracy for OCR or anomaly detection on a held-out set; one shows a hard-coded accuracy figure.

### 5.5 UI review of deployed competitors

We loaded every live URL in headless Chrome at 1440 by 900 on 24 October 2026. Screenshots are kept outside the repository because they are other teams' work.

| App | First screen | Observations |
|---|---|---|
| aicte-fdr-portal.vercel.app | Light sign-in card with one-click demo roles | Clean but generic. No product story before sign-in. |
| aicte-fdr-valut.vercel.app | Dark sign-in, monospace, amber button | Distinctive, but dense and hard to scan. Developer-tool look. |
| fdr-vault-sbf7.vercel.app/officer | Purple gradient hero, Google sign-in | Consumer-app styling that does not suit a regulator. |
| fdr-vault.vercel.app | Mobile frame, spinner | Did not load within 12 seconds. |
| nidhi-setu-beta.vercel.app | Government-style landing page with hero illustration and statistics | The most polished first impression; its statistics are hard-coded. |
| secure-fdr.vercel.app | Blue panel plus sign-in form | Template look. |
| web-sand-seven-63.vercel.app | Three role cards and a guidelines list | Plain, text-heavy. |
| fdr-sage.vercel.app | Vercel 404 | Broken deployment. |

**Opportunity.** Every competitor leads with a sign-in page or a marketing landing page, and the authenticated screens are standard admin tables. The first screen evaluators see in our product will be the work itself: a portfolio view that answers "how much money do we hold, how much of it is proven, and what needs action today", with a timeline that can move forward. See `PROJECT.md` and `claude-code/PROTOTYPE.md`.

### 5.6 Competition volume

| Date (2026) | Ideas submitted for SIH26265 | Source |
|---|---|---|
| 20 Oct | 5 | Zaidusyy/sih-2026-problem-statements, `data/submission-history.csv` |
| 21 Oct | 12 | same |
| 22 Oct | 13 | same |
| 23 Oct | 15 | same |
| 24 Oct | 16 | sih.gov.in portal counter |

Confirmed GitHub repositories for this problem statement grew from 12 on the morning of 24 October to 18 by the afternoon.

## 6. How Pramaan will outperform

| Dimension | Best competitor today | Pramaan |
|---|---|---|
| Evidence model | Instrument-level states (DRISHTI ladder, ruck-syu bank-check enum) | Field-level provenance on every value, with conflict view and an assurance level computed from evidence, never set by hand |
| Bank confirmation | HMAC mock bank (Project-FDR) | Simulated bank network with a bank officer desk, Ed25519-signed confirmation messages modelled on structured banking messages, signature verification shown in the UI, adapter interface for Account Aggregator |
| Document checks | Tesseract OCR plus rule comparison | OCR plus a trained edit-localisation model plus explainable classical signals, duplicate detection across the whole portfolio, all as review signals |
| Rules | APH rate card in SQL (ruck-syu) | Configurable rule engine for Table 1.4, penalties, release clearances and lien holds, with the APH clause shown next to every rule outcome |
| Monitoring | Fixed reminder offsets | Configurable reminder ladder, escalation by role, plus a forecast timeline that shows future maturities, lapses and workload |
| Release | Clearance flags | Clause 6.46 workflow with parallel clearances, automatic blockers (open complaints, lien holds, penalties due), NOC and sanction order generation |
| Outputs | PDF reports | Letters and NOCs with signed QR codes and a public verification page |
| Search | Filters | Filters plus plain-language search that shows its interpretation as editable filter chips |
| Evaluation | None, or hard-coded figures | Measured on held-out synthetic data, published with method and limits |
| First impression | Sign-in page or landing page | The portfolio command view, in a design system built for a regulator |
