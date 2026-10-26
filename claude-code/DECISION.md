# DECISION.md: Decision record

Each decision lists context, alternatives, evidence, the choice, trade-offs and when to revisit. Status values: Proposed, Accepted (by the owner), Superseded.

---

## D1. Problem statement
- **Date.** 24 Oct 2026. **Status.** Accepted (owner).
- **Context.** Five new AICTE statements (SIH26261 to SIH26265); the goal is the highest chance of shortlisting.
- **Alternatives.** 26261 (document AI), 26262 (approval workflow), 26263 (APAAR), 26264 (complaints dashboard), 26265 (FDR portal).
- **Evidence.** Idea counts on 24 Oct: 31, 27, 27, 35, 16. 26265 grew slowest (about 1.5 per day). The previous late batch closed at 160 to 300 per software statement. Competitor code review in `RESEARCH.md`.
- **Choice.** SIH26265.
- **Trade-offs.** The domain looks plain at first sight, so the product must create its own visual and technical highlights.
- **Revisit if.** Not applicable after submission.

## D2. Product name
- **Date.** 24 Oct 2026. **Status.** Accepted (owner).
- **Context.** The repository was first named NidhiSetu; another 26265 team uses NidhiSetu with a live site.
- **Alternatives.** NidhiSetu, Amaanat, Nyaas, Pramaan.
- **Evidence.** `Abhay18570/NidhiSetu` exists for the same statement. Several SIH26261 repositories use "Pramaan" or "Praman" (a different statement from the same bureau).
- **Choice.** Pramaan (owner's choice), repository `shreyassridhar44/Pramaan`.
- **Trade-offs.** Possible name overlap with SIH26261 teams in the same bureau's review.
- **Revisit if.** The owner wants a sub-brand to reduce overlap.

## D3. Web framework: React SPA with Vite instead of Next.js
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Context.** An authenticated, highly interactive application (tables, maps, charts, forecast animation). Hosting budget is about $30 per month.
- **Alternatives.** Next.js 16 (App Router, SSR); Remix; SvelteKit; Angular.
- **Evidence.** No page needs SEO except the verify page, which is tiny. A static SPA can be served from S3 through CloudFront at almost no cost, while SSR needs a Node runtime on the instance. React has the largest ecosystem for the components we need (Radix, TanStack, ECharts wrappers, MapLibre bindings).
- **Choice.** React 19 + Vite + TanStack Router.
- **Trade-offs.** No server rendering; first load relies on code splitting.
- **Revisit if.** Public pages with SEO needs grow.

## D4. Component approach: Radix primitives with our own component layer
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Context.** UI must not look like a template.
- **Alternatives.** MUI, Ant Design, Mantine, Chakra, shadcn/ui copied as is.
- **Evidence.** Full component kits impose a recognisable look and fight custom design. Radix gives accessible behaviour without styling. shadcn's pattern (owning the code) is good, but its default styling is now very common in hackathon projects.
- **Choice.** Radix primitives, Tailwind v4, our own tokens and components in `components/ui`, plus custom signature components.
- **Trade-offs.** More components to build in Step 4.
- **Revisit if.** Step 4 overruns by more than half a day; then adopt shadcn components and restyle them.

## D5. Charts and maps: Apache ECharts and MapLibre GL
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Alternatives.** Recharts, visx, Nivo, Highcharts (commercial licence), deck.gl, Leaflet, Mapbox GL (licence and token).
- **Evidence.** ECharts handles large animated series smoothly (canvas) and supports stream-style stacked areas and accessible data views; Apache 2.0. MapLibre is open source (BSD-3), vector-rendered, no token needed.
- **Choice.** ECharts for the river and analytics; MapLibre for the region map.
- **Trade-offs.** ECharts bundle size (mitigated with modular imports and the SVG renderer).
- **Revisit if.** No Survey of India compliant boundary data can be confirmed; then use a tile cartogram (see D13).
- **Update (25 Oct 2026).** ECharts is used for the maturity river. MapLibre was not needed: the region view is a tile cartogram (D13), so the dependency was removed.

## D6. Backend: FastAPI (Python) monolith with workers
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Alternatives.** Node (NestJS or Express) API plus a Python ML service; Django; Supabase (Postgres functions and RLS).
- **Evidence.** The ML and document stack is Python. One language for API, rules and ML keeps rules testable in one place and simplifies deployment on one instance. FastAPI gives typed schemas and generated OpenAPI for typed web clients.
- **Choice.** FastAPI, SQLAlchemy 2, Alembic, arq workers on Redis.
- **Trade-offs.** Two languages across the repo (TypeScript and Python).
- **Revisit if.** Never for this release.

## D7. Database: PostgreSQL in a container on the instance
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Alternatives.** Amazon RDS for PostgreSQL; Aurora Serverless v2; DynamoDB.
- **Evidence.** RDS adds roughly $15 to $30 per month, which breaks the owner's $100 budget over three months. The data volume is small. Backups to S3 nightly cover recovery for a prototype.
- **Choice.** Postgres 16 container with a persistent EBS volume, nightly `pg_dump` to S3.
- **Trade-offs.** No managed failover.
- **Revisit if.** Shortlisted for the finale with a longer horizon, or real data is involved.

## D8. AWS hosting: one t4g.medium with Docker Compose, CloudFront in front
- **Date.** 24 Oct 2026. **Status.** Proposed (owner set the budget: $100 credit lasting to January).
- **Alternatives.** ECS Fargate plus RDS plus ALB (about $90 to $150 per month); Lightsail; App Runner; t4g.large (about $33 per month).
- **Evidence.** On-demand price in ap-south-1 checked through the AWS Pricing API on 24 Oct 2026: t4g.medium $0.0224 per hour, t4g.large $0.0448. Estimated total about $21 to $24 per month, so $100 lasts more than four months. CloudFront provides HTTPS with its default certificate and avoids buying a domain.
- **Choice.** t4g.medium (2 vCPU, 4 GB, ARM), 30 GB gp3, 2 GB swap; web on S3; CloudFront for both.
- **Trade-offs.** ARM requires arm64 images (all chosen dependencies publish arm64 wheels or images; verified at build time). Single point of failure.
- **Revisit if.** Memory pressure during document analysis exceeds limits; then t4g.large for the demo window only.

## D9. OCR: PP-OCR models through RapidOCR on ONNX Runtime
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Alternatives.** Tesseract; docTR; PaddleOCR with the Paddle framework; cloud OCR (Amazon Textract).
- **Evidence.** PaddleOCR family led the third-party accuracy comparisons we found (`RESEARCH.md` 3.1). RapidOCR packages the same models for ONNX Runtime, which is light and runs on ARM CPU. Textract would send documents outside the application and adds cost.
- **Choice.** RapidOCR with ONNX Runtime; Tesseract not used.
- **Trade-offs.** Must measure accuracy ourselves on FDR layouts.
- **Revisit if.** Field exact-match on the synthetic test set is below 90%.

## D10. Forensics: train our own localiser on synthetic FDR tampering
- **Date.** 24 Oct 2026. **Status.** Proposed (owner confirmed GPU availability).
- **Alternatives.** Classical signals only; pretrained TruFor or CAT-Net weights.
- **Evidence.** DocForge-Bench (2026) reports that no evaluated method works reliably out of the box on documents. Licences of some pretrained forensics weights are research-only (to be checked per model). A model trained on in-domain synthetic tampering, combined with explainable classical signals, gives both performance and explanation.
- **Choice.** U-Net with EfficientNet-B0 encoder on RGB plus noise residual, trained on synthetic data; classical ELA, noise and font-metric signals alongside.
- **Trade-offs.** Generalisation to real scans is unproven; we say so.
- **Revisit if.** Held-out pixel F1 is below 0.5; then lead with classical signals in the UI and show the model as experimental.

## D11. Bank confirmation: simulated network with Ed25519-signed messages
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Alternatives.** Manual upload of the bank certificate (current practice); HMAC-signed mock responses; live Account Aggregator sandbox.
- **Evidence.** No public API confirms arbitrary joint FDRs (`RESEARCH.md` 2.3). HMAC needs a shared secret and cannot prove which party signed. AA live coverage for joint term deposits is unverified and onboarding takes weeks.
- **Choice.** Adapter interface; simulated network and bank desk with Ed25519 signatures; AA adapter documented as the production path.
- **Trade-offs.** Simulated; labelled as such everywhere.
- **Revisit if.** AICTE provides a bank or AA sandbox.

## D12. LLM for search: Bedrock, India-resident profile, structured output only
- **Date.** 24 Oct 2026. **Status.** Accepted (owner).
- **Alternatives.** No LLM; OpenAI; a local small model.
- **Evidence.** India-resident profiles listed in the account on 24 Oct 2026 (`in.anthropic.claude-haiku-4-5-20251001-v1:0`, `in.anthropic.claude-sonnet-5`). Haiku is sufficient for query to filter translation at low cost.
- **Choice.** `in.anthropic.claude-haiku-4-5-20251001-v1:0` by default, configurable; JSON schema validation; deterministic fallback.
- **Trade-offs.** Network dependency; mitigated by fallback.
- **Revisit if.** Schema-valid rate on the 60-query set is below 95%.

## D13. India map data
- **Date.** 24 Oct 2026; resolved 25 Oct 2026. **Status.** Accepted: tile cartogram.
- **Context.** Maps of India shown by a government-facing product must depict boundaries as per Survey of India.
- **Alternatives.** Geographic map with a compliant boundary dataset; tile cartogram of regions; no map.
- **Choice.** A tile cartogram of the 11 AICTE regional and camp offices, placed roughly geographically and labelled "Tile cartogram of AICTE regions, not a map". No openly licensed boundary dataset with a stated Survey of India compliance could be confirmed in time, and the question being answered (value held, proof and overdue items by region) does not need boundaries.
- **Revisit if.** AICTE supplies an approved boundary dataset.

## D14. Amounts as integer paise; dates in IST display
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Choice.** `bigint` paise in storage, decimal strings in APIs, Indian grouping in UI. Avoids floating-point errors in money.

## D16. Valkey instead of Redis server
- **Date.** 24 Oct 2026. **Status.** Proposed.
- **Context.** arq needs a Redis-protocol server. The Redis server licence moved away from BSD in 2024 and changed again in 2025.
- **Alternatives.** Redis server (current licence), Valkey (Linux Foundation fork, BSD-3), KeyDB.
- **Choice.** Valkey 8 container. The code talks the Redis protocol, so the server can be swapped by changing the image.
- **Revisit if.** A managed service (ElastiCache) is adopted later; it supports Valkey.

## D19. asyncpg instead of psycopg for the async driver
- **Date.** 24 Oct 2026. **Status.** Accepted.
- **Context.** psycopg's async mode cannot run on the Windows Proactor event loop used by the development machine.
- **Choice.** asyncpg (Apache 2.0), which works on Windows and Linux.
- **Revisit if.** Never for this release.

## D20. Synthetic portfolio generator lives in the API package
- **Date.** 24 Oct 2026. **Status.** Accepted.
- **Context.** The plan placed it under `ml/synth`. The API seeds and resets demo data, so importing across packages inside containers would be fragile.
- **Choice.** `services/api/app/seed/portfolio.py`. The ML package keeps the document renderer and tamper generator.

## D21. Edits are made on the scan, not before printing
- **Date.** 24 Oct 2026. **Status.** Accepted.
- **Context.** Synthetic tampering could be applied before or after the print-scan simulation.
- **Choice.** After: a receipt is usually scanned, edited in software, re-saved and uploaded, which leaves noise and compression traces the model can learn. Clean samples are re-saved the same way so re-compression alone is not a cue.

## D22. Field-extractor features shared with the API
- **Date.** 24 Oct 2026. **Status.** Accepted.
- **Choice.** `services/api/app/services/documents/features.py` is the single source of token features; the training script imports it, so training and inference cannot drift.

## D15. Licensing of the repository
- **Date.** 24 Oct 2026. **Status.** Accepted (owner).
- **Context.** No licence file yet. Without one, all rights are reserved by default.
- **Choice.** All rights reserved; no LICENSE file.

## D17. Filesystem document storage in development
- **Date.** 24 Oct 2026. **Status.** Accepted.
- **Context.** The plan used MinIO locally. The `minio/minio` image is no longer pullable from Docker Hub.
- **Alternatives.** SeaweedFS or LocalStack as S3 emulators; a filesystem backend.
- **Choice.** A `Storage` interface with `LocalStorage` (files under `.data/storage`) and `S3Storage`. Deployment uses S3.
- **Trade-offs.** Pre-signed URLs are emulated locally by API-served signed links.
- **Revisit if.** S3-specific behaviour needs testing locally.

## D18. TypeScript 5.9 instead of 7.0
- **Date.** 24 Oct 2026. **Status.** Accepted.
- **Context.** TypeScript 7.0.2 is the latest, but compatibility of the native compiler with typescript-eslint and the TanStack Router plugin was not confirmed.
- **Choice.** Pin 5.9.3.
- **Revisit if.** After the submission.

## D23. Letter tokens: compact Ed25519 signature, state looked up live
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** A letter's QR code must verify offline-forgeable paper (R8), must reflect revocation and supersession after printing, and must scan easily from a phone.
- **Alternatives.** A JWT or JSON payload with the letter fields (long, dense QR, cannot show revocation without a lookup anyway); an unsigned random id (guessable ids would not be forgeable, but a signature lets anyone check authenticity against the published key).
- **Choice.** Token = `<key fingerprint>.<random letter id>.<base64url Ed25519 signature>`, about 120 characters. The verify page checks the signature, then reads the letter's current state. Public key at `/api/v1/public/letter-keys`. The private key comes from `LETTER_SIGNING_KEY_B64` (SSM in production); local runs generate one under `.data/keys`.
- **Trade-offs.** Verification needs the service online; the paper alone proves nothing without it.
- **Revisit if.** Offline verification is required (then embed signed key fields in the token).

## D24. Devanagari shaping in letters through ReportLab and HarfBuzz
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** ReportLab alone renders Devanagari conjuncts incorrectly. Letters must be bilingual.
- **Alternatives.** WeasyPrint (needs Pango and system libraries on the instance); pre-rendered images of the Hindi lines.
- **Choice.** ReportLab 5.1 with `uharfbuzz` and `shaping=1` on Hindi paragraph styles; Noto Sans Devanagari embedded. Checked visually on क्ष, त्ति and प्र.
- **Revisit if.** Shaping regressions appear in a ReportLab upgrade.

## D25. Release cases: one application per deposit type, discharge through the bank adapter
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** Clause 6.46 needs three clearances and an authority decision; the bank must discharge its lien.
- **Choice.** A case groups deposits of one type. PGRC cannot clear while complaints against the institution are open; it resolves them first. Authorisation is refused unless every condition passes, issues the NOC (or the sanction order for RTGS) and sends a discharge request through the same adapter as confirmations: network banks answer at once, desk banks answer from the bank desk. RTGS deposits are released by the sanction order itself.
- **Revisit if.** AICTE wants partial releases or penalties deducted from proceeds.

## D26. Registry served from a per-version in-process index
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** Under 20 concurrent users the registry spent most of each request reloading and post-processing every instrument row, so requests queued on one worker.
- **Choice.** Cache computed states per scope and date, the registry columns, and open-signal counts, keyed by the data version that every write bumps. Release applications and authorisations now bump the version too (they did not, which could leave statuses stale).
- **Trade-offs.** Memory grows with the portfolio (a few MB at 2,725 instruments); each worker keeps its own copy.
- **Revisit if.** The portfolio grows past about 100,000 instruments, or several API instances need a shared cache.

## D27. End-to-end tests run locally in the installed Chrome
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** The R16 scenarios need the full stack and real OCR; the automation token cannot change the CI workflow file.
- **Choice.** Playwright with `channel: 'chrome'` (no browser download), one worker, demo reset before each scenario. S3 (daily runs over simulated days) is tested at the API level, because the browser cannot advance the scheduler's clock.
- **Revisit if.** The owner adds an end-to-end job to CI.

## D28. Ledger accent darkened for small text
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** The accent (#b6531c) was used for small text such as as-of hints and chips but measured 4.46:1 on the canvas and 4.08:1 on its soft background.
- **Choice.** #a84c1a, the smallest change that meets 4.5:1 on surface, canvas and accent-soft. The contrast check now enforces the text ratio for accent.

## D29. Plain-language search: schema-constrained model with a rule fallback
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** Officers should be able to ask in plain English (F12); judges will ask how AI is used responsibly. Bedrock inference is blocked for the project's AWS account at the time of writing ("Operation not allowed" for every model, Anthropic and Amazon, in every region tried), pending action on the AWS side.
- **Choice.** Claude Haiku 4.5 through the India-resident `in.` inference profile, called with a forced tool whose input schema allows only the registry's real values; output is validated and invalid values are dropped. A deterministic parser handles the same job when the model is off or fails, and is the default (`BEDROCK_ENABLED=false`). The officer always sees the interpretation as removable chips, with any unrecognised terms listed, and applies it; only the typed sentence is sent to the model.
- **Evidence.** Rule parser: 100% exact match on the 60-query set (after fixing three misses it exposed) and 15 of 15 on a held-out set written afterwards and scored once (`docs/search-eval.json`). Both sets were written by the team.
- **Revisit if.** Bedrock access is granted; then run `scripts/search_eval.py --model` and compare.

## D30. Chart colours and a monthly river
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** The four assurance colours fail a categorical palette check (A2 and A3 are close greens; A0 is deliberately grey), and weekly maturities make a jagged river.
- **Choice.** The river stacks three bands (declared, document-checked, bank-confirmed) with dedicated `--chart-a*` tokens validated for both themes (the grey "nothing proven" band is a deliberate chroma exception), a 2 px surface gap between bands, a legend, a hover readout and a table view. The command view and forecast aggregate weeks into months; a click lists that month in the registry.

## D31. Synchronous analysis instead of server-sent events
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** `STEPS.md` Step 6 planned server-sent events to report when document analysis finishes. Measured analysis takes about 3.2 s per image and 2.7 s for a two-page PDF (`docs/perf-results.json`).
- **Choice.** Analysis stays synchronous inside the upload request, with a staged progress display in the wizard. SSE would add a long-lived connection per upload, proxy configuration in CloudFront and a reconnect path, for a wait that already ends in under 4 s. Revisit if the learned models make analysis slower than about 10 s.

## D32. Saved views and column choices stay in the browser
- **Date.** 25 Oct 2026. **Status.** Accepted.
- **Context.** Step 5 asked for saved registry views and a column chooser. Both are personal conveniences, not records.
- **Choice.** They are kept in the browser's local storage, keyed by the signed-in user for views. Every read and write is guarded, so a blocked or cleared store only loses the convenience. Nothing about them reaches the server or the audit trail. Bulk actions, by contrast, are server actions: each instrument is checked on its own, skipped with a reason when the action does not apply, and the run writes one audit entry plus an event per instrument.

## D33. One instance serves the web app, the API and a captured inbox
- **Date.** 26 Oct 2026. **Status.** Accepted.
- **Context.** `DEPLOYMENT.md` planned the web build on S3 behind CloudFront, documents in S3 and email through SES. A single-page app on S3 needs a path-rewrite function so deep links work without turning API 404s into the index page; SES in its sandbox rejects unverified recipients, and every recipient in the portfolio is synthetic.
- **Choice.** An nginx container on the instance serves the built web app and proxies `/api/`. In front of it, Caddy terminates HTTPS with a Let's Encrypt certificate for an `sslip.io` name that resolves to the Elastic IP (for example `13-204-48-202.sslip.io`), because CloudFront refuses new distributions until AWS Support verifies the account. Caddy adds a secret header that nginx requires, so only traffic through Caddy is served. The CloudFront variant is kept in the scripts (`EDGE=cloudfront`): one origin, only the hashed `/assets/*` cached, the same secret header, and a security group that admits only CloudFront's origin-facing addresses. Documents and letters stay on the instance's encrypted disk; the nightly backup copies both the database and the document store to S3, kept 14 days. Email goes to a Mailpit inbox shown at `/mail/` behind a generated password, so judges can see the reminders and notices without any message reaching a real address. The SES backend stays in the code (`EMAIL_BACKEND=ses`) for a deployment with verified recipients.
- **Cost.** One t4g.small (the account's Free plan refuses t4g.medium; D8 is superseded on size), 30 GB gp3 and an Elastic IP: about $15 a month in ap-south-1, within the remaining $95 of credit to January. On 2 GB the API runs one worker and loads the models at start-up, and the containers have memory limits sized from measured peaks (document analysis peaks near 1.1 GB).
