# RELEASE_CHECKLIST.md

For the SIH submission release `v1.0.0-sih`.

## Product
- [ ] All six R16 scenarios pass end to end on the deployed URL.
- [ ] Demo data reset works; each scenario can be loaded on demand.
- [ ] Every simulated surface is labelled.
- [ ] All figures on the impact panel and in `EVALUATION.md` come from scripts, with dataset and model versions.
- [ ] Letters render correctly in Hindi and English; QR verification works from a phone on mobile data.

## Quality
- [ ] All gates in `QUALITY_GATES.md` pass.
- [ ] UX review completed and blockers resolved.
- [ ] Accessibility pass completed.

## Deployment
- [ ] CloudFront URL serves the web app over HTTPS.
- [ ] `/api/v1/readyz` reports all dependencies ready.
- [ ] EC2 security group allows only CloudFront origin traffic; no open SSH.
- [ ] Secrets in SSM only; `.env` not committed.
- [ ] Nightly backup ran; restore drill done.
- [ ] AWS Budget alarms set.

## Documentation
- [ ] README quick start verified on a clean machine.
- [ ] `CHANGELOG.md` has the release entry.
- [ ] `VERSIONS.md` and `THIRD_PARTY.md` match the lockfiles.
- [ ] `MODEL_CARD.md` and `EVALUATION.md` contain measured results.
- [ ] `HANDOFF.md` reflects the final state.

## Submission assets
- [ ] Demo video recorded per `PROTOTYPE.md` Section 12, exported in 1080p and 1440p.
- [ ] PPT slides use screenshots from the deployed build.
- [ ] Git tag `v1.0.0-sih` pushed.
