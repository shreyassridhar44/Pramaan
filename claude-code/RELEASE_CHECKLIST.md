# RELEASE_CHECKLIST.md

For the SIH submission release `v1.0.0-sih`.

## Product
- [x] All six R16 scenarios pass end to end on the deployed URL (64 of 64 Playwright tests with `E2E_BASE_URL`, 26 Oct 2026).
- [x] Demo data reset works (`POST /api/v1/demo/reset`, or `SEED=1 bash infra/aws/deploy.sh`).
- [ ] Every simulated surface is labelled.
- [x] All figures on the impact panel and in `EVALUATION.md` come from scripts, with dataset and model versions.
- [ ] Letters render correctly in Hindi and English; QR verification works from a phone on mobile data.

## Quality
- [ ] All gates in `QUALITY_GATES.md` pass.
- [ ] UX review completed and blockers resolved.
- [ ] Accessibility pass completed.

## Deployment
- [x] The public URL serves the web app over HTTPS (https://13-204-48-202.sslip.io, Let's Encrypt through Caddy; CloudFront needs AWS account verification, DECISION D33).
- [x] `/api/v1/readyz` reports all dependencies ready.
- [x] Security group allows only ports 80 and 443 (Caddy edge); no open SSH; access through Session Manager.
- [x] Secrets in SSM only; `.env` not committed.
- [x] Backup ran (database and document store to S3, nightly timer installed); restore drill done into a scratch database, row counts matched (26 Oct 2026).
- [x] AWS Budget set ($100 a month, existing account budget).

## Documentation
- [ ] README quick start verified on a clean machine.
- [ ] `CHANGELOG.md` has the release entry.
- [ ] `VERSIONS.md` and `THIRD_PARTY.md` match the lockfiles.
- [x] `MODEL_CARD.md` and `EVALUATION.md` contain measured results.
- [ ] `HANDOFF.md` reflects the final state.

## Submission assets
- [ ] Demo video recorded per `PROTOTYPE.md` Section 12, exported in 1080p and 1440p.
- [ ] PPT slides use screenshots from the deployed build.
- [ ] Git tag `v1.0.0-sih` pushed.
