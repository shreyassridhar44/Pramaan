# Pramaan

Security deposits and Fixed Deposit Receipts (FDRs), proven at source. One record of every
deposit AICTE holds against a technical institution, with each value shown as declared by the
institution, read from the document, or confirmed by the issuing bank.

**Live:** https://pramaan.duckdns.org

Built for Smart India Hackathon 2026, problem statement SIH26265, Streamline of security
deposit / FDR portal, for the AICTE Regulation Bureau.

## What you see

The public home page explains what Pramaan does and offers a guided tour. Sign in as any of the
demo personas on the sign-in page; the password for all of them is `Pramaan@2026`. Each persona
sees only what its role and scope allow.

| Surface | Who uses it | What it does |
| --- | --- | --- |
| Command centre | Bureau officers, directors | The portfolio at a glance: a maturity clock and a 13-week runway, how much of the value held is proven, regions as a tile cartogram, the largest unproven exposures and the day's docket |
| Registry | Officers | Every instrument, filtered from the address bar or by a plain-language search shown as editable chips, and exported to CSV |
| Instrument detail | Officers | Declared, extracted and bank-confirmed values side by side with a character diff, the assurance level, signals, key dates, the reminder ladder, the renewal chain and the audit trail |
| Verification queue | Officers | New submissions triaged by severity, each with the document, its heatmap and the checks it raised |
| Alerts | Officers | Reminders and escalations by days overdue, with a preview of each message before it is sent |
| Releases | Officers, cells, the competent authority | Release cases per APH Clause 6.46, with PGRC, Vigilance and Grants clearing in parallel and the NOC or sanction order issued only when every condition passes |
| Forecast | Officers | What will happen over the coming months under the current rules, played week by week on the map |
| Reports and audit | Officers, Internal Audit | Eight reports in CSV and PDF that reconcile with the command centre, and a hash-chained audit log that can be checked end to end |
| Institution portal | Institutions | Submit a new FDR or a renewal in four steps, apply for release, and download letters |
| Bank desk | A bank officer (simulated) | Confirm or dispute a deposit and discharge a lien; every answer is a signed message |
| Verify page | Anyone | Scan the QR on a letter to see whether it is Genuine, Superseded, Revoked or Not recognised |

The administrator persona also manages versioned rules, imports a legacy register row by row,
and resets the demo data.

Every institution, deposit, bank and document is synthetic. Banks on document images are
fictional, and every specimen carries a "SYNTHETIC SPECIMEN" watermark.

## Run it on your own machine

You need Docker, [uv](https://docs.astral.sh/uv/) (it installs Python 3.12), Node.js 22 and,
for the end-to-end tests, Google Chrome.

```sh
cp .env.example .env
docker compose -f infra/compose.dev.yml up -d   # Postgres, Valkey and Mailpit

cd services/api
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed                   # 2,600 synthetic institutions, about 20 s
uv run uvicorn app.main:app --port 8000         # on Windows, run without --reload
```

In a second terminal:

```sh
cd apps/web
npm ci
npm run dev                                     # http://localhost:5173
```

Then open http://localhost:5173/. Email sent by the monitoring run lands in Mailpit at
http://localhost:8025. The background worker (daily monitoring and the outbox) runs with
`uv run arq app.workers.settings.WorkerSettings` from `services/api`.

The trained models are in `ml/models/` and load when the API starts. Without them, document
analysis falls back to the classical checks and `/api/v1/readyz` reports `degraded`.

### Keys and settings

`.env.example` lists every setting with a working local default. `.env` is gitignored.

| Variable | What it does |
| --- | --- |
| `SESSION_SECRET` | Signs session cookies; set a long random value anywhere but your own machine |
| `DEMO_MODE` | Turns on the personas, the demo reset and the scenario endpoints |
| `STORAGE_BACKEND` | `local` keeps documents under `.data/storage`; `s3` uses `STORAGE_BUCKET` |
| `LETTER_SIGNING_KEY_B64` | The Ed25519 key that signs letter QR codes; left empty, one is generated once under `.data/keys` |
| `PUBLIC_BASE_URL` | Where the verify page lives, so the QR codes point at it |
| `EMAIL_BACKEND` | `smtp` sends to Mailpit locally; the deployment can use Amazon SES |
| `BEDROCK_ENABLED` | Sends plain-language search to Claude Haiku 4.5 on Bedrock; off, a rule parser does the same job |

In the deployment the secrets come from AWS Systems Manager Parameter Store, never from git.

## How it is built

```
apps/web          React 19, TypeScript, Vite, TanStack Router and Query, Tailwind v4, ECharts:
                  the officer app, the institution portal, the bank desk and the verify page
services/api      FastAPI, SQLAlchemy 2 and Alembic on PostgreSQL 16, with arq workers on Valkey
  app/domain      the rules as pure functions: state machine, assurance, deadlines, penalties,
                  release eligibility, the as-of engine
  app/adapters    the simulated bank network, the bank desk, storage, email and the model call
ml                synthetic FDRs and tampering, training, evaluation and ONNX export
infra             Docker Compose, nginx and Caddy, and the AWS scripts
scripts           the contrast check for the design tokens
```

All business rules live in `services/api/app/domain/` with no I/O, so the forecast runs exactly
the production logic on future dates. The web client's types are generated from the API's
OpenAPI schema, so the two cannot drift.

Document analysis runs on the CPU: RapidOCR reads the page, a LightGBM model assigns the words
to fields, a U-Net marks regions that may have been edited, and classical checks compare
figures against words, the document against the declaration, and the receipt against every
other one in the portfolio.

## Standards

Rule parameters follow the AICTE Approval Process Handbook 2024-2027: the Table 1.4 deposit
amounts, terms, penalty windows and the Clause 6.46 release clearances, each stored as a
versioned, dated rule. The interface targets WCAG 2.2 AA and is checked with axe on every route
in both themes.

Four rules are enforced in code rather than by convention:

- A model never changes state. A mark on a document is a signal, and an officer confirms or
  dismisses it with a reason that is audited. No model output rejects a document, imposes a
  penalty or refuses a release.
- An extracted value never overwrites a declared or confirmed one; all three are kept, and the
  assurance level is computed from how they agree.
- A bank message is used only after its Ed25519 signature is verified against the bank's
  published key. A tampered response is rejected and raises a signal.
- Every audit entry carries the SHA-256 of the entry before it, so a changed or deleted entry
  breaks the chain where it happened.

## Checking it

```sh
cd services/api && uv run ruff check . && uv run mypy app && uv run pytest -q
cd apps/web && npm run lint && npm run typecheck && npm test && npm run e2e
```

`npm run e2e` runs the six scenarios from the problem statement (new submission, validity
tracking, approaching maturity, renewal, discrepancy and release) and an accessibility sweep in
Chrome against the local stack, and resets the demo data first. Performance figures come from
`uv run python -m scripts.perf_check` with the API running. GitHub Actions runs everything except
the end-to-end suite on every push.

## Deploying

The live site is one EC2 instance in ap-south-1 running `infra/compose.yml`: Postgres, Valkey,
the API, the worker, Mailpit, nginx and Caddy for HTTPS. `infra/aws/provision.sh` creates the
instance, bucket, role and secrets, and `infra/aws/deploy.sh` ships the committed `HEAD`. Once
`infra/aws/enable-autodeploy.sh` has run, every push to `main` is deployed within a few minutes,
and a release that fails its health check is rolled back. Postgres is backed up nightly to S3.

## Results so far

Every figure is on synthetic documents and is written by a script, not by hand.

- **Edit localiser:** image-level ROC AUC 0.944 on 3,000 test images from two bank layouts it
  never saw. The edit types it was trained on are found on every edited image; a field spliced
  from another receipt, held out of training, is the weak spot.
- **Field extractor:** 98.6% exact match per field on 300 receipts from unseen layouts, against
  98.3% for the rule baseline.
- **Plain-language search:** the rule parser reads 60 of 60 queries and 15 of 15 held out.
- **Speed:** the registry shows its first rows in 573 ms, a receipt is analysed in about 3 s,
  and a 52-week forecast takes 1.6 s cold.

## What is not done, or not measured

- The bank network is simulated. Bank responses are real signed messages, but no bank sends
  them, and the Account Aggregator adapter is an interface only.
- The models are trained and tested only on synthetic receipts. Real scans and phone photos
  have not been tried.
- Plain-language search through Bedrock is built but unmeasured: model inference is blocked for
  the project's AWS account, so the live site uses the rule parser.
- The portfolio anomaly model was planned and not built; the rules and the document, declaration
  and bank checks raise the same prompts.
- The end-to-end suite runs in Chrome and Firefox, not WebKit, and is not in CI.
- On the live instance (2 GB of memory, one API worker) a receipt takes several seconds longer
  to analyse than on a laptop.

## Sources and rights

The rules come from the AICTE Approval Process Handbook 2024-2027 and the problem statement on
the SIH 2026 portal, both used as reference. Regions come from AICTE's public list of regional
offices. Everything else, from institutions and deposits to bank layouts and edits, is generated
by the code in `services/api/app/seed/` and `ml/synth/`, deterministically by seed. No real
institution, bank account, receipt or personal data is used.

No licence has been chosen for this repository's code yet, so all rights are reserved.
