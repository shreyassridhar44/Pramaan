# RESEARCH_LOG.md

Chronological log of research actions. Findings are summarised in `RESEARCH.md`.

## 24 October 2026

| Time (IST, approx.) | Action | Result |
|---|---|---|
| 11:58 | Downloaded https://sih.gov.in/sih2026PS (3.1 MB HTML) and parsed the five AICTE statements | SIH26261 to SIH26265 captured; counters 31, 27, 27, 35, 16 |
| 12:10 | Downloaded `data/submission-history.csv` from Zaidusyy/sih-2026-problem-statements | Daily counts 20 to 23 Oct; late-batch final counts 160 to 300 for software |
| 12:20 | GitHub repository search across PS IDs and keywords; 1,383 candidate repositories; 864 READMEs fetched | About 135 relevant across the five statements; 12 for SIH26265 in the morning |
| 14:45 | Refreshed SIH26265 search (13 queries) | 18 confirmed repositories; name clash found with `Abhay18570/NidhiSetu` |
| 14:50 | Cloned all 18 repositories; computed commits, authors, LOC, dependencies, test counts | Table in `RESEARCH.md` 5.2 |
| 14:59 | Headless Chrome screenshots of 8 deployed competitor URLs | UI review in `RESEARCH.md` 5.5; screenshots kept outside the repo |
| 15:00 | Downloaded APH 2024-2027 (231 pages), extracted text | Clauses 1.12, 2.20 d, 2.21 h and i, 6.46, 7.7, Table 1.4, Affidavits 3, 4, 6, Certificate 3 |
| 15:05 | Web searches: Account Aggregator TD FI type; NeSL e-BG; SFMS IFN 760; RBI deposit directions | Verification channel table in `RESEARCH.md` 2.3 |
| 15:08 | Web searches: fake FDR cases | DUSIB Rs 207 crore, Delhi forest Rs 223 crore, Chandigarh Smart City Rs 116 crore, Lucknow railway tenders |
| 15:10 | Web searches: OCR comparisons; TruFor; CAT-Net; DocForge-Bench; scanned-document forensics | `RESEARCH.md` 3.1 and 3.2 |
| 15:12 | AWS Pricing API (ap-south-1) for t4g.small, t4g.medium, t4g.large, t3.medium | 0.0112, 0.0224, 0.0448, 0.0448 USD per hour |
| 15:12 | Bedrock `ListFoundationModels` and `ListInferenceProfiles` in ap-south-1 | India-resident profiles available for Claude Haiku 4.5 and Sonnet 5 |
| 15:15 | AICTE regional offices search | 8 regional offices plus camp offices (Guwahati, Thiruvananthapuram, Vadodara) |
| 15:20 | `npm view` and `pip index versions` for planned dependencies | `VERSIONS.md` |

## 25 October 2026
- ReportLab 5.1 shapes complex scripts when `uharfbuzz` is installed and a paragraph style sets `shaping=1` (source: `reportlab/pdfbase/ttfonts.py` and `platypus/paragraph.py` in the installed package). Without it, Devanagari conjuncts render as separate glyphs. Verified by rendering क्ष, त्ति and प्र to PNG.
- The hinted Noto Sans Devanagari TTF from notofonts has no Latin glyphs, so letters pair it with Noto Sans for English (source: rendering test).
- uharfbuzz 0.57.0 publishes manylinux aarch64 wheels, so it installs on the t4g instance without a compiler (source: PyPI file list).
- Bedrock `ListInferenceProfiles` in ap-south-1: `in.anthropic.claude-haiku-4-5-20251001-v1:0` is ACTIVE; Haiku 5.5 is available only as a `global.` profile, which routes outside India. Converse calls from account 067257065056 fail with `ValidationException: Operation not allowed` for Anthropic and Amazon Nova models in ap-south-1 and us-east-1, so inference is blocked at the account level (DECISION D29).
- Region map: no openly licensed India boundary dataset with a stated Survey of India compliance was confirmed, so the region view uses a tile cartogram (DECISION D13, resolved).
- Playwright 1.64.1 and `@axe-core/playwright` 4.14.0 were under two weeks old on 25 October; 1.63.0 and 4.13.0 were pinned instead (`npm view ... time`).

## Open research items
- Bedrock model access for the project account (owner action with AWS).
- Licence of PP-OCR model files used by RapidOCR.
- Licence of ImageNet-pretrained EfficientNet-B0 weights used for encoder initialisation.
- TypeScript 7 compatibility with Vite, ESLint and TanStack Router.
