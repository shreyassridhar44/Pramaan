# HANDOFF.md: Implementation log

Update this file at the end of every working session and every completed step.

## Status

| Step | Name | State | Commit |
|---|---|---|---|
| 0 | Research and specification | Done, awaiting owner approval | docs commit (24 Oct 2026) |
| 1 | Foundation and tooling | Done (API 2 tests, web 12 tests, lint, types, contrast) | see git log |
| 2 | Domain model, rules, synthetic portfolio | Done (81 API tests; seed 2,600 institutions in about 25 s) | see git log |
| 3 | ML kit | Done: renderer (12 layouts), degradation, tamper generator, dataset builder, localiser training and ONNX export, field extractor training, evaluation scripts, document pipeline in the API; trained on an RTX A5000 on 26 Oct 2026 (`ml/TRAINING_REPORT.md`) and active in the API | see git log |
| 4 | Design system and shell | Done: tokens (Ledger and Command themes), primitives, AssuranceRing, chips, AsOfControl, command palette, shell, sign-in with personas, route guards, first command view (headline band, assurance composition, action queue); 20 web tests with axe. ProvenanceGrid, SignalCard, BankMessage and AuditChain are built in Steps 5 to 7 where they are first used (recorded deviation) | see git log |
| 5 | Registry, detail, institutions | Done: virtualised registry with URL filters and CSV export, instrument detail with ProvenanceGrid (display-normalised character diff), signals, key dates and reminder ladder, renewal chain, demand, timeline and audit tabs; institutions list and profile with Table 1.4 explanation; audit page with chain verification | see git log |
| 6 | Intake and document intelligence | Done: storage interface, document upload with synchronous analysis, checks (document against declaration, figures against words, field-relative forensic outliers, duplicate instrument and image), institution portal home and 4-step wizard with specimen receipts, officer action bar, signal resolution, verification queue, DocumentViewer; 105 API tests | see git log |
| 7 | Bank network, monitoring, notifications | Done: Ed25519-signed bank messages verified before use, automatic answers from network banks, bank desk for desk banks (simulated, labelled), conflicts raised field by field, tampered responses rejected with a signal, published bank keys; daily monitoring run (reminders, escalations, notifications, email through Mailpit or SES, simulated SMS and WhatsApp) that is idempotent, arq worker schedule, notifications bell; renewal submissions that link and close the predecessor; 115 API tests | see git log |
| 8 | Release, letters, verification | Done (audited 25 Oct 2026, see below): portal release application with live eligibility hints and specimen documents, releases list and case page with ClearanceLanes, cell clearance queue (PGRC resolves complaints before clearing), authorisation only by the competent authority when every Clause 6.46 condition passes, NOC or sanction order PDF (bilingual, HarfBuzz-shaped Devanagari, signed QR), bank discharge through the network or the bank desk, letters page with preview and revoke, public mobile verify page (Genuine, Superseded, Revoked, Not recognised); 119 API tests plus 4 slow OCR tests, 23 web tests | see git log |
| 9 | Command view, forecast, search, reports | Done: command view with monthly maturity river (table view, click-through), region tile cartogram, largest unproven exposures, recent signals, impact panel with turnaround trend, 30-day deltas and an action side sheet; forecast with play, speed, map recolouring, rolling figures, playhead and event stream; plain-language Ask bar (Bedrock path built, rule parser active; 100% on 60 queries and 15/15 held out); eight reports with CSV and PDF reconciling with the summary; versioned rule administration; forecast timeline 1.6 s cold for 52 weeks | see git log |
| 10 | Hardening, evaluation, deployment, demo | In progress: model results in EVALUATION and MODEL_CARD, operating point calibrated, deployed to AWS at https://pramaan.duckdns.org (64 of 64 e2e tests pass on it, backup and restore drill done), demo script written; recording, PPT screenshots and tag pending | see git log |

## Session log

### 26 October 2026 (evening): dashboards as instruments (DECISION D38)
- Owner rated the first redesign 7 out of 10 and asked for the dashboards to change most. Built the command centre (brief, pulse, maturity clock, proof meter, isometric towers, docket, signal cards, dials), the forecast console, the institution certificate dashboard, the release line, registry ribbon, alert stairs, audit chain strip, bank terminal, entry gate and page transitions.
- New endpoint `/portfolio/pulse`. Tests updated for the clock (the river view is still tested).
- From this session on, commits are authored and pushed as Ayaan0777 <6syedayaan@gmail.com> (owner's instruction). Git Credential Manager's stored login for Ayaan0777 was rejected by GitHub; until it is refreshed with `git credential-manager github login --username Ayaan0777`, commits wait locally.

### 26 October 2026 (afternoon): security-print redesign (DECISION D36, D37)
- Owner rated the shipped interface 4 out of 10 and approved a redesign on the `redesign` branch, with the UI frozen at 23:00 IST on 27 October. About 40 public SIH26265 repositories were cloned and read: most share KPI cards, Recharts, Tesseract and a navy and saffron landing page; none ships a trained model, maps are rare, none uses WebGL.
- Built: security-print components (`components/security/`), public home page (`/home`), GIGW strip and footer, identity-card sign-in, dark rail and command board, assurance seals, UV lamp, proof moment, verify-page hologram, guilloche on PDF letters, guided tour (`/home?tour=1`), audit tamper drill (`/demo/tamper-drill`), legacy register import (`/admin/import`, `/legacy/*`), reminder previews (`/alerts/reminders/{id}/preview`), deposit passport.
- Signed-out visitors to any officer page now land on `/home` instead of `/signin`.
- New dependencies: jsqr 1.4.0 (web), openpyxl 3.1.5 (API).
- The dev server on this laptop runs on port 5174 because an unidentified older node process holds 5173; uvicorn's reload does not notice file changes on this machine, so restart the API after editing it.

### 24 October 2026: research and specification
- Captured SIH26265 verbatim; itemised requirements R1 to R16 and constraints C1 to C7.
- Read APH 2024-2027 and extracted the security deposit rules.
- Inspected 18 competitor repositories (clones, git history, code, tests, deployments).
- Wrote all root documents and this directory.
- Owner decisions recorded: name Pramaan; GPU available for training; Bedrock Claude for search; AWS budget $100 to last until January (lean single-instance deployment chosen).

## Changed files
- All documentation files at the root and in `claude-code/`.

## Test results
- None yet (no code).

## Known issues
- None.

## Unresolved questions for the owner
1. Approval of the specification, design direction and plan (required before Step 1).
2. Repository licence: keep all rights reserved, or choose an open licence (D15).
3. Team name and member names for the sign-in page footer, letters and the demo video credits.
4. GPU machine details (GPU model and VRAM) to size the training batch and dataset.
5. Whether the AWS account may send email through SES to team members' addresses (needs identity verification of each recipient while in the SES sandbox).

## Exact next steps
1. Owner: record the demo video with `docs/DEMO_SCRIPT.md` on the live site; take PPT screenshots from it.
2. Step 10: remaining `RELEASE_CHECKLIST.md` items (QR from a phone on mobile data, quality gates, README quick start on a clean machine), then tag `v1.0.0-sih`.
3. Owner (optional): open an AWS Support case to verify the account for CloudFront; then `EDGE=cloudfront bash infra/aws/provision.sh` gives a cloudfront.net URL.
4. Owner (optional): add an end-to-end job to `.github/workflows/ci.yml` (needs a token with the `workflow` scope).
5. Owner: Bedrock inference is blocked for account 067257065056 ("Operation not allowed" for every model and region tried). Ask AWS to enable model access (model access page or a support case); then set `BEDROCK_ENABLED=true` and run `uv run python -m scripts.search_eval --model`.

Notes from Step 10 (26 October 2026):
- Training results arrived in `add2a64` (authored as the owner). The API loads both models; `/readyz` reports `models: ok`.
- At the raw 0.5 threshold the localiser marked 19% of unedited test pages, and the genuine demo receipt got two marks. The operating point (probability above 0.98, at least 300 px) was chosen on 400 regenerated validation images and checked once on the first 600 test images: unedited pages marked 5.4%, edited pages marked on the edit 83.8% (trained types 98 to 100%, unseen splice 44%). Marks that touch no value field are graded low. The genuine demo receipt now gets one low mark on the printed "IFSC" label; the altered one gets one high mark on the changed digit.
- Production stack tested locally on port 8088 (`infra/.env` is local only): all containers healthy, readiness ok, API about 220 MB. The full OpenCV that RapidOCR pulls in needs libgl1, libglib2.0-0 and libxcb1 in the image.
- Playwright does not start the API on this laptop (`uv` is not on the Windows command path it uses); start the API by hand first.
- An unrelated project's containers (`garuda-*`) run on this laptop and its EC2 instance runs in the same AWS account; leave both alone.
- Test results: API 151 tests plus 5 slow, Playwright 64 of 64 locally and 64 of 64 against the live site.
- AWS (account 067257065056, ap-south-1): the account is on the Free plan ($95 credit, ends 20 Jan 2027), which refuses t4g.medium and CloudFront until AWS verifies the account. Deployed on a t4g.small (`i-052700f869b9ac939`, Elastic IP 13.204.48.202) with Caddy and Let's Encrypt on `pramaan.duckdns.org` (DuckDNS name claimed by the owner, pointing at the Elastic IP; `13-204-48-202.sslip.io` is still served). About $15 a month.
- Live smoke test: uploads analysed in about 8 s; the altered receipt is marked high on the amount (a field-mapping bug that read it as outside the value fields was fixed in `c26a5d8`), the genuine one gets one low mark.
- Sign-in and clickability (D34): persona clicks were dropped by a stale cached session in the route guards, and the hover-widening rail moved the page under the pointer. Both fixed; `e2e/signin.spec.ts` and `e2e/interactions.spec.ts` click for real in Chrome, Firefox and WebKit (`npx playwright install firefox webkit` once).
- Auto-deploy (D35): `pramaan-autodeploy.timer` on the instance deploys new commits on `main` with a read-only deploy key; `ops.sh autodeploy-log` shows its runs. Manual `deploy.sh` refuses anything but `origin/main` unless `FORCE=1`.
- After running e2e against the live site, reset its data (`POST /api/v1/demo/reset` as admin); the suite resets only at the start.
- The Windows AWS CLI cannot read Git Bash's `/tmp` and crashes on non-ASCII output; the scripts keep temporary files in `infra/aws/` and set `PYTHONUTF8=1`.

Notes from Step 9:
- Demo shots: command view (figures roll, river, cartogram); Ask bar with "SBI and unconfirmed deposits in the Western region maturing before March 2027" (shows chips, flags SBI as not in the portfolio); forecast at 4x; reports; rules.
- The forecast switches to the Command theme while open and restores the previous theme on leaving, without saving it.
- Rule versions are dated: a version scheduled for later has no effect until its date (`load_rules` defaults to today).

Audit of Steps 1 to 9 against the STEPS.md task lists (25 October 2026), gaps found and closed:
- Step 4: no component gallery. Added `/dev/components` (development builds only; production answers not found).
- Step 5: registry saved views, column chooser and bulk selection were missing. Added (DECISION D32); bulk actions are request confirmation, send reminder and assign, up to 200 at a time, each instrument checked and skipped with a reason.
- Step 6: server-sent events for analysis were not built; recorded as not needed (DECISION D31).
- Step 7: monitoring only sent maturity reminders. It now also sends re-confirmation reminders (bank confirmation older than the rule's window), automatic renewal notices (30 days before maturity) and penalty-window notices on overdue demands (one per slab; after the last slab the section head is told a decision is needed, the system never withdraws approval). Institution messages go by email plus simulated SMS and WhatsApp. New Alerts page with Reminders and Escalations tabs.
- Step 8: release penalties were never computed. Applications now record the penalties found by `domain/rules/penalty`; the case page shows them with their APH clause, and a section head or the competent authority records the payment reference before the penalty condition passes.
- `infra/compose.yml` (deployment set) is built in Step 10.

Audit of Steps 1 to 8 (25 October 2026), gaps found and closed:
- CI had failed on every push since Step 2: the test setup passed CI's psycopg URL to asyncpg. Fixed; CI green from `1480f46`.
- FR13 corrections were missing: officers now correct permitted declared fields with a reason, the original stays in history, and corrections cannot hide a disagreement with the receipt or the bank.
- Returned deposits could not be resubmitted: the portal shows the reason and accepts a corrected resubmission; the as-of engine tracks resubmission.
- No deficiency letter on return (S5, F6): returns now issue a signed, bilingual deficiency letter.
- No observation composer (PROTOTYPE F4) and timeline events without their reasons: both added.
- The institution letters page had been committed as the router's placeholder; restored.
- Registry links with an all-digit search were dropped by the router's JSON parsing; fixed.
- Release applications and authorisations did not bump the data version, so cached statuses could go stale; fixed, and the registry now serves from a per-version index (DECISION D26).
- Accessibility: registry table semantics, listbox structure, keyboard-scrollable letters table, and the ledger accent contrast (D28). Axe passes on every route in both themes.
- Tests added: Playwright scenarios S1, S2, S4, S5, S6, observations and corrections, region scope, accessibility sweep, registry timing; API tests for corrections, resubmission, escalation over simulated days, reminders exactly once (S3) and the renewal chain. Performance targets measured (TESTING.md Section 5).

Notes from Step 8:
- Release demo: sign in as PGRC, open "Sahyadri College of Engineering, Nashik" (REL/2026/000003), mark the open complaint resolved, then Clear; sign in as the authority, open the case and Issue NOC; open the verification page from the success dialog or scan the QR in the PDF. Revoke from Letters to show the Revoked state.
- Portal: the Demo Institute's oldest FDR matured 12 days before the anchor, so the institution can apply for release with the specimen documents. Its bank is a desk bank, so discharge waits for the bank persona.
- QR codes point at `PUBLIC_BASE_URL` (default `http://localhost:5173`). For a phone scan on the local network, set it to the machine's LAN address and open Vite with `--host`.
- Letter PDFs render on first download and are cached in storage; seeded letters for older cases are generated the same way.

Notes from Step 7:
- Bank flow demo: sign in as the institution, submit the altered specimen (declare Rs 35,00,000); as the bureau officer open the instrument, Bank tab, Request confirmation; as the bank persona (Bharat National Bank, a desk bank) sign the response; the officer sees the amount conflict with the bank's signed Rs 15,00,000.
- Monitoring runs at 06:00 IST from the arq worker (`uv run arq app.workers.settings.WorkerSettings`) or on demand at `POST /api/v1/monitoring/run` (section head or admin). Each reminder is keyed by instrument, rung and date, so repeated runs send nothing new.
- The submission wizard keeps its confirmation in the parent component, because the home refetch after submission closes the demand.

Demo story assets: `services/api/app/demo_assets` holds a genuine and an altered specimen receipt for the Demo Institute's open demand, and the simulated bank holds the genuine record (Rs 15,00,000). The altered receipt reads Rs 35,00,000 in figures and Fifteen Lakh in words.

Dev tip: on Windows, run the API without `--reload` (stale reloader processes kept serving old code); restart it after backend changes and regenerate web types with `npm run api:types`.

Notes from Step 3:
- Smoke results on 40 training documents showed the trained extractor ahead of the rule baseline; an evaluation bug (amount truth normalised twice) and OCR date slips were fixed afterwards. No smoke number is reported anywhere.
- The API falls back to classical forensics and the rule extractor until `ml/models/localiser.onnx` and `ml/models/field_extractor.txt` exist.
- OCR-heavy tests are marked `slow`.

Notes from Step 2:
- Seed: `cd services/api && uv run python -m scripts.seed` (anchor defaults to today). Demo password for every persona: `Pramaan@2026`.
- Statuses and assurance are always computed by `app.domain.asof`; the stored `status` column is the value on the seeding date and is informational.
- Tests use database `pramaan_test` (created automatically).
- In Git Bash, prepend `/c/Program Files/Docker/Docker/resources/bin` to PATH for docker pulls.
