# QUALITY_GATES.md

A milestone cannot be committed as complete unless every applicable gate passes.

## G1. Build and static checks
- Web: `npm run lint`, `npm run typecheck`, `npm run build` succeed with zero errors and zero warnings promoted to errors.
- API: `ruff check`, `ruff format --check`, `mypy app/domain` (strict) and `mypy app` succeed.

## G2. Tests
- All unit and integration tests pass.
- Rule functions: 100% line coverage. Domain package: at least 90%. API routers: every endpoint has at least one success and one denial test.
- E2E scenarios for completed features pass.

## G3. Product rules
- No declared value is ever written to a confirmed observation (test exists).
- No automatic release, penalty or forfeiture path exists (code search plus tests).
- Every simulated surface renders the simulated badge (component test).
- No hard-coded metric values in UI copy (code search for percentage literals in components).

## G4. UI quality
- Matches `PROTOTYPE.md` for the screens in scope; deviations recorded in `DECISION.md`.
- Loading, empty and error states present for each data view.
- axe: no serious or critical violations on the pages in scope.
- Keyboard walk-through completed for the pages in scope.
- Token contrast script passes for both themes.
- No emoji, no em dashes in UI copy (lint rule or grep).

## G5. Performance
- Registry (5,000 rows) interactive under 1.5 s on a mid-range laptop.
- API p95 under 300 ms for list endpoints with filters on seeded data.
- Initial JS for the officer app under 350 KB gzip; map and charts loaded lazily.

## G6. Security
- No secrets in the diff (secret scan).
- New endpoints have role and scope checks.
- Upload validation tests pass.
- `npm audit --omit=dev` and `pip-audit` report no high or critical issues without a recorded exception.

## G7. Documentation
- `HANDOFF.md`, `CHANGELOG.md` updated.
- Any changed behaviour reflected in `PROJECT.md`, `ARCHITECTURE.md`, `PROTOTYPE.md` or other affected documents.
- New dependencies recorded in `VERSIONS.md` and `THIRD_PARTY.md`.
