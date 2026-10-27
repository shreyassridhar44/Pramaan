# Changelog

All notable changes are recorded here. Format follows Keep a Changelog; versions follow Semantic Versioning.

## [Unreleased]

### Changed
- The board surface, rail, government strip and footer follow the chosen theme; the forecast no longer switches to dark (DECISION D39).
- The command board shows a 13-week maturity runway with the matured backlog in place of the 90-day pulse trace.
- The rail and the government strip stay pinned, and the rail fits the screen without scrolling.

### Fixed
- Letter preview on the deployment: same-origin framing is now allowed, API responses carry their own header set, and the panel offers Open PDF.
- QR scanning by camera on the deployment (the Permissions-Policy blocked the camera).

### Added
- Dashboards as instruments (DECISION D38): command view brief, 90-day pulse monitor (`/portfolio/pulse`), maturity clock, proof meter, isometric regional towers, case-file docket, signal cards and impact dials; a time-machine forecast console; the institution dashboard as a certificate band, challan and sealed deposit cards; a release line; a registry status ribbon; reminder and escalation stairs; a lighting audit chain; a bank terminal strip; an entry gate after sign-in; page transitions; a search board for Ctrl K.
- Security-print visual language (DECISION D36): seeded guilloche rosettes, embossed assurance seals that gain features as proof grows, holographic foil, rubber stamps, split-flap figures, microprint, a GIGW strip with text size and contrast, bilingual titles and an official-style footer.
- Public home page with a live portfolio board, a ticker of aggregate figures, the deposit lifecycle as stamps, regional tiles and QR verification by camera (jsQR where the browser has no detector). Signed-out visitors land here.
- Identity-card personas on sign-in, a dark command board, and a navy rail with Hindi labels.
- UV lamp in the document viewer: a magnifying loupe over the forensic heatmap, plus a scan sweep when a page loads.
- Proof moment on the bank desk: fields checked, the signed message travelling to AICTE, and a seal.
- Guided tour of the six R16 scenarios across personas (`/home?tour=1`).
- Audit tamper drill (demo mode): erase a bank-reported mismatch behind Pramaan's back, watch the chain check name the entry, restore it.
- Legacy register import (DECISION D37): reconcile any desk's Excel or CSV register row by row; a synthetic, roughened sample is generated from the demo records.
- Reminder previews: the SMS, WhatsApp and email an institution received, in Hindi or English, on a phone.
- Deposit passport: an instrument's history as dated stamps.
- Letters carry a guilloche border, a rosette watermark seeded by the reference, and microprint; the verify page shows a holographic seal for a genuine letter.
- Automatic deploys: the server checks `main` every 2 minutes and deploys any new commit, whoever pushed it, rolling back a release that fails its health check (`infra/aws/enable-autodeploy.sh`).
- Real-click sign-in and navigation tests in Chrome, Firefox and WebKit (Safari's engine).
- Trained models in the API: the edit localiser (image-level ROC AUC 0.944 and pixel F1 0.737 on unseen synthetic layouts) and the LightGBM field extractor (98.6% mean exact match against 98.3% for the rules), with results in `EVALUATION.md` and `MODEL_CARD.md`.
- A localiser operating point chosen on validation data (probability above 0.98 over at least 300 px), which cuts marks on unedited test pages from 22.1% to 5.4%; marks that touch no value field are graded low.
- Deployment set: production images for the API and the web app, `infra/compose.yml` (Postgres, Valkey, API, worker, Mailpit inbox, nginx), and AWS scripts for provisioning (S3, IAM, SSM secrets, security group, Graviton instance, Elastic IP, CloudFront), deploys over SSM Run Command, nightly backups and day-to-day operations.
- Readiness checks for the queue, document storage and model files.
- Live deployment on AWS (t4g.small, Caddy with Let's Encrypt) and `E2E_BASE_URL` to run the end-to-end suite against it; a demo script in `docs/DEMO_SCRIPT.md`.
- Monitoring alerts beyond maturity: re-confirmation reminders, automatic renewal notices and penalty-window notices on overdue demands, sent by email with simulated SMS and WhatsApp; an Alerts page with the reminders sent and the open escalations with their next level.
- Registry bulk actions (request confirmation, send reminder, assign) that report what was done and why anything was skipped, saved views and a column chooser kept per viewer in the browser.
- Release penalties computed by the rules engine when a case is applied for, shown with their APH clause on the case page, and recorded as paid by a section head or the competent authority with a payment reference.
- A component gallery at `/dev/components` in development builds.
- Step 9 management layer: a command view with a monthly maturity river by proof level (with a table view and click-through to the registry), a tile cartogram of AICTE regions, largest unproven exposures, recent signals, an impact panel with a turnaround trend, 30-day deltas and a side sheet for action items; a forecast that plays the next 52 weeks with speed control, regional recolouring, rolling figures, a playhead and an event stream; plain-language search in the registry with reviewable chips (Bedrock path behind a flag, rule parser by default); eight reports with CSV and PDF export; and versioned rule administration with validation and effective dates.
- Officer corrections of declared values with reasons, resubmission of returned deposits from the portal, deficiency letters on return, an observation composer, and event reasons in the timeline.
- End-to-end tests for the R16 scenarios, an accessibility sweep of every route in both themes, and a performance script with recorded results.
- Step 8 release workflow: release applications from the portal with live Clause 6.46 hints and specimen documents, a releases list and case page with clearance lanes, a clearance queue for PGRC, Vigilance and Grants (PGRC resolves open complaints before clearing), authorisation by the competent authority only when every condition passes, bilingual NOC and sanction-order PDFs with a signed QR code, bank discharge through the bank network or the bank desk, a letters page with preview and revocation, and a public verify page for phones.
- Step 7 bank network and monitoring: Ed25519-signed bank confirmations verified before any value is used, automatic answers from network banks, a simulated bank desk for banks that answer manually, field-by-field conflicts with the bank's record, rejection of responses whose signature does not verify, published bank keys, a bank tab with the request handshake and statement-style messages, a daily monitoring run with reminders, escalations, in-app notifications and email, a notifications bell, and renewal submissions prefilled from the deposit being renewed.
- Step 6 intake: document upload and analysis with checks (document against declaration, amount in figures against words, field-relative forensic outliers, duplicate instruments and images), institution portal with demand card, deadline and penalty slabs, a four-step submission wizard that reads the receipt before submission, specimen receipts in demo mode, officer actions (start scrutiny, verify, return), signal resolution, the verification queue and a document viewer with field boxes and heatmap layers.
- Step 5 officer workspace: instrument registry (virtualised, URL-driven filters, sort, CSV export), instrument detail with field-level provenance grid and character-level diffs on a normalised display form, signals, reminder ladder, renewal chain, linked demand, timeline and audit tabs, institutions list and profile with the Table 1.4 demand explained, audit trail page with animated chain verification, reference-data endpoint, and action-queue titles that name the conflicting field.
- Step 4 interface foundation: design tokens with Ledger and Command themes, base components, assurance ring, status and severity chips, global as-of control kept in the URL, command palette, application shell with role badge, sign-in page with live portfolio figures and demo personas, role-based route guards, and the first command view.
- Step 3 ML kit: synthetic FDR renderer with 12 fictional bank layouts, print-scan degradation, four tamper types with pixel masks, layout-split dataset builder with a held-out edit type, U-Net localiser training with built-in noise-residual filters and ONNX export with parity check, LightGBM field extractor with a rule baseline, evaluation scripts, and the API document pipeline (PDF and image intake, OCR, field extraction, learned and classical forensics, perceptual hashing). OCR-tolerant date parsing.
- Step 2 domain and data: pure domain core (provenance, assurance, state machine, APH rules for demand, deadlines, maturity, escalation, penalties and release, as-of engine with timeline); database schema and migrations; hash-chained audit with verification; session auth with CSRF, lockout and demo personas; role and region scoping; read APIs for portfolio, instruments, institutions and audit; synthetic portfolio generator and demo reset.
- Step 1 foundation: FastAPI skeleton with health and readiness endpoints, JSON logging and error envelope; React web app with design tokens, Indian formatting and typed API client; dev services in Docker Compose; CI workflow; contrast check; pre-commit hooks.
- Research, specification and implementation plan: `PROBLEM_STATEMENT.md`, `RESEARCH.md`, `PROJECT.md`, `ARCHITECTURE.md`, supporting documents and the `claude-code/` directory (24 October 2026).

### Fixed
- Persona and password sign-in often bounced back to the sign-in page because the route guards read a cached "signed out"; sign-in now writes the new session into the cache.
- The navigation rail no longer widens on hover, which pushed the page sideways and made clicks near it miss; it is open with labels on wide screens and icon-only with tooltips below 1280 px.
- A forensic mark on one digit of a wide field is now mapped to that field; before, it read as outside the value fields.
- The forecast timeline computes 52 weeks in 1.6 s instead of 8.6 s, with identical output (reminders are computed directly instead of regenerating each deposit's full schedule every week).
- A rule version scheduled for a later date no longer applies before that date.
- CI: the test setup now normalises the database URL, which had made every API job fail since the domain step.
- The institution letters page, registry links with an all-digit search, release changes not refreshing cached statuses, and several accessibility issues (registry table semantics, listbox structure, a keyboard-scrollable table, accent contrast).
- Seeded institutions no longer collide with the release story by name prefix, and seeded letters are numbered in order of issue.
- The demo history now includes the weekly overdue reminders the nightly run sends after maturity, so a matured deposit's reminder ladder no longer shows its overdue steps as "Before records".
- Overdue reminders read "matured 7 days ago" instead of "matures 7 days ago", and the Alerts page labels them "7 d overdue" instead of "-7 d before".
- The command view loads ECharts only when the River view is chosen, so an officer's first page needs 274 KB of JavaScript (gzip) instead of 445 KB, within the 350 KB gate (`QUALITY_GATES.md` G5).
- The "SIH 2026 prototype" badge is gone from the top strip, sign-in, verify page and footer; the footer keeps a short "Not an official AICTE website" line, and simulated parts keep their labels.
- Empty successful responses (204) no longer show as failed requests in the web app.
- The submission confirmation no longer disappears when the portal refreshes after a demand is met.
- Late-furnishing penalty slabs use the next 31 May and 31 July on or after the due date.
- OCR output without spaces is handled for labels, dates and amounts in words.
- Re-seeding now changes the data version, so cached portfolio figures refresh after a demo reset.
- Action queue ranks discrepancies, then the most recent overdue items, then upcoming maturities.
