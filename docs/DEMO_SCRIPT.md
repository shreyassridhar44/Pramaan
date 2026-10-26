# Demo script

Target length 3:00, following `claude-code/PROTOTYPE.md` Section 12. Live site: https://pramaan.duckdns.org (demo password for every persona: `Pramaan@2026`, or use the persona buttons on the sign-in page). All data is synthetic; simulated parts (bank network, bank desk, SMS, WhatsApp) are labelled on screen.

## Before each take

1. Reset the demo data: `SEED=1 bash infra/aws/deploy.sh` (or locally `cd services/api && uv run python -m scripts.seed`).
2. Browser at 110% zoom, 2560 by 1440 capture at 60 fps. Ledger theme, except the forecast shot (it switches to Command on its own).
3. Open tabs in order: sign-in page; a second browser profile for the institution and bank personas; a phone with a QR scanner for the release shot.

## The fastest way to show everything

Open `https://pramaan.duckdns.org/home?tour=1`. The guided tour plays the six test scenarios by itself, switching personas and spotlighting each screen; arrow keys move, space pauses. Share this link with evaluators who explore on their own.

## Shots

| Time | Persona | Action | Say |
|---|---|---|---|
| 0:00 to 0:15 | Public, then bureau officer | The home page: the specimen receipt earns its watermark, seal and foil. Click Ananya Iyer's identity card; the command board loads. | "Proof you can see: a deposit earns its security features as it is proven. This is everything AICTE holds, and how much is proven." |
| 0:15 to 0:35 | Bureau officer | Registry, Ask bar: "SBI and unconfirmed deposits in the Western region maturing before March 2027". Point at the chips and the note that SBI is not in the portfolio, then Apply. | "Plain English becomes filters the officer can see and remove. Nothing is applied blind." |
| 0:35 to 1:00 | Bureau officer | Forecast, play at 4x for about six months. The map recolours, the river moves, the event stream ticks. | "The same rules engine plays the next year forward, so no maturity or deadline arrives unannounced." |
| 1:00 to 1:30 | Institution, then bureau officer | Portal, Submit an FDR with the altered specimen, declaring Rs 35,00,000. As the officer, open it, Documents tab, switch on the UV lamp and move it over the amount: the edited digit glows. | "The receipt reads 35 lakh in figures and fifteen lakh in words. Under the UV lamp the model shows exactly which digit was changed. A prompt to check, not a verdict." |
| 1:30 to 1:55 | Bureau officer, then bank | Open the new instrument, Bank tab, Request confirmation. Switch to the bank persona (Bharat National Bank, a simulated desk bank), sign the response. Back as the officer: the amount conflicts with the bank's signed Rs 15,00,000. | "What the institution declared and what the bank signed are kept apart, and the conflict is shown field by field." |
| 1:55 to 2:30 | PGRC, then competent authority | Releases, "Sahyadri College of Engineering, Nashik" (REL/2026/000003): resolve the open complaint, Clear. Sign in as the authority, Issue NOC. Scan the QR on the PDF with a phone: the verify page says Genuine. | "Release needs every clearance and a named authority. The letter carries a signed QR anyone can check." |
| 2:30 to 2:45 | Auditor | Audit, Tamper with an entry: the panel turns red and names the entry. Restore. | "If anyone edits the database behind Pramaan's back, the chain says exactly where." |
| 2:45 to 3:00 | | Command view, product name, team. | "Pramaan: proof for every deposit." |

## Backup shots

- Legacy import (`/admin/import`): Reconcile the sample register; 1,000 rows sort into match, differs, paper-only, repeated and unusable in under a second.
- Alerts, See message: the Hindi WhatsApp reminder on a phone.
- Instrument, Timeline, Passport: the deposit's history as stamps.

- Alerts page (reminders by kind and the escalation ladder), and the captured inbox at `/mail/` (login from `bash infra/aws/ops.sh inbox-login`).
- A release case with a penalty: the payment reference must be recorded before the penalty condition passes.
- Reports: a CSV and PDF that reconcile with the command view.

## If something goes wrong live

- Analysis takes several seconds on the demo server; the wizard shows its stages while it runs.
- If the site does not answer: `bash infra/aws/ops.sh status`, then `ops.sh start` if the instance is stopped. The containers come back on their own within two minutes.
- The local stack (`DEPLOYMENT.md` Section 1) runs the same demo offline.
