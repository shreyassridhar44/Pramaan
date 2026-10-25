# Changelog

All notable changes are recorded here. Format follows Keep a Changelog; versions follow Semantic Versioning.

## [Unreleased]

### Added
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
- CI: the test setup now normalises the database URL, which had made every API job fail since the domain step.
- The institution letters page, registry links with an all-digit search, release changes not refreshing cached statuses, and several accessibility issues (registry table semantics, listbox structure, a keyboard-scrollable table, accent contrast).
- Seeded institutions no longer collide with the release story by name prefix, and seeded letters are numbered in order of issue.
- Empty successful responses (204) no longer show as failed requests in the web app.
- The submission confirmation no longer disappears when the portal refreshes after a demand is met.
- Late-furnishing penalty slabs use the next 31 May and 31 July on or after the due date.
- OCR output without spaces is handled for labels, dates and amounts in words.
- Re-seeding now changes the data version, so cached portfolio figures refresh after a demo reset.
- Action queue ranks discrepancies, then the most recent overdue items, then upcoming maturities.
