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

| ID | Scenario | Test |
|---|---|---|
| S1 | New FDR submission | `apps/web/e2e/s1-s5-intake.spec.ts` (wizard with the genuine specimen, officer queue, A1) |
| S2 | Validity tracking | `apps/web/e2e/s2-s4-lifecycle.spec.ts` (detail and registry agree on active, maturing and matured as the as-of date moves) |
| S3 | Approaching maturity | `services/api/tests/test_lifecycle.py`: reminders at T-90, T-60, T-30, T-15, T-7 and T-0 exactly once across simulated daily runs; escalation climbs dealing officer, section head, deputy director, director. Simulated days are not driven through the browser, so S3 is tested at the API level |
| S4 | Renewal | `apps/web/e2e/s2-s4-lifecycle.spec.ts` (renewal wizard, bank desk confirmation, A2, verify, predecessor renewed) |
| S5 | Discrepancy identification | `apps/web/e2e/s1-s5-intake.spec.ts` (altered specimen, figures against words signal, bank disagrees on amount, A0, return with deficiency letter) |
| S6 | Authorised release processing | `apps/web/e2e/s6-release.spec.ts` (PGRC resolves and clears, only the authority issues the NOC, phone-sized context verifies Genuine, revoke shows Revoked, altered token shows Not recognised) |

Also end to end: observations and corrections (R10), region scope for a regional officer (R13), axe on every route in both themes (`a11y.spec.ts`), and the registry interactive within 1.5 s (`perf.spec.ts`).

## 3. Running tests

```bash
# API and domain (slow OCR tests included; add -m "not slow" to skip them)
cd services/api && uv run pytest -q
# Web unit and component tests, with axe on signature components
cd apps/web && npm test
# End to end: starts or reuses the API and web dev servers, resets the demo data first
cd apps/web && npm run e2e
# Performance targets (API running on :8000); --seed also times a full reseed
cd services/api && uv run python -m scripts.perf_check --seed
```

End-to-end tests use the installed Google Chrome (`channel: 'chrome'`), so no browser download is needed.

## 4. Continuous integration

GitHub Actions runs lint, formatting, type checks, unit and integration tests (including the slow OCR tests), the contrast check and the web build on every push. The end-to-end suite runs locally; adding it to CI needs a change to `.github/workflows/ci.yml` that must be pushed with a token that has the `workflow` scope.

## 5. Results (25 October 2026)

| Suite | Result |
|---|---|
| API and domain (pytest) | 129 passed |
| Web unit and component (Vitest) | 23 passed |
| End to end (Playwright) | 43 passed: 7 scenario and behaviour tests, 35 accessibility checks (17 routes in two themes, and the verify page), 1 timing test |
| Contrast check | All token pairs pass in both themes |

Performance, measured on the development laptop (single API worker, Postgres in Docker) by `scripts/perf_check.py`; raw figures in `docs/perf-results.json`:

| Target (source) | Measured | Target |
|---|---|---|
| Seed 2,600 institutions (Step 2) | 16.4 s | under 60 s |
| Portfolio summary p95 (Step 2) | 90 ms today, 61 ms for a past date | under 300 ms |
| Registry interactive (Step 5) | 573 ms to first rows in the browser | under 1.5 s |
| Registry API, first page of 100 | p95 90 ms | |
| Registry API, page of 500 rows | p95 271 ms | |
| Document analysis (Step 6) | 3.2 s per receipt image, 2.7 s for a two-page PDF | under 15 s |
| 20 officers browsing, 1 to 3 s between clicks (TEST_PLAN 4) | p95 245 ms over 586 requests | under 300 ms |
| 20 clients with no pause (saturation, for information) | p95 1.25 s, about 24 requests per second on one worker | none set |

Fresh clone to a running API and a production web build took about 4 minutes on this machine with package caches warm (Step 1 target: under 10 minutes following the README).
