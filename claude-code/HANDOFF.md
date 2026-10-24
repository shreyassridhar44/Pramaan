# HANDOFF.md: Implementation log

Update this file at the end of every working session and every completed step.

## Status

| Step | Name | State | Commit |
|---|---|---|---|
| 0 | Research and specification | Done, awaiting owner approval | docs commit (24 Oct 2026) |
| 1 | Foundation and tooling | In progress: API skeleton, dev compose, web skeleton done; CI, contrast script, pre-commit pending | see git log |
| 2 | Domain model, rules, synthetic portfolio | Not started | |
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
1. Finish Step 1: `.github/workflows/ci.yml`, `scripts/check-contrast.mjs`, pre-commit config; then Step 2.
   Notes: MinIO image is no longer on Docker Hub, so local storage uses the filesystem (record as D17); TypeScript pinned to 5.9.3; in Git Bash add `C:\Program Files\Docker\Dockeresourcesin` to PATH for docker pulls.
2. Immediately after Step 2: hand the ML kit (Step 3) to the owner for GPU training.
