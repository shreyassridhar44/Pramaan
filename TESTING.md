# Testing

Detailed cases and the traceability matrix are in `claude-code/TEST_PLAN.md`. This file describes the strategy and how to run tests.

## 1. Layers

| Layer | Tooling | Scope |
|---|---|---|
| Domain unit tests | pytest, hypothesis | Every rule, state transition, assurance computation, provenance comparison, as-of engine |
| API integration tests | pytest, httpx, a disposable Postgres | Every endpoint, roles and scopes, error cases |
| Worker tests | pytest with fake adapters | Document pipeline, bank dispatch and signature checks, rule runs, notifications |
| ML tests | pytest | Generator determinism, mask alignment, ONNX parity, evaluation script outputs |
| Web unit and component tests | Vitest, Testing Library, axe-core | Formatters, signature components, keyboard behaviour, accessibility |
| End-to-end | Playwright | The six R16 scenarios and the demo script |
| Non-functional | k6 or Locust (light), Lighthouse | Registry and timeline performance; accessibility and best-practice scores |

## 2. The six official scenarios (R16)

| ID | Scenario | E2E test |
|---|---|---|
| S1 | New FDR submission | `e2e/s1-new-submission.spec.ts` |
| S2 | Validity tracking | `e2e/s2-validity-tracking.spec.ts` |
| S3 | Approaching maturity | `e2e/s3-approaching-maturity.spec.ts` |
| S4 | Renewal | `e2e/s4-renewal.spec.ts` |
| S5 | Discrepancy identification | `e2e/s5-discrepancy.spec.ts` |
| S6 | Authorised release processing | `e2e/s6-release.spec.ts` |

## 3. Running tests

Available from Step 1:

```bash
# API and domain
cd services/api && uv run pytest
# Web
cd apps/web && npm test
# End to end (stack running)
cd apps/web && npx playwright test
```

## 4. Continuous integration

GitHub Actions runs lint, type checks, unit and integration tests, and the web build on every push. E2E runs on pushes to `main` against a Compose stack.

## 5. Results

Test results per milestone are recorded in `claude-code/HANDOFF.md`.
