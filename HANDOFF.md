# Handoff

Summary for anyone picking up the project. The detailed, step-level log is `claude-code/HANDOFF.md`.

## Current state (26 October 2026)

- Steps 1 to 9 built and re-audited; Step 10 in progress.
- Trained models (edit localiser, field extractor) are in the repository and active in the API; results in `EVALUATION.md` and `MODEL_CARD.md`.
- Deployment set (`infra/compose.yml`, production images) and AWS scripts (`infra/aws/`) built and tested locally.
- Tests: API 151 plus 4 slow OCR tests, web 23, Playwright 64.

## Key decisions so far

- Problem statement SIH26265, product name Pramaan.
- React SPA plus FastAPI monolith with workers; PostgreSQL and Redis; ONNX Runtime for ML inference.
- AWS: one t4g.small in ap-south-1 with Docker Compose serving the web app and API, CloudFront in front (DECISION D33); about $15 per month.
- Bedrock (India-resident Claude Haiku 4.5) for plain-language search only.
- Edit-localisation model trained on the team's GPU machine using synthetic data.

## Next steps

1. Deploy to AWS with `infra/aws/provision.sh` and `infra/aws/deploy.sh`; smoke test the public URL.
2. Demo script and recording; release tag `v1.0.0-sih`.
