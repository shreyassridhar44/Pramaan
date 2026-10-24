# Pramaan

Security deposits and FDRs, proven at source.

Pramaan is a security deposit and Fixed Deposit Receipt (FDR) management system for the AICTE Regulation Bureau, built for Smart India Hackathon 2026, problem statement **SIH26265: Streamline of security deposit / FDR portal**.

It keeps one record of every deposit AICTE holds against a technical institution, shows for each value whether it was declared by the institution, read from the document, or confirmed by the issuing bank, watches every maturity and compliance deadline, and runs release cases through the clearances in the Approval Process Handbook to the competent authority, with a tamper-evident audit trail.

> **Status (24 October 2026):** research and specification complete; implementation starts after owner approval. See `HANDOFF.md`.

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

Available after Step 1 of the implementation plan. The commands will be:

```bash
cp .env.example .env
docker compose -f infra/compose.dev.yml up -d
# API
cd services/api && uv sync && uv run alembic upgrade head && uv run python -m scripts.seed && uv run uvicorn app.main:app --reload
# Web
cd apps/web && npm install && npm run dev
```

## Team

Built by the team for SIH 2026. Problem statement owner: AICTE, Regulation Bureau.

## Data notice

All institutions, deposits, banks and documents in this repository are synthetic. Bank names on document images are fictional. No real personal or financial data is used.
