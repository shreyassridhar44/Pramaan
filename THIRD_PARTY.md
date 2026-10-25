# Third-party components

Licences below are as published by each project and are re-verified when the dependency is added (see `claude-code/CLAUDE.md` Section 8). Items marked "to verify" must be checked before shipping.

## 1. Planned runtime dependencies

| Component | Use | Licence | Attribution needed |
|---|---|---|---|
| React, React DOM | Web UI | MIT | Licence notice in bundle |
| Vite | Build | MIT | No |
| TanStack Router, Query, Table, Virtual | Routing, data, tables | MIT | Licence notice |
| Tailwind CSS | Styling | MIT | Licence notice |
| Radix UI primitives | Accessible components | MIT | Licence notice |
| Motion | Animation | MIT | Licence notice |
| Apache ECharts | Charts | Apache 2.0 | Notice file |
| MapLibre GL JS | Map rendering | BSD-3-Clause | Notice |
| cmdk | Command palette | MIT | Notice |
| Lucide icons | Icons | ISC | Notice |
| Sonner | Toasts | MIT | Notice |
| FastAPI, Starlette | API | MIT, BSD-3-Clause | Notice |
| Pydantic | Validation | MIT | Notice |
| SQLAlchemy, Alembic | Database | MIT | Notice |
| asyncpg | Postgres driver | Apache 2.0 | Notice |
| itsdangerous | Signed session cookies | BSD-3-Clause | Notice |
| email-validator | Email validation | Unlicense | No |
| hypothesis (dev) | Property tests | MPL-2.0 | Not shipped |
| arq | Job queue | MIT | Notice |
| Valkey (Redis-compatible server) | Cache and queue | BSD-3-Clause | Notice. Chosen over Redis server, whose licence changed in 2024 and 2025 (see `claude-code/DECISION.md` D16) |
| PostgreSQL | Database | PostgreSQL Licence | Notice |
| ONNX Runtime | Inference | MIT | Notice |
| rapidocr-onnxruntime and bundled PP-OCR models | OCR | Apache 2.0 (package and PaddleOCR models) | Notice |
| pypdfium2 | PDF page rendering | Apache 2.0 / BSD-3 | Notice |
| Pillow | Image I/O and synthetic rendering | MIT-CMU (HPND) | Notice |
| NumPy | Arrays | BSD-3-Clause | Notice |
| LightGBM | Field extractor | MIT | Notice |
| scikit-learn | Anomaly model | BSD-3-Clause | Notice |
| OpenCV (headless) | Image processing | Apache 2.0 | Notice |
| pypdfium2 and PDFium | PDF rendering | Apache 2.0 or BSD-3 (pypdfium2), BSD-3 (PDFium) | Notice |
| ReportLab | PDF generation and letter QR codes | BSD | Notice |
| uharfbuzz and HarfBuzz | Devanagari text shaping in letters | Apache 2.0 (uharfbuzz), MIT (HarfBuzz) | Notice |
| cryptography | Ed25519, hashing | Apache 2.0 or BSD | Notice |
| argon2-cffi | Password hashing | MIT | Notice |
| tzdata | IANA time zone data (Windows and slim images) | Apache 2.0 | Notice |
| boto3 | AWS SDK | Apache 2.0 | Notice |
| Caddy | Reverse proxy on the instance | Apache 2.0 | Notice |

## 1a. Development and test tools (not shipped)

| Component | Use | Licence |
|---|---|---|
| Playwright (`@playwright/test`, `playwright-core`) | End-to-end tests in the installed Chrome | Apache 2.0 |
| axe-core and `@axe-core/playwright` | Accessibility checks in component and end-to-end tests | MPL 2.0 |
| Vitest, Testing Library | Unit and component tests | MIT |

## 2. Training-only dependencies (GPU machine, not shipped)

| Component | Licence |
|---|---|
| PyTorch | BSD-3-Clause |
| segmentation-models-pytorch | MIT |
| EfficientNet-B0 ImageNet weights (efficientnet-pytorch, via segmentation-models-pytorch) | Apache 2.0 |
| ONNX | Apache 2.0 |
| tqdm | MPL-2.0 and MIT |
| (no augmentation library; augmentations are implemented with OpenCV) | |

## 3. Explicitly excluded

| Component | Reason |
|---|---|
| PyMuPDF | AGPL-3.0 would impose source-distribution obligations on the whole service |
| Mapbox GL JS v2 and later | Proprietary licence and token requirement |
| Highcharts | Commercial licence |
| Forensics weights with non-commercial licences | Not suitable for a government product |

## 4. Fonts

Synthetic FDR documents (training data only) use OFL fonts from google/fonts, downloaded by `ml/synth/fonts.py`: Noto Serif, Source Serif 4, PT Serif, IBM Plex Sans and Mono, Open Sans, Lato, Courier Prime, Inconsolata, Roboto Mono (Apache 2.0), PT Mono, Noto Sans Devanagari.

Web application fonts:

| Font | Licence | Source |
|---|---|---|
| Geist Sans, Geist Mono | SIL Open Font License 1.1 | Vercel |
| Instrument Serif | SIL Open Font License 1.1 | Google Fonts |
| Noto Sans Devanagari | SIL Open Font License 1.1 | Google Fonts |

Fonts are self-hosted from the build, not loaded from a CDN at runtime.

Letter PDFs embed Noto Sans, Noto Sans Devanagari and Instrument Serif (all SIL Open Font License 1.1). The font files and their licence texts are in `services/api/app/assets/fonts/`.

## 5. Data and maps

| Asset | Licence | Notes |
|---|---|---|
| India boundary data | to verify | Must follow Survey of India boundaries (see `claude-code/DECISION.md` D13) |
| Base map tiles | to verify | Prefer a self-hosted minimal style without third-party tiles |

## 6. AI services

| Service | Terms |
|---|---|
| Amazon Bedrock, Anthropic Claude Haiku 4.5 | AWS Service Terms and the model provider's acceptable use policy |
