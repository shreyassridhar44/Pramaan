# Changelog

All notable changes are recorded here. Format follows Keep a Changelog; versions follow Semantic Versioning.

## [Unreleased]

### Added
- Step 2 domain and data: pure domain core (provenance, assurance, state machine, APH rules for demand, deadlines, maturity, escalation, penalties and release, as-of engine with timeline); database schema and migrations; hash-chained audit with verification; session auth with CSRF, lockout and demo personas; role and region scoping; read APIs for portfolio, instruments, institutions and audit; synthetic portfolio generator and demo reset.
- Step 1 foundation: FastAPI skeleton with health and readiness endpoints, JSON logging and error envelope; React web app with design tokens, Indian formatting and typed API client; dev services in Docker Compose; CI workflow; contrast check; pre-commit hooks.
- Research, specification and implementation plan: `PROBLEM_STATEMENT.md`, `RESEARCH.md`, `PROJECT.md`, `ARCHITECTURE.md`, supporting documents and the `claude-code/` directory (24 October 2026).
