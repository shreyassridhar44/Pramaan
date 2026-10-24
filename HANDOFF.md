# Handoff

Summary for anyone picking up the project. The detailed, step-level log is `claude-code/HANDOFF.md`.

## Current state (24 October 2026)

- Problem statement captured and analysed.
- Domain, technical and competitor research complete (18 competitor repositories inspected).
- Product specification, architecture, UI specification and a 10-step plan written.
- Awaiting owner approval to begin implementation (Step 1).

## Key decisions so far

- Problem statement SIH26265, product name Pramaan.
- React SPA plus FastAPI monolith with workers; PostgreSQL and Redis; ONNX Runtime for ML inference.
- AWS: one t4g.medium in ap-south-1 with Docker Compose, static web on S3, CloudFront in front; about $21 to $24 per month.
- Bedrock (India-resident Claude Haiku 4.5) for plain-language search only.
- Edit-localisation model trained on the team's GPU machine using synthetic data.

## Next steps

1. Owner reviews and approves the specification and open questions in `claude-code/HANDOFF.md`.
2. Start Step 1 in `claude-code/STEPS.md`.
