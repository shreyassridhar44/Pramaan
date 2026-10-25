# Versions

Latest versions checked on 24 October 2026 with `npm view` and `pip index versions`. Exact pins are set in `package.json`, `package-lock.json`, `pyproject.toml` and `uv.lock` during Step 1; this table is updated if a pin differs.

## Runtimes

| Runtime | Version |
|---|---|
| Node.js | 22 LTS or later (dev machine has 24.6.0) |
| Python | 3.12 in containers (dev machine has 3.13.2) |
| PostgreSQL | 16 |
| Valkey (Redis-compatible) | 8 |

## Web (latest on 24 Oct 2026)

| Package | Version |
|---|---|
| react | 19.3.1 |
| tailwindcss | 4.3.3 |
| motion | 14.6.0 |
| @tanstack/react-query | 5.104.5 |
| @tanstack/react-table | 9.3.1 |
| @tanstack/react-virtual | 3.14.22 |
| echarts | 6.1.0 |
| cmdk | 1.1.1 |
| zod | 4.6.7 |
| react-hook-form | 7.91.0 |
| lucide-react | 1.61.0 |
| sonner | 2.0.8 |
| vitest | 5.0.5 |
| @playwright/test, playwright-core | 1.63.0 (1.64.1 was under two weeks old on 25 Oct 2026) |
| @axe-core/playwright | 4.13.0 (4.14.0 was under two weeks old) |
| typescript | 5.9.3 (7.0.2 is latest; see DECISION D18) |

## API and ML (latest on 24 Oct 2026)

| Package | Version |
|---|---|
| fastapi | 0.162.0 |
| uvicorn | 0.54.0 |
| pydantic | 2.14.1 |
| sqlalchemy | 2.1.6 |
| alembic | 1.20.1 |
| asyncpg | 0.31 or later (resolved in uv.lock) |
| email-validator | 2.3.0 |
| arq | 0.28.0 |
| onnxruntime | 1.31.0 |
| rapidocr-onnxruntime | 1.2.3 (also `rapidocr` 3.10.0; choose in Step 3) |
| opencv-python-headless | 5.0.0.93 |
| scikit-learn | 1.9.1 |
| reportlab | 5.1.0 |
| uharfbuzz | 0.57.0 |
| cryptography | 50.0.2 |
| boto3 | 1.43.118 |
| pytest | 9.1.1 |
| httpx | 0.28.1 |
| torch (training only) | 2.14.1 |
| segmentation-models-pytorch (training only) | 0.5.0 |
