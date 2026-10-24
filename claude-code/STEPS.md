# STEPS.md: Implementation plan in 10 steps

Steps run in order. A step is complete only when every acceptance criterion passes, its tests pass in CI, `HANDOFF.md` is updated, and the work is committed with a Conventional Commit message. Step 3 deliberately ships the ML data and training kit early, so model training on the GPU machine runs in parallel with Steps 4 to 7.

Target calendar (deadline 28 October 2026, submission planned for the night of 27 October):

| Day | Steps |
|---|---|
| Sat 25 Oct | 1, 2, 3, start 4 |
| Sun 26 Oct | 4, 5, 6, 7 |
| Mon 27 Oct | 8, 9, 10 (deploy, demo recording) |

---

## Step 1. Foundation and tooling

**Objectives.** A clean monorepo that builds, lints, tests and runs locally with one command.

**Tasks**
1. Create the layout in `ARCHITECTURE.md` Section 2.
2. `infra/compose.dev.yml`: Postgres 16, Redis 7, MinIO, Mailpit; `infra/compose.yml` for the deployment set.
3. API skeleton: FastAPI app factory, settings (pydantic-settings), structured logging, `/healthz`, `/readyz`, error handler with request IDs.
4. Web skeleton: Vite, React 19, TypeScript strict, Tailwind v4 with `tokens.css`, TanStack Router and Query, fonts self-hosted.
5. Tooling: ruff, mypy, pytest; ESLint, Prettier, Vitest; `scripts/check-contrast.mjs`; pre-commit config.
6. GitHub Actions CI: lint, type-check, tests, web build.
7. `.env.example` files, `.gitignore`, `.editorconfig`.

**Dependencies.** None.

**Files.** `apps/web/*`, `services/api/*`, `infra/*`, `.github/workflows/ci.yml`, root configs.

**Outputs.** `make dev` (or `npm run dev` plus `docker compose`) starts everything; web shows a placeholder page reading `/api/v1/healthz`.

**Tests.** API health test; web smoke test; contrast script passes on tokens.

**Acceptance criteria.** Fresh clone to running stack in under 10 minutes following `README.md`; CI green.

---

## Step 2. Domain model, rules and synthetic portfolio

**Objectives.** The system of record and all rules, with realistic data.

**Tasks**
1. SQLAlchemy models and the first Alembic migration for every table in `ARCHITECTURE.md` Section 5.
2. Domain modules: state machine, provenance normalisation and comparison, assurance computation, rule families (demand, deadlines, maturity, escalation, release, penalty) with versions and APH references, as-of engine.
3. Audit service with hash chain and verification.
4. Auth: Argon2id passwords, session cookies, CSRF, roles and scopes, demo personas.
5. Synthetic portfolio generator (`ml/synth/portfolio.py`, also importable by the API seeder): 8 regions plus camp offices, about 1,200 institutions, programmes, demands from Table 1.4, about 3,000 instruments over 10 years with renewals, releases, complaints, clearances, bank records for the simulated network (with deliberate mismatches at a controlled rate), events and reminders history.
6. Seed command and `POST /demo/reset`.
7. Read APIs: portfolio summary, instruments list and detail, institutions, timeline, audit.

**Dependencies.** Step 1.

**Files.** `services/api/app/{models,domain,services,api}/*`, `services/api/alembic/*`, `ml/synth/portfolio.py`, `scripts/seed.py`.

**Outputs.** Seeded database; API returns portfolio figures for any as-of date.

**Tests.** Unit tests for every rule (including APH examples: Table 1.4 sums, leased doubling, 15-day deadline, 31 May and 31 July penalty windows, premature encashment 10%, release blockers); state-machine transition tests; assurance tests; audit chain tamper test; RBAC tests for each role on list and detail endpoints; as-of engine property tests (statuses monotonic in time where expected).

**Acceptance criteria.** Rule coverage 100% of rule functions; seeding under 60 s; `/portfolio/summary?as_of=` responds under 300 ms p95 locally.

---

## Step 3. ML kit: synthetic documents, tampering, training and baseline inference

**Objectives.** Hand the GPU machine everything needed to train; ship a working CPU baseline in the meantime.

**Tasks**
1. FDR document renderer (`ml/synth/fdr_render.py`): 12 fictional bank brands with distinct layouts, fonts, logos drawn as simple vector marks, joint-holder blocks, lien clause, QR or barcode where a layout has one, "SYNTHETIC SPECIMEN" watermark; outputs image plus ground-truth field boxes and values.
2. Print-scan degradation: perspective, blur, noise, JPEG, shadows, stamp overlays, folds.
3. Tamper generator (`ml/synth/tamper.py`): digit swap by copy-move, digit insert with mismatched font, field splice from another document, date edit, erase-and-retype; outputs tampered image and pixel mask; untampered controls.
4. Dataset builder with splits by bank layout (train 8 layouts, validation 2, test 2) and by tamper type held out for the test set.
5. Training scripts: `ml/train/localiser.py` (segmentation-models-pytorch U-Net with EfficientNet-B0, input RGB plus 3 noise-residual channels, Dice plus BCE loss, mixed precision) and `ml/train/field_extractor.py` (LightGBM token classifier on OCR tokens with layout and text features).
6. Export to ONNX with a parity check; evaluation scripts writing JSON results consumed by `EVALUATION.md`.
7. `ml/README.md`: exact commands for the GPU machine (environment, dataset size, expected time, export).
8. Baseline inference in the worker: RapidOCR, rule-based field extractor, ELA and noise residual, digit font metrics, duplicate detection; used until trained models arrive.

**Dependencies.** Step 1 (repo), Step 2 (field definitions).

**Files.** `ml/**`, `services/api/app/services/documents/*`, `services/api/app/workers/analyse.py`.

**Outputs.** A dataset of at least 20,000 training images can be generated with one command; training runs end to end on a small sample on CPU; baseline analysis works through the API.

**Tests.** Renderer determinism by seed; masks align with edits (pixel test); ONNX parity within tolerance; analysis pipeline integration test on fixture scans.

**Acceptance criteria.** Owner can start GPU training by following `ml/README.md` without further questions.

---

## Step 4. Design system and application shell

**Objectives.** The look and feel in `PROTOTYPE.md`, built once and reused everywhere.

**Tasks**
1. Tokens for Ledger and Command themes; typography setup; Indian number and date formatters.
2. Base components on Radix: Button, IconButton, Input, Select, Combobox, Checkbox, Switch, Tabs, Dialog, Sheet, Popover, Tooltip, DropdownMenu, Toast, Skeleton, Badge, Chip, Table primitives, EmptyState, ErrorState.
3. Signature components: AssuranceRing, ProvenanceGrid, SignalCard, BankMessage, AsOfControl, CommandPalette, AuditChain (MaturityRiver, IndiaRegionMap and ClearanceLanes in later steps).
4. App shell: left rail, top bar, notifications drawer, role badge, theme toggle, simulated badge.
5. Sign-in page with persona cards; route guards by role; API client generated from OpenAPI.
6. `/dev/components` gallery (dev only).

**Dependencies.** Step 1; Step 2 for auth.

**Files.** `apps/web/src/{styles,components,app,lib}/*`.

**Outputs.** Signed-in shell with navigation for each role.

**Tests.** Component tests (render, keyboard, a11y with axe); formatter unit tests (lakh and crore grouping, compact units).

**Acceptance criteria.** All components keyboard-operable; axe reports no serious violations; both themes pass the contrast script.

---

## Step 5. Registry, instrument detail and institutions

**Objectives.** The officer's core workspace.

**Tasks**
1. Registry with filters, saved views, density, column chooser, virtualisation, bulk selection, CSV export.
2. Instrument detail with all tabs; ProvenanceGrid with character diff; timeline; audit tab; observations and corrections.
3. Institutions list and profile with demand calculation explained line by line.
4. Command palette search over instruments and institutions.

**Dependencies.** Steps 2 and 4.

**Outputs.** Officers can find any instrument in under 3 seconds and see its full evidence.

**Tests.** API integration tests for filters and scopes; web tests for table interactions; e2e: open registry, filter by region and bank, open a record, add an observation.

**Acceptance criteria.** 5,000-row registry interactive under 1.5 s; correction keeps original value in history; region-scoped officer cannot see other regions (API and UI).

---

## Step 6. Institution intake and document intelligence in the product

**Objectives.** New FDR submission end to end with analysis and signals (R16 scenarios 1 and 5).

**Tasks**
1. Portal shell, home with demand card and tasks.
2. Submission wizard with autosave, upload, live extraction pre-check and mismatch display, Affidavit 3, declaration.
3. DocumentViewer with OCR boxes, heatmap layer, page navigation.
4. Signals: creation from analysis, SignalCard actions (confirm, dismiss with reason, resolve).
5. Verification queue with triage keyboard flow; return with deficiency letter.
6. SSE for analysis completion.
7. Swap in trained ONNX models when available (config switch; model versions recorded).

**Dependencies.** Steps 3 and 5.

**Outputs.** J1 steps 1 to 5 and J2 steps 1 to 3 work end to end.

**Tests.** e2e: submit genuine scan, see A1; submit tampered scan, see high-severity signal with heatmap; duplicate number across institutions raises a signal.

**Acceptance criteria.** Analysis completes under 15 s locally for a 2-page PDF; no signal wording claims forgery.

---

## Step 7. Bank confirmation network, monitoring and notifications

**Objectives.** Proof from the bank, and nothing forgotten (R16 scenarios 2, 3, 4).

**Tasks**
1. Bank key registry and Ed25519 signing in the simulator; public keys endpoint.
2. `SimulatedBankNetwork` adapter with latency and seeded outcomes; `BankDesk` surface with inbox, comparison and confirm, mismatch, discharge actions.
3. Response verification, confirmed observations, assurance recompute, conflict signals; BankMessage UI with signature details and raw view.
4. Daily rule run and on-demand run: reminders, escalations, matured without application, auto-renew confirmation, re-confirmation due, penalty windows.
5. Notifications: in-app, email via Mailpit or SES, SMS and WhatsApp to the simulated outbox; alerts page.
6. Renewal flow linking successor to predecessor.

**Dependencies.** Steps 2, 5, 6.

**Outputs.** J1 step 6, J2 step 4, J3 work end to end.

**Tests.** Signature verification (valid, tampered payload, unknown key); adapter contract tests; rule run idempotency (no duplicate reminders); escalation progression over simulated days; renewal chain integrity.

**Acceptance criteria.** Every simulated surface shows the simulated badge; a declared value never appears in the confirmed column.

---

## Step 8. Release workflow, letters and verification

**Objectives.** Clause 6.46 end to end with verifiable outputs (R16 scenario 6).

**Tasks**
1. Release application in the portal with the documents checklist and live eligibility hints.
2. Eligibility engine output on the case page; ClearanceLanes; clearance queues for PGRC, Vigilance, Grants.
3. Final authorisation for authorised roles only: NOC (FDR, RPGF) or sanction order (RTGS); penalties where applicable.
4. Bank discharge request and confirmation.
5. Letter generation (ReportLab) with bilingual header, reference numbers, signed QR token; letters page; revoke.
6. Public verify page and keys endpoint.

**Dependencies.** Steps 2, 7.

**Outputs.** J4 works end to end, including scanning the QR from a phone.

**Tests.** Release cannot be authorised with any open blocker (property test over blocker combinations); only authorised roles can authorise; verify page shows Genuine, Superseded, Revoked, Not recognised correctly; QR token tamper test.

**Acceptance criteria.** NOC PDF renders correctly in Hindi and English; verification works without sign-in on a phone.

---

## Step 9. Command view, forecast, plain-language search, reports

**Objectives.** The management layer and the demo's most visible moments.

**Tasks**
1. Command view per `PROTOTYPE.md` 5.2 with MaturityRiver, IndiaRegionMap, action queue side sheet, signals, impact panel.
2. Global AsOfControl wired to every query; forecast screen with play, speed, event stream; Command theme.
3. Plain-language search: Bedrock call with schema-constrained output, chips UI, deterministic fallback parser, 60-query evaluation set.
4. Reports gallery with CSV and PDF export.
5. Portfolio anomaly signals (Isolation Forest) if time allows (P2).

**Dependencies.** Steps 2, 5, 7, 8.

**Outputs.** Demo shots 0:00 to 1:00 and 2:30 to 3:00 are possible.

**Tests.** Timeline endpoint performance (52 weekly steps under 2 s cold, cached afterwards); search schema validation and fallback; report totals reconcile with registry counts.

**Acceptance criteria.** Forecast plays smoothly at 60 fps on a mid-range laptop; numbers on the command view reconcile with the registry for the same as-of date.

---

## Step 10. Hardening, evaluation, deployment and demo readiness

**Objectives.** A reliable, documented, deployed product and a recorded demo.

**Tasks**
1. Run the R16 e2e suite and the full test plan; fix defects.
2. Accessibility pass (axe, keyboard walk-through, reduced motion) and UX review (`UX_REVIEW.md`).
3. Performance pass (bundle split, image sizes, query plans).
4. Final model evaluation results into `EVALUATION.md` and `MODEL_CARD.md`.
5. AWS deployment per `DEPLOYMENT.md`: buckets, CloudFront, EC2 with Compose, SES identity, SSM parameters, instance role, backups; smoke test on the public URL.
6. Demo data reset and scenario scripts; rehearse the script in `PROTOTYPE.md` Section 12; record.
7. Finalise all documentation, `CHANGELOG.md`, `VERSIONS.md`, `RELEASE_CHECKLIST.md`.

**Dependencies.** Steps 1 to 9.

**Outputs.** Public HTTPS URL, demo video, release tag `v1.0.0-sih`.

**Tests.** Full e2e on the deployed URL; backup and restore drill; security checks in `SECURITY.md`.

**Acceptance criteria.** All quality gates in `QUALITY_GATES.md` pass; release checklist complete.
