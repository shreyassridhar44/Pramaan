# CLAUDE.md: Rules for implementing Pramaan

Read this file first in every session. Then read `HANDOFF.md` (where we are), `STEPS.md` (what comes next), `PROTOTYPE.md` (how it must look), `DECISION.md` (why things are the way they are), and `QUALITY_GATES.md` (what "done" means).

## 1. Objective

Build Pramaan, the security deposit and FDR management system for SIH26265 (AICTE Regulation Bureau), as a complete, working product that a regulator could use, with exceptional UI and credible ML. It is evaluated by SIH judges through a PPT, a demo video and possibly a live demo. Deadline: idea submission by 28 October 2026; target the night of 27 October.

## 2. Order of work

1. Follow `STEPS.md` strictly in order. Do not start a step before the previous one meets its acceptance criteria.
2. At the start of a step, re-read the step, the relevant `PROTOTYPE.md` sections and `PROJECT.md` features.
3. At the end of a step: run the checks, update `HANDOFF.md`, `CHANGELOG.md`, and any document whose content changed, then commit.

## 3. Non-negotiable product rules

- Never present institution-submitted data as bank-confirmed. Declared, extracted and confirmed values are stored and shown separately.
- Never automate release, discharge, refund, forfeiture or penalties. The system prepares; an authorised human decides.
- Signals are review prompts. Wording must say "possible", "check", "mismatch"; never "forged" or "fraud".
- Every simulated component (bank network, bank desk, SMS, WhatsApp, AICTE data import) shows a visible "Simulated" label in the UI and is named as simulated in docs.
- Every metric shown in the UI or docs is computed by code in this repository and labelled with its data source (synthetic). Never hard-code a performance figure.
- Rules carry their APH clause reference and version; rule parameters live in the database, not in code constants.

## 4. Architecture rules

- Business rules live only in `services/api/app/domain/` as pure functions. The web app formats and validates input but never re-implements rules.
- The as-of engine is the only way to compute status for a date. The forecast screen calls the same engine as normal operation.
- All state changes go through the state machine and write an event and an audit entry in the same transaction.
- Authorisation: deny by default; every router uses the `require_role` and scope dependencies; list queries filter by scope in SQL.
- The web API client is generated from the FastAPI OpenAPI schema. Do not hand-write request types.
- Money is integer paise. Dates are ISO strings in APIs, UTC in the database, IST in the UI.
- No secrets in code or git. Use `.env` locally (from `.env.example`) and SSM Parameter Store in AWS.

## 5. Coding standards

**TypeScript.** Strict mode; no `any` without a comment explaining why; functional components; hooks for data via TanStack Query; colocate feature code under `src/features/<feature>`; components small and named for what they show; Tailwind classes via tokens only (no raw hex in components).

**Python.** 3.12; type hints everywhere; mypy strict on `app/domain`; ruff formatting and linting; Pydantic models for every request and response; SQLAlchemy 2 style; no business logic in routers.

**General.** Match the surrounding code's style and comment density. Comments explain why, not what. No dead code, no commented-out blocks, no TODOs without an issue reference in `HANDOFF.md`. Prefer small, focused modules over abstractions built for imagined futures.

## 6. UI and UX priorities

`PROTOTYPE.md` is binding. In order of priority:

1. Clarity of evidence (assurance, provenance) on every screen that shows an instrument.
2. Correct states: every data view has loading (skeleton), empty and error states.
3. Accessibility: keyboard, focus, contrast, reduced motion, labels.
4. Typography and spacing per tokens; Indian number formats via `formatINR`.
5. Motion only where `PROTOTYPE.md` Section 2.5 allows it.

Copy rules: plain, specific, professional English; no emoji; no em dashes; no marketing phrases; sentence case for labels; numbers with units; dates absolute with relative hints.

## 7. Testing requirements

- Unit tests for every rule function and every domain module.
- API integration tests for every endpoint, including role and scope denials.
- Web component tests for signature components; axe checks in component tests.
- End-to-end tests (Playwright) for the six R16 scenarios in `TEST_PLAN.md`.
- ML: determinism tests for generators, ONNX parity tests, evaluation scripts that write results to files referenced by `EVALUATION.md`.
- A step's checks must pass locally and in CI before committing the milestone.

## 8. Research requirements

- Before adding or upgrading a dependency, check its current version, licence and maintenance status, and record it in `VERSIONS.md` and `THIRD_PARTY.md`.
- When implementing a rule, cite the APH clause. If a rule is our assumption, mark it as such in the rule's metadata and in `PROJECT.md` Section 13.
- Log any new research in `RESEARCH_LOG.md` with date and source.

## 9. Security practices

Follow `SECURITY.md`. In particular: Argon2id passwords, httpOnly cookies, CSRF header, rate limits, parameterised queries only, file type and size validation on uploads, private object storage with signed URLs, audit every sensitive read, no personal data to the LLM.

## 10. Git workflow

- Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `build:`, `ci:`), imperative mood, scope where useful (`feat(api): ...`).
- Commit after each completed milestone once its checks pass. Keep commits focused.
- Author identity comes from the existing global Git configuration (Shreyas, shreyassridhar146@gmail.com). Do not add any AI tool as author, co-author or contributor. Do not add `Co-Authored-By` trailers.
- Push to `origin` (`https://github.com/shreyassridhar44/Pramaan.git`) after each milestone commit.
- Never rewrite published history; never force-push `main`.

## 11. Definition of done (per feature)

Meets its acceptance criteria; tests pass; loading, empty and error states exist; keyboard and contrast checks pass; documentation updated; `HANDOFF.md` updated; committed and pushed.

## 12. When unsure

Ask the owner when a decision changes scope, cost, data handling or what judges will see. For everything else, choose the option most consistent with these documents, record it in `DECISION.md`, and continue.
