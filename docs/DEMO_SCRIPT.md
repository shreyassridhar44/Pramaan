# Demo script

Target length 3:00, following `claude-code/PROTOTYPE.md` Section 12. Live site: https://pramaan.duckdns.org (demo password for every persona: `Pramaan@2026`, or use the persona buttons on the sign-in page). All data is synthetic; simulated parts (bank network, bank desk, SMS, WhatsApp) are labelled on screen.

## Before each take

1. Reset the demo data: `SEED=1 bash infra/aws/deploy.sh` (or locally `cd services/api && uv run python -m scripts.seed`).
2. Browser at 110% zoom, 2560 by 1440 capture at 60 fps. Ledger theme, except the forecast shot (it switches to Command on its own).
3. Open tabs in order: sign-in page; a second browser profile for the institution and bank personas; a phone with a QR scanner for the release shot.

## Shots

| Time | Persona | Action | Say |
|---|---|---|---|
| 0:00 to 0:15 | Bureau officer | Sign in. The command view loads and the headline figures roll in. | "This is every security deposit AICTE holds in trust, and how much of each is actually proven." |
| 0:15 to 0:35 | Bureau officer | Registry, Ask bar: "SBI and unconfirmed deposits in the Western region maturing before March 2027". Point at the chips and the note that SBI is not in the portfolio, then Apply. | "Plain English becomes filters the officer can see and remove. Nothing is applied blind." |
| 0:35 to 1:00 | Bureau officer | Forecast, play at 4x for about six months. The map recolours, the river moves, the event stream ticks. | "The same rules engine plays the next year forward, so no maturity or deadline arrives unannounced." |
| 1:00 to 1:30 | Institution (Demo Institute) | Portal, Submit an FDR, use the altered specimen and declare Rs 35,00,000. The analysis marks the changed digit and reports that figures and words disagree. | "The receipt reads 35 lakh in figures and fifteen lakh in words, and the model marks the edited digit. It is a prompt to check, not a verdict." |
| 1:30 to 1:55 | Bureau officer, then bank | Open the new instrument, Bank tab, Request confirmation. Switch to the bank persona (Bharat National Bank, a simulated desk bank), sign the response. Back as the officer: the amount conflicts with the bank's signed Rs 15,00,000. | "What the institution declared and what the bank signed are kept apart, and the conflict is shown field by field." |
| 1:55 to 2:30 | PGRC, then competent authority | Releases, "Sahyadri College of Engineering, Nashik" (REL/2026/000003): resolve the open complaint, Clear. Sign in as the authority, Issue NOC. Scan the QR on the PDF with a phone: the verify page says Genuine. | "Release needs every clearance and a named authority. The letter carries a signed QR anyone can check." |
| 2:30 to 2:45 | Bureau officer | Audit, Verify chain; then the impact panel on the command view. | "Every action is in a hash-chained log, and the impact figures are computed from the records, on synthetic data." |
| 2:45 to 3:00 | | Command view, product name, team. | "Pramaan: proof for every deposit." |

## Backup shots

- Alerts page (reminders by kind and the escalation ladder), and the captured inbox at `/mail/` (login from `bash infra/aws/ops.sh inbox-login`).
- A release case with a penalty: the payment reference must be recorded before the penalty condition passes.
- Reports: a CSV and PDF that reconcile with the command view.

## If something goes wrong live

- Analysis takes several seconds on the demo server; the wizard shows its stages while it runs.
- If the site does not answer: `bash infra/aws/ops.sh status`, then `ops.sh start` if the instance is stopped. The containers come back on their own within two minutes.
- The local stack (`DEPLOYMENT.md` Section 1) runs the same demo offline.
