# HANDOFF.md: Implementation log

Update this file at the end of every working session and every completed step.

## Status

| Step | Name | State | Commit |
|---|---|---|---|
| 0 | Research and specification | Done, awaiting owner approval | docs commit (24 Oct 2026) |
| 1 | Foundation and tooling | Done (API 2 tests, web 12 tests, lint, types, contrast) | see git log |
| 2 | Domain model, rules, synthetic portfolio | Done (81 API tests; seed 2,600 institutions in about 25 s) | see git log |
| 3 | ML kit | Not started | |
| 4 | Design system and shell | Not started | |
| 5 | Registry, detail, institutions | Not started | |
| 6 | Intake and document intelligence | Not started | |
| 7 | Bank network, monitoring, notifications | Not started | |
| 8 | Release, letters, verification | Not started | |
| 9 | Command view, forecast, search, reports | Not started | |
| 10 | Hardening, evaluation, deployment, demo | Not started | |

## Session log

### 24 October 2026: research and specification
- Captured SIH26265 verbatim; itemised requirements R1 to R16 and constraints C1 to C7.
- Read APH 2024-2027 and extracted the security deposit rules.
- Inspected 18 competitor repositories (clones, git history, code, tests, deployments).
- Wrote all root documents and this directory.
- Owner decisions recorded: name Pramaan; GPU available for training; Bedrock Claude for search; AWS budget $100 to last until January (lean single-instance deployment chosen).

## Changed files
- All documentation files at the root and in `claude-code/`.

## Test results
- None yet (no code).

## Known issues
- None.

## Unresolved questions for the owner
1. Approval of the specification, design direction and plan (required before Step 1).
2. Repository licence: keep all rights reserved, or choose an open licence (D15).
3. Team name and member names for the sign-in page footer, letters and the demo video credits.
4. GPU machine details (GPU model and VRAM) to size the training batch and dataset.
5. Whether the AWS account may send email through SES to team members' addresses (needs identity verification of each recipient while in the SES sandbox).

## Exact next steps
1. Step 3: ML kit (FDR renderer, tamper generator, training scripts for the RTX 4090, ONNX export, baseline inference in the worker).
2. Then Step 4: design system and shell.

Notes from Step 2:
- Seed: `cd services/api && uv run python -m scripts.seed` (anchor defaults to today). Demo password for every persona: `Pramaan@2026`.
- Statuses and assurance are always computed by `app.domain.asof`; the stored `status` column is the value on the seeding date and is informational.
- Tests use database `pramaan_test` (created automatically).
- In Git Bash, prepend `/c/Program Files/Docker/Docker/resources/bin` to PATH for docker pulls.
