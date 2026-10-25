# Pramaan

Security deposits and FDRs, proven at source.

Pramaan is a security deposit and Fixed Deposit Receipt (FDR) management system for the AICTE Regulation Bureau, built for Smart India Hackathon 2026, problem statement **SIH26265: Streamline of security deposit / FDR portal**.

It keeps one record of every deposit AICTE holds against a technical institution, shows for each value whether it was declared by the institution, read from the document, or confirmed by the issuing bank, watches every maturity and compliance deadline, and runs release cases through the clearances in the Approval Process Handbook to the competent authority, with a tamper-evident audit trail.

> **Status (25 October 2026):** Steps 1 to 8 of the plan are built and tested: intake with document checks, bank confirmation, monitoring, renewals, corrections, release with signed letters and public verification. See `claude-code/HANDOFF.md`.

## What it does

- **Single record per institution and instrument** with full lifecycle history, documents and renewal chains.
- **Field-level provenance**: declared, extracted and bank-confirmed values side by side, with a computed assurance level.
- **Document intelligence**: OCR field extraction, a trained model that highlights possibly altered regions, explainable classical checks, and duplicate detection across the portfolio.
- **Bank confirmation network (simulated in this prototype)**: signed confirmation messages from banks, verified on receipt.
- **Monitoring**: configurable reminders and escalations, penalty windows, matured-but-unclaimed deposits, and a forecast timeline that shows what will happen over the next months under current rules.
- **Release workflow** per APH Clause 6.46: eligibility checks, parallel clearances (PGRC, Vigilance, grants), NOC or sanction order, bank lien discharge.
- **Verifiable letters**: NOCs and notices carry signed QR codes that anyone can check on a public page.
- **Plain-language search** for officers, with the interpretation shown as editable filters.

## Documentation

| Document | Purpose |
|---|---|
| `PROBLEM_STATEMENT.md` | Official statement (verbatim) and requirement analysis |
| `RESEARCH.md` | Domain, technical and competitor research with sources |
| `PROJECT.md` | Product specification |
| `ARCHITECTURE.md` | System design, data model, APIs, deployment topology |
| `DATA_SOURCES.md` | Data used, how synthetic data is generated |
| `MODEL_CARD.md` | ML models, intended use, limits |
| `EVALUATION.md` | How models and the product are evaluated, and results |
| `PRIVACY.md`, `SECURITY.md` | Data protection and security controls |
| `THIRD_PARTY.md`, `VERSIONS.md` | Dependencies, licences, versions |
| `TESTING.md` | Test strategy and how to run tests |
| `DEPLOYMENT.md` | Local run and AWS deployment |
| `CONTRIBUTING.md`, `CHANGELOG.md`, `HANDOFF.md` | Working on the project |
| `claude-code/` | Implementation instructions, plan, decisions and logs |

## Quick start (local)

Prerequisites: Docker Desktop, [uv](https://docs.astral.sh/uv/) (Python 3.12 is installed by uv), Node.js 22, and Google Chrome for the end-to-end tests.

```bash
cp .env.example .env
docker compose -f infra/compose.dev.yml up -d          # Postgres, Valkey, Mailpit

cd services/api
uv sync
uv run alembic upgrade head
uv run python -m scripts.seed                          # 2,600 synthetic institutions, about 20 s
uv run uvicorn app.main:app --port 8000                # on Windows, run without --reload

cd apps/web                                            # in a second terminal
npm ci
npm run dev                                            # http://localhost:5173
```

Sign in with any demo persona on the sign-in page (password for all: `Pramaan@2026`). Emails sent by the monitoring run appear in Mailpit at http://localhost:8025.

Checks:

```bash
cd services/api && uv run ruff check . && uv run mypy app && uv run pytest -q
cd apps/web && npm run lint && npm run typecheck && npm test && npm run e2e
```

`npm run e2e` runs the R16 scenarios and an accessibility sweep in Chrome against the local stack; it resets the demo data first. Performance figures come from `uv run python -m scripts.perf_check` (see `TESTING.md`).

## Team

Built by the team for SIH 2026. Problem statement owner: AICTE, Regulation Bureau.

## Data notice

All institutions, deposits, banks and documents in this repository are synthetic. Bank names on document images are fictional. No real personal or financial data is used.
