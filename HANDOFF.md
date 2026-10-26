# Handoff

Summary for anyone picking up the project. The detailed, step-level log is `claude-code/HANDOFF.md`.

## Current state (27 October 2026)

- Steps 1 to 9 built and re-audited; Step 10 in progress.
- Trained models (edit localiser, field extractor) are in the repository and active in the API; results in `EVALUATION.md` and `MODEL_CARD.md`.
- Live at https://pramaan.duckdns.org (one t4g.small in ap-south-1, Docker Compose, Caddy with Let's Encrypt).
- Auto-deploy is on: the server deploys every new commit on `main` within about 2 minutes plus build time, whoever pushes it, and rolls back a release that fails `/readyz` (DECISION D35). `bash infra/aws/ops.sh autodeploy-log` shows the runs and the live release.
- Tests: API 151 plus 5 slow tests, web 23, Playwright 91 locally across Chrome, Firefox and WebKit.

- Redesign live (DECISION D36 to D39): security-print visual language, public home page, guided tour, UV lamp, tamper drill, legacy import (D37), reminder previews, deposit passport, dashboards drawn as instruments (D38). Under D39 one theme now holds everywhere, the command board shows a 13-week maturity runway, the rail never scrolls, and the letter preview works on the deployment. UI freeze 27 Oct, 23:00 IST.

## Key decisions so far

- Problem statement SIH26265, product name Pramaan.
- React SPA plus FastAPI monolith with workers; PostgreSQL and Redis; ONNX Runtime for ML inference.
- AWS: one t4g.small in ap-south-1 with Docker Compose serving the web app and API, HTTPS from Caddy (DECISION D33); about $15 per month.
- Bedrock (India-resident Claude Haiku 4.5) for plain-language search only.
- Edit-localisation model trained on the team's GPU machine using synthetic data.

## Next steps

1. Record the demo video (`docs/DEMO_SCRIPT.md`) and scan the QR code from a phone on mobile data.
2. Quality gates run, README quick start on a clean machine, release tag `v1.0.0-sih`.
