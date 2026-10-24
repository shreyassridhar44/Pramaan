# Changelog

All notable changes are recorded here. Format follows Keep a Changelog; versions follow Semantic Versioning.

## [Unreleased]

### Added
- Step 4 interface foundation: design tokens with Ledger and Command themes, base components, assurance ring, status and severity chips, global as-of control kept in the URL, command palette, application shell with role badge, sign-in page with live portfolio figures and demo personas, role-based route guards, and the first command view.

### Fixed
- Re-seeding now changes the data version, so cached portfolio figures refresh after a demo reset.
- Action queue ranks discrepancies, then the most recent overdue items, then upcoming maturities.
- Step 3 ML kit: synthetic FDR renderer with 12 fictional bank layouts, print-scan degradation, four tamper types with pixel masks, layout-split dataset builder with a held-out edit type, U-Net localiser training with built-in noise-residual filters and ONNX export with parity check, LightGBM field extractor with a rule baseline, evaluation scripts, and the API document pipeline (PDF and image intake, OCR, field extraction, learned and classical forensics, perceptual hashing). OCR-tolerant date parsing.
- Step 2 domain and data: pure domain core (provenance, assurance, state machine, APH rules for demand, deadlines, maturity, escalation, penalties and release, as-of engine with timeline); database schema and migrations; hash-chained audit with verification; session auth with CSRF, lockout and demo personas; role and region scoping; read APIs for portfolio, instruments, institutions and audit; synthetic portfolio generator and demo reset.
- Step 1 foundation: FastAPI skeleton with health and readiness endpoints, JSON logging and error envelope; React web app with design tokens, Indian formatting and typed API client; dev services in Docker Compose; CI workflow; contrast check; pre-commit hooks.
- Research, specification and implementation plan: `PROBLEM_STATEMENT.md`, `RESEARCH.md`, `PROJECT.md`, `ARCHITECTURE.md`, supporting documents and the `claude-code/` directory (24 October 2026).
