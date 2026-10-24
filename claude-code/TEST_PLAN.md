# TEST_PLAN.md

## 1. Traceability: official requirements to tests

| Requirement | Tests |
|---|---|
| R1 records | API: instrument and institution CRUD via state machine; E2E S1 |
| R2 documents | API: upload validation, storage, retrieval, audit of views; E2E S1 |
| R3 verification and discrepancies | Worker: analysis pipeline; API: signals; E2E S5 |
| R4 submitted versus confirmed | Domain: provenance never copies declared to confirmed; API: observations by source; component: ProvenanceGrid |
| R5 monitoring | Domain: as-of engine, maturity rules; E2E S2, S3 |
| R6 reminders and overdue flags | Worker: rule run idempotency; E2E S3 |
| R7 renewal history | Domain: renewal chain; E2E S4 |
| R8 release workflow | Domain: release eligibility; API: authorisation roles; E2E S6 |
| R9 dashboard | API: portfolio summary reconciliation with registry; web: command view states |
| R10 search, history, observations | API: filters and scopes; E2E: observation and correction |
| R11 reports | API: report totals reconcile |
| R12 alerts and escalation | Domain: escalation levels; worker: notifications |
| R13 security and audit | API: RBAC denial matrix; audit chain tamper test; upload security tests |
| R14 integration readiness | Adapter contract tests (simulated network, bank desk); OpenAPI schema test |
| R15 measurable improvement | API: impact metrics computed from events; unit tests for each formula |
| R16 six scenarios | E2E S1 to S6 below |

## 2. End-to-end scenarios

### S1. New FDR submission
Given an institution with an open demand, when the institution user completes the wizard with a genuine scan and Affidavit 3, then the instrument is `submitted`, extraction matches declarations, assurance is A1, and it appears in the officer queue.

### S2. Validity tracking
Given an active instrument, when the as-of date moves through its life, then its status follows `active`, `maturing`, `matured` at the configured offsets, and the registry and command view agree for each date.

### S3. Approaching maturity
Given an instrument 95 days from maturity, when the daily rule run executes on each simulated day up to T-0, then reminders are sent at T-90, T-60, T-30, T-15, T-7, T-0 exactly once each, and an escalation is raised at the configured overdue level.

### S4. Renewal
Given a matured instrument with auto-renew unconfirmed, when the institution submits a renewed instrument linked to it and the bank confirms, then the successor is `active` at A2 and the predecessor is `renewed`, with both shown in one chain.

### S5. Discrepancy identification
Given a scan whose amount was altered, when it is submitted, then the analysis raises a high-severity signal with a heatmap over the amount; when the bank confirms a different amount, then a conflict is shown on the amount field, assurance is A0, and a deficiency letter can be issued.

### S6. Authorised release processing
Given a matured instrument and an open PGRC complaint, when the institution applies for release, then the case is blocked with the PGRC reason; when PGRC, Vigilance and Grants clear, then only an authorised role can issue the NOC; the NOC QR verifies as Genuine on the public page; the bank discharge sets the instrument to `released`.

## 3. Role and scope denial matrix (excerpt)

| Role | Must be denied |
|---|---|
| Institution user | Other institutions' instruments, documents, letters; officer endpoints; admin |
| Regional officer (Western) | Instruments outside the Western region (list and detail) |
| Clearance cell officer | Authorising NOC; editing instruments |
| Bank officer | Anything outside requests addressed to their bank |
| Auditor | Every write endpoint |

## 4. Non-functional checks
- Load: 20 concurrent users browsing the registry and detail pages for 5 minutes; p95 under 300 ms for list endpoints.
- Accessibility: axe on every route; manual keyboard walk-through of S1 and S6.
- Resilience: worker restart during analysis resumes the job; API restart keeps sessions.
- Backup: restore last night's dump into a fresh database and run the smoke test.
