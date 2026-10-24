# Pramaan: Project Specification

Status: draft for approval, 24 October 2026. Nothing in this document is implemented yet. `HANDOFF.md` tracks what is built.

Pramaan (प्रमाण, "proof" or "evidence") is a security deposit and FDR management system for the AICTE Regulation Bureau. It keeps a single record of every deposit AICTE holds against an institution, proves each value against its source, watches every deadline, and runs release cases to the competent authority with a complete audit trail.

Requirement IDs (R1 to R16) and constraint IDs (C1 to C7) refer to `PROBLEM_STATEMENT.md`.

## 1. Vision and objectives

**Vision.** Every rupee AICTE holds in trust is accounted for, proven by its source, and never forgotten at maturity.

**Objectives**

| ID | Objective | Measured by | Serves |
|---|---|---|---|
| O1 | One authoritative record per institution and per instrument | Every instrument has exactly one current record, a lifecycle history and linked documents | R1, R2, R7 |
| O2 | Separate what is claimed from what is proven | Every field shows its source; assurance level computed from evidence | R3, R4, C1 |
| O3 | No missed deadline | Every instrument within 90 days of a deadline has an owner, a reminder history and a next action | R5, R6, R12 |
| O4 | Release only when the rules are met | Release cases cannot reach NOC while a blocking condition is open | R8, C4 |
| O5 | Visibility for management | Portfolio, queue and report views answer the R9 and R11 questions in one screen each | R9, R10, R11 |
| O6 | Trustworthy by design | RBAC, encryption, hash-chained audit, signed outputs | R13, C6 |
| O7 | Show measurable improvement | Impact panel with turnaround, accuracy and coverage metrics computed from data | R15 |

## 2. Users

| Persona | Organisation | Primary goals | Surface |
|---|---|---|---|
| Regulation Bureau officer (scrutiny) | AICTE HQ | Verify submissions, resolve discrepancies, request bank confirmation | Officer app |
| Bureau section head / approving authority | AICTE HQ | Monitor pendency, approve escalated items, sign release orders | Officer app |
| Regional officer | AICTE Regional Office | Watch their region's instruments and institutions | Officer app, region-scoped |
| Clearance cell officer | PGRC, Vigilance, grant-releasing bureaus | Clear or block release cases with reasons | Clearance queue |
| Institution user | Trust, Society or Company accounts officer | Furnish deposits, upload documents, renew, request release, track status | Institution portal |
| Bank officer (simulated) | Issuing bank branch | Answer confirmation requests with signed responses, record lien discharge | Bank desk (labelled simulated) |
| Auditor | Internal audit / CAG-style reviewer | Read everything, verify the audit chain, export evidence | Read-only officer app |
| Administrator | AICTE IT | Users, roles, rule configuration | Admin console |
| Public verifier | Anyone holding a Pramaan letter | Confirm a letter or NOC is genuine | Public verify page |

## 3. Key concepts

### 3.1 Instrument

A security deposit instrument: Joint FDR, RPGF (Refundable Performance Guaranty Fund) or RTGS deposit. Fields: instrument number, type, bank, branch, IFSC, amount, issue date, maturity date, tenure, holders (joint with AICTE), lien in favour of AICTE, auto-renewal flag, linked demand, linked predecessor (for renewals), documents, status.

### 3.2 Field-level provenance

Every material field (number, bank, IFSC, amount, issue date, maturity date, holder names, lien) stores up to three observations, each with its source and time:

| Source | Meaning | Set by |
|---|---|---|
| Declared | Typed by the institution | Institution portal |
| Extracted | Read from the uploaded document by OCR | Document intelligence pipeline |
| Confirmed | Returned by the issuing bank in a signed response | Bank confirmation adapter |

The UI shows the three observations side by side with a match or conflict state. The system never copies a declared value into the confirmed slot (C1).

### 3.3 Assurance level

Computed, never edited by hand:

| Level | Name | Rule |
|---|---|---|
| A0 | Declared | Instrument exists with declared values only |
| A1 | Document-checked | Extraction matches declarations on all material fields, and no open high-severity document signal |
| A2 | Bank-confirmed | A valid signed bank confirmation matches all material fields, including lien in favour of AICTE |
| A3 | Re-confirmed | A2, plus a re-confirmation within the configured window (default 365 days) |

Any open conflict on a material field caps the level at A0 and raises a discrepancy. The portfolio reports value by assurance level ("Rs 412 crore held, 68% bank-confirmed").

### 3.4 Lifecycle states

`demanded` → `submitted` → `under_scrutiny` → `verified` → `active` → (`maturing` within reminder window) → `matured` → (`renewal_pending` → `renewed`) or (`release_requested` → `release_cleared` → `released`). Side states: `returned` (deficiency), `discrepancy`, `lien_hold`, `forfeited`, `encashed_prematurely`. State transitions are server-side only, each with an actor, a reason and an audit entry.

### 3.5 Signals

Machine-raised items that need a human: field conflicts, document forensic flags, duplicate instruments, shortfall against demand, maturity before approval period ends, unusual portfolio patterns. Each signal has a severity, the evidence, the rule or model that raised it, and a resolution (confirmed, dismissed with reason, resolved). Signals never change state on their own (C5).

## 4. Features

Each feature lists its expected behaviour and the requirement it serves. "P" marks priority: P0 must ship for the demo, P1 should ship, P2 if time allows.

### F1. Portfolio command view (P0; R9, R11, R15)
- Headline figures: total value held, number of instruments, value by assurance level, items needing action today, instruments maturing in 90 days.
- Assurance composition bar by value, clickable into the registry.
- Maturity river: a stacked timeline of maturities for the next 24 months by assurance level.
- Region view: AICTE regional offices on an India map with value held, open signals and overdue items per region.
- Action queue: the next ten things to do, ranked by deadline and severity, each with an owner.
- Impact panel: verification turnaround (median and 90th percentile), field agreement rate, reminders sent on time, items without owner. Computed from data, labelled as synthetic.

### F2. Forecast timeline, the "time machine" (P0; R5, R6, R9)
- A global "as of" date control in the top bar. Default is today. Dragging forward re-computes every view for that date: statuses, reminders that would have fired, escalations, maturities, workload per officer.
- A full-screen forecast mode plays the next 12 months week by week: the river advances, map regions change colour, an event stream lists reminders, escalations and maturities as they occur.
- All computation happens on the server from the same rule engine used in normal operation, so the forecast is the real logic, not an animation.
- Read-only: in forecast mode nothing is written.

### F3. Instrument registry (P0; R1, R10, R11)
- Virtualised table of all instruments with column chooser, sorting, filters (region, bank, type, status, assurance, maturity range, institution, signals), saved views and CSV export.
- Plain-language search bar (F12) above the table.
- Bulk actions for authorised roles: request bank confirmation, send reminder, assign officer.

### F4. Instrument detail (P0; R1, R2, R3, R4, R7, R10, R13)
- Header: instrument number, institution, amount in Indian format, assurance ring, status, owner, next action and due date.
- Provenance grid: each material field with declared, extracted and confirmed values, match state and timestamps.
- Documents: viewer for the FDR scan and other files, with OCR boxes over the extracted fields and an optional forensic overlay (F7).
- Bank confirmation: message thread with request, response, signature check result and raw message.
- Timeline: lifecycle events, reminders, signals, observations, renewals (predecessor and successor chain).
- Observations: officers record scrutiny observations; permitted fields can be corrected with a reason (the original value stays in history).
- Audit tab: every action on this instrument from the hash-chained log.

### F5. Institution profile (P1; R1, R10)
- Programmes and levels, premises type (own or leased), approval history, demand calculation from Table 1.4 with each line explained, instruments, release cases, flags from other cells (complaints, disputes, embezzlement NOC pending).

### F6. Institution intake (P0; R2, R3, R16 "new FDR submission")
- Demand card: amount due, how it was calculated (Table 1.4 lines, leased doubling), deadline (15 days from intimation), penalty slab that would apply after 31 May and 31 July.
- Submission wizard: instrument details, scan upload (PDF or image), live extraction pre-check that shows mismatches before submission, Affidavit 3 upload, declaration, submit.
- After submission: status tracker, deficiency letters, resubmission.

### F7. Document intelligence (P0; R3, C5)
- OCR with field extraction and per-field confidence.
- Edit-localisation model: a heatmap of regions likely to have been altered, plus an image-level score.
- Classical signals: error level analysis, noise-residual inconsistency, digit font-metric inconsistency, metadata checks for PDFs.
- Duplicate detection: same instrument number and bank across institutions; perceptual-hash near-duplicates of the image.
- All outputs are signals with evidence and the model or rule version. Wording is "possible alteration in the amount field", never "forged".

### F8. Bank confirmation network (P0; R3, R4, R14, C2, C3)
- Officer requests confirmation for one or many instruments.
- Adapter interface `BankConfirmationAdapter` with `request()`, `poll()`, `verify()`. Prototype implementations:
  1. `SimulatedBankNetwork`: per-bank simulated core banking records seeded to match (or deliberately not match) instruments; configurable latency and outcomes.
  2. `BankDesk`: a bank officer surface where a human reviews the request against the (simulated) bank record and confirms or reports a mismatch.
- Every response is a structured message signed with the bank's Ed25519 key. Pramaan verifies the signature against the bank key registry and stores the raw message.
- Response fields: instrument number, holder names, amount, issue and maturity dates, lien in favour of AICTE (yes or no), encumbrances, status (live, matured, encashed, closed).
- Account Aggregator adapter: interface and data mapping documented (ReBIT TD FI type), not live.
- Every simulated surface carries a visible "Simulated bank" label (C3).

### F9. Monitoring, reminders and escalation (P0; R5, R6, R12, R16 "validity tracking", "approaching maturity")
- Daily rule run (and on demand) evaluates every instrument as of a date.
- Reminder ladder, configurable (default T-90, T-60, T-30, T-15, T-7, T-0, then weekly overdue).
- Escalation matrix: dealing officer, section head, deputy director, director, by days overdue.
- Rules beyond maturity: demand not furnished in 15 days, penalty windows (31 May, 31 July), matured with no release application, auto-renewal unconfirmed, re-confirmation due, lien hold review.
- Channels: in-app notifications, email (Mailpit locally, Amazon SES in deployment), SMS and WhatsApp as simulated outbox entries.

### F10. Renewal and replacement (P0; R7, R16 "renewal")
- Institution submits a renewed or replacement instrument linked to the predecessor.
- On verification of the successor, the predecessor becomes `renewed` and the chain is shown as one history.

### F11. Release, discharge and refund (P0; R8, C4, R16 "authorized release processing")
- Eligibility check when an institution applies: matured or term completed, no penalty due, no lien hold, no open complaint or disciplinary proceeding, required documents (application letter, Affidavit 6, FDR copy, latest LoA or EoA).
- Parallel clearances from PGRC, Vigilance and grant-releasing bureaus, each with clear or block plus reason.
- Final authorisation: NOC by the Approval Bureau (FDR, RPGF) or sanction order by the Council (RTGS), only by users with that authority.
- Bank discharge: lien release confirmed by the bank (simulated), then `released`.
- Penalties applied where rules require (10% premature encashment, 10% or 50% closure cases), shown with clause references.

### F12. Plain-language search (P1; R10)
- Officer types a request such as "SBI FDRs in the Western region maturing before March 2027 with no renewal".
- Amazon Bedrock (India-resident inference profile) converts it to a filter object that must validate against a fixed JSON schema. The UI shows the interpreted filter as editable chips before applying it.
- Fallback: a deterministic parser for common phrases when Bedrock is unavailable.
- The model never sees document images and never writes data.

### F13. Letters and verifiable documents (P1; R8, R12)
- Generated PDFs: demand intimation, deficiency letter, reminder, escalation note, NOC, sanction order, release confirmation.
- Bilingual header (Hindi and English), reference number, date, signatory role.
- Each PDF carries a QR code with a signed token. The public verify page shows the letter's key fields and whether it is genuine, superseded or revoked.

### F14. Reports (P1; R11)
- Pending verifications, upcoming maturities, missing documents, cases needing intervention, ageing by stage, region-wise and bank-wise exposure, release pipeline.
- CSV and PDF export.

### F15. Audit trail (P0; R13)
- Append-only, hash-chained log of every state change, view of sensitive data, export and sign-in.
- Chain verification with a visual check, and detection of a broken link if the database is edited outside the application.

### F16. Administration (P1; C7)
- Users and roles, region scoping.
- Rule configuration: Table 1.4 rate card, leased multiplier, reminder ladder, escalation matrix, penalty slabs, clearance cells, re-confirmation window. Every rule shows its APH clause and an effective-from date.

### F17. Portfolio anomaly signals (P2; R3)
- Isolation Forest score per instrument with the top contributing features, shown as a review signal.

### F18. Demo controls (P0; demo only, hidden in production builds)
- Persona switcher on the sign-in page.
- "Reset demo data" and "Load scenario" (for each R16 scenario) for administrators in demo mode.

## 5. Functional requirements

| ID | Requirement | Feature |
|---|---|---|
| FR1 | Create and maintain institution and instrument records with full history | F3, F4, F5 |
| FR2 | Upload, store, preview and download documents; files encrypted at rest | F4, F6 |
| FR3 | Extract fields from FDR scans with confidence; compare with declarations | F6, F7 |
| FR4 | Store declared, extracted and confirmed values separately per field | F4, F8 |
| FR5 | Request, receive and verify signed bank confirmations | F8 |
| FR6 | Compute assurance level from evidence | F4, F1 |
| FR7 | Evaluate deadline rules for any as-of date | F2, F9 |
| FR8 | Send reminders and escalations through configured channels | F9 |
| FR9 | Link renewals and replacements to predecessors | F10 |
| FR10 | Run release cases with eligibility checks, parallel clearances and final authorisation | F11 |
| FR11 | Generate letters with verifiable QR codes | F13 |
| FR12 | Search, filter, save views, export | F3, F12, F14 |
| FR13 | Record observations and permitted corrections with reasons | F4 |
| FR14 | Hash-chained audit with verification | F15 |
| FR15 | Role-based and region-based access on every endpoint | all |
| FR16 | Configurable rules with APH references | F16 |

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | Registry of 5,000 instruments loads in under 1.5 s; filters respond in under 300 ms (server p95); forecast step under 400 ms; document analysis under 15 s on the deployment instance |
| Availability | Single instance for the prototype with automatic container restart and health checks |
| Security | OWASP ASVS level 2 practices where applicable; see `SECURITY.md` |
| Privacy | Data minimisation, purpose limitation, region scoping; see `PRIVACY.md` |
| Accessibility | WCAG 2.2 AA: contrast, keyboard navigation, focus states, reduced-motion support, screen-reader labels |
| Responsiveness | Officer app from 1280 px upward is primary; usable from 768 px; institution portal and verify page fully usable at 360 px |
| Localisation | English UI; Hindi for letters, the institution portal headings and the verify page; Indian number and date formats |
| Observability | Structured JSON logs with request IDs, health and readiness endpoints, basic metrics |
| Maintainability | Typed code (TypeScript strict, Python type hints with mypy), tests for every rule, documented decisions |

## 7. User journeys

### J1. New deposit, end to end (R16: new FDR submission)
1. Approval granted; Pramaan creates a demand for the institution from Table 1.4 and sends the intimation letter.
2. Institution user opens the portal, sees the demand card and the 15-day deadline, starts the wizard.
3. They enter instrument details and upload the scan. Extraction runs; a mismatch in the maturity date is shown before submission; they correct a typo.
4. They upload Affidavit 3 and submit. State: `submitted`, assurance A0 then A1 after checks.
5. Scrutiny officer sees it in the queue, opens the provenance grid, requests bank confirmation.
6. The bank responds (simulated network or bank desk) with a signed message. All fields match, lien confirmed. Assurance A2. State `active`.

### J2. Tampered receipt (R16: discrepancy identification)
1. A submission arrives with an amount that was digitally changed from 15,00,000 to 35,00,000.
2. Extraction reads 35,00,000; the edit-localisation model highlights the amount field; ELA and digit font metrics agree.
3. A high-severity signal opens. The officer sees the heatmap and evidence, and requests bank confirmation.
4. The bank confirms 15,00,000. Conflict on amount. State `discrepancy`. A deficiency letter is generated for the institution.

### J3. Approaching maturity and renewal (R16: validity tracking, approaching maturity, renewal)
1. At T-90 the institution and the dealing officer get a reminder; at T-30 the section head sees it on the action queue.
2. Using the forecast timeline, the officer sees 37 instruments in the Western region maturing in the next quarter and assigns them.
3. The institution submits a renewed FDR linked to the old one; after confirmation the chain shows both.

### J4. Release with a blocking complaint (R16: authorized release processing)
1. A 10-year deposit matures. The institution applies for release with the required documents.
2. Eligibility check finds an open PGRC complaint. The case shows "Blocked: PGRC clearance pending, complaint ref ...".
3. PGRC resolves the complaint and clears. Vigilance and the grants bureau clear.
4. The approving authority issues the NOC; the PDF has a QR code. The bank confirms lien discharge. State `released`.
5. Anyone scanning the QR sees that the NOC is genuine.

### J5. Management review
1. Director opens the command view: value held, assurance mix, regions with overdue items, impact metrics.
2. Uses plain-language search and exports the report for a review meeting.

### J6. Audit
1. Auditor verifies the audit chain, filters actions on one instrument, exports evidence as PDF.

## 8. Information architecture and navigation

```
Public
  /signin                 sign-in with demo persona cards
  /verify/:token          public letter verification
Officer app (left rail)
  /                       Command view
  /queue                  Verification queue
  /instruments            Registry
  /instruments/:id        Instrument detail (tabs: Overview, Documents, Bank, Timeline, Audit)
  /institutions           Institutions
  /institutions/:id       Institution profile
  /releases               Release cases
  /releases/:id           Release case
  /alerts                 Reminders and escalations
  /forecast               Full-screen forecast timeline
  /reports                Reports
  /letters                Generated letters
  /audit                  Audit log and chain check
  /admin/rules            Rule configuration
  /admin/users            Users and roles
Clearance cells
  /clearances             Clearance queue (PGRC, Vigilance, Grants)
Bank desk (simulated)
  /bank                   Incoming confirmation and discharge requests
Institution portal
  /portal                 Home: demand, instruments, tasks, notifications
  /portal/submit          Submission wizard
  /portal/instruments/:id Instrument status
  /portal/release         Release application
  /portal/letters         Letters received
```

Global elements: command palette (Ctrl or Cmd + K) for navigation and record lookup, the as-of date control, notifications drawer, role badge, theme toggle (light and command-dark).

## 9. Screen specifications

Detailed screen-by-screen specifications, including layout grids, components, states and motion, are in `claude-code/PROTOTYPE.md`. That file is the single source of truth for UI.

## 10. Architecture and technology

Summary only; full detail and diagrams are in `ARCHITECTURE.md`, and the reasoning in `claude-code/DECISION.md`.

| Layer | Choice |
|---|---|
| Web | React 19, TypeScript, Vite, TanStack Router and Query, Tailwind CSS v4, Radix primitives with our own component layer, Motion, Apache ECharts, MapLibre GL, cmdk |
| API | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic |
| Data | PostgreSQL 16, Valkey 8 (Redis-compatible) |
| Jobs | arq workers for document analysis, rule runs, notifications, letter generation |
| ML inference | ONNX Runtime on CPU: OCR (PP-OCR models via RapidOCR), edit-localisation model, field extractor; scikit-learn Isolation Forest |
| ML training | PyTorch and segmentation-models-pytorch on the team's GPU machine; export to ONNX |
| Documents | Object storage: S3 in deployment, local filesystem in development behind the same interface; server-side encryption in S3 |
| PDFs and QR | ReportLab, segno; pypdfium2 for rendering PDFs to images |
| Signing | Ed25519 (cryptography library) for bank messages and letter tokens |
| LLM | Amazon Bedrock, India-resident inference profile, structured output only |
| Email | Mailpit locally, Amazon SES in deployment |
| Deployment | One ARM EC2 instance (t4g.medium) with Docker Compose for API, worker, database and cache; static web on S3; CloudFront in front of both |
| CI | GitHub Actions: lint, type-check, tests, build |

## 11. ML components

Full detail in `MODEL_CARD.md` and `EVALUATION.md`.

| Model | Purpose | Training data | Inference | Evaluation |
|---|---|---|---|---|
| OCR (detection and recognition) | Read FDR text | Pretrained PP-OCR models, not retrained | ONNX on CPU | Field-level exact match on held-out synthetic FDRs |
| Field extractor | Map OCR tokens to fields | Synthetic FDRs from 12 fictional bank layouts; split by layout | LightGBM token classifier plus validation rules | Per-field precision, recall, exact match; unseen-layout split |
| Edit-localisation | Heatmap of altered regions | Synthetic tampered FDRs with masks (digit swaps, splices, font changes) after print-scan degradation | U-Net (EfficientNet-B0 encoder) on RGB plus noise residual, ONNX | Pixel F1 and IoU, image-level AUC, on held-out layouts and tamper types |
| Portfolio anomaly | Unusual instrument patterns | Synthetic portfolio | Isolation Forest | Recall of injected anomalies at fixed review budget |
| Plain-language to filter | Query understanding | None (prompted model) | Bedrock | Schema-valid rate and exact filter match on a 60-query test set |

No metric is published without the script that produced it and the dataset version. All evaluation data is synthetic and is labelled so in every place the number appears.

## 12. Integrations and data flows

| Integration | Prototype | Production path |
|---|---|---|
| AICTE approval portal (institutions, programmes, LoA/EoA) | Synthetic import via a CSV and API importer | Authorised API or database extract |
| Banks | Simulated bank network and bank desk with signed messages | Account Aggregator (as FIU), bank APIs, or a bank desk used by real branch officers |
| PGRC and other cells | Clearance queue inside Pramaan; complaint flags seeded | Integration with the grievance system (see SIH26264) |
| Email | Mailpit, SES | SES or NIC mail relay |
| SMS and WhatsApp | Simulated outbox | Authorised gateway |
| Bedrock | Live (India-resident profile) | Same |

Primary data flow: institution submission → object storage → analysis job (OCR, extraction, forensics, duplicates) → signals and extracted values → officer scrutiny → bank confirmation request → signed response → verification → assurance update → monitoring rules → reminders, escalations, release.

## 13. Implementation scope

| Implemented for real | Simulated, clearly labelled | Not included |
|---|---|---|
| All workflows, rules, state machine, RBAC, audit, documents, OCR, extraction, forensics model, duplicate detection, reminders and escalations, release workflow, letters with QR, search, forecast, reports | Bank core-banking records and bank responses; SMS and WhatsApp delivery; AICTE portal data import (synthetic data); clearance-cell source systems | Real bank integration; real institution data; payments or fund movement; any automatic approval, release or penalty without an authorised human; production identity (NIC SSO) |

**Assumptions** (not presented as facts):
1. Joint FDRs name the Trust and AICTE as holders with a lien in favour of AICTE, as Affidavit 6 suggests.
2. The Regulation Bureau, not the Approval Bureau, owns day-to-day deposit monitoring; NOC authority sits with the Approval Bureau as in Clause 6.46 c. Both are configurable roles.
3. Reminder offsets and escalation levels are defaults chosen by us; AICTE would set the real values.
4. The 10-year term applies by default; 8-year deposits are supported as a configurable term.
5. Late-furnishing penalty slabs (31 May, 31 July) are taken as the next occurrence on or after the due date when a demand falls outside the April to June approval cycle.

## 14. Security, privacy, performance, reliability

See `SECURITY.md`, `PRIVACY.md` and `ARCHITECTURE.md`. Headlines: least-privilege roles with region scoping enforced in the API; httpOnly session cookies; CSRF protection; rate limiting on sign-in; documents encrypted at rest and served through short-lived signed URLs; secrets only in environment or AWS Systems Manager Parameter Store; audit of every sensitive read; nightly database backup to S3.

## 15. Testing and definition of done

See `TESTING.md` and `claude-code/TEST_PLAN.md`. The six R16 scenarios are automated end-to-end tests and are also the demo scenarios.

A feature is done when: it meets its acceptance criteria in `claude-code/STEPS.md`; unit and integration tests pass; it has loading, empty and error states; it passes keyboard and contrast checks; it is documented; and `claude-code/HANDOFF.md` is updated.

## 16. Demonstration plan

Detailed script, timings and shot list are in `claude-code/PROTOTYPE.md` Section 12. Outline (about 3 minutes):

1. Command view: value held and proven, the assurance mix, regions.
2. Plain-language search, then the forecast timeline playing six months ahead.
3. Institution submits a tampered FDR; the heatmap and signals appear.
4. Bank desk returns a signed confirmation; the provenance grid turns from conflict to proof on a genuine instrument.
5. Release case blocked by a PGRC complaint, cleared, NOC issued, QR verified on a phone.
6. Audit chain verification and the impact panel.
