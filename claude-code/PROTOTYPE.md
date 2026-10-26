# PROTOTYPE.md: How Pramaan looks and behaves

This is the single source of truth for the interface. If code and this file disagree, fix one of them in the same commit and record why in `DECISION.md`.

## 1. Design intent

Pramaan is a working instrument for a financial regulator, not a marketing site and not a generic admin template. Since 26 October 2026 it speaks the visual language of security printing (Section 13, DECISION D36): proof is drawn the way stamp paper, banknotes and passports show authenticity. Four principles decide every design question:

1. **Evidence first.** Every number can be traced to its source in one click. Proof is the visual hero: the colour of an item tells you how well it is proven.
2. **Calm density.** Officers handle thousands of records. Screens are information-rich but quiet: generous line height, few borders, one accent at a time.
3. **Motion explains change.** Animation is used only when something changes state, moves in time, or arrives from outside (a bank response). No decorative loops.
4. **Regulator-grade trust.** Precise typography, Indian number formats, bilingual where the public sees it, clause references next to rule outcomes, no playful illustrations.

What we avoid: glassmorphism, stock illustrations, emoji, rainbow charts, cards inside cards, centred marketing copy on working screens, modal-heavy flows, spinners where a skeleton fits, and decoration that carries meaning without a text label. The public home page may have a hero; working screens may not.

## 2. Visual language

### 2.1 Colour tokens

Defined as CSS variables in `apps/web/src/styles/tokens.css` and mapped into Tailwind v4 `@theme`. Two themes: **Ledger** (light, default for working screens) and **Command** (dark, default for the forecast screen and optional elsewhere).

| Token | Ledger | Command | Use |
|---|---|---|---|
| `--canvas` | `#F5F3EE` | `#0A0E17` | App background (warm paper / deep ink) |
| `--surface` | `#FFFFFF` | `#111726` | Panels |
| `--surface-sunken` | `#EFECE5` | `#0D1220` | Wells, table header, inputs |
| `--line` | `#E4DFD4` | `#222B3F` | Hairlines |
| `--line-strong` | `#CFC8B9` | `#33405C` | Dividers, focus outline base |
| `--ink` | `#121726` | `#E9ECF4` | Primary text |
| `--ink-2` | `#474E63` | `#A9B1C6` | Secondary text |
| `--ink-3` | `#7D8397` | `#6E7891` | Tertiary, labels |
| `--brand` | `#1D2B5C` | `#9DB1FF` | Primary actions, active nav (indigo ink) |
| `--brand-contrast` | `#FFFFFF` | `#0A0E17` | Text on brand |
| `--accent` | `#B6531C` | `#F0915A` | Focus ring, selection, the one highlight per screen (fired copper) |

Assurance scale (the signature palette; colour plus glyph plus label, never colour alone):

| Level | Token | Ledger | Command | Glyph |
|---|---|---|---|---|
| A0 Declared | `--a0` | `#8A8FA0` | `#7C869E` | hollow ring |
| A1 Document-checked | `--a1` | `#2F5BD3` | `#6E93FF` | segmented ring 1 of 3 |
| A2 Bank-confirmed | `--a2` | `#0F7A55` | `#35C58F` | segmented ring 2 of 3 plus seal tick |
| A3 Re-confirmed | `--a3` | `#0A5A40` | `#5BE0AE` | full ring plus seal tick |

Status and signal colours:

| Token | Ledger | Command | Use |
|---|---|---|---|
| `--due` | `#A86206` | `#F2B54B` | Due soon, warnings |
| `--overdue` | `#B42318` | `#FF7A6E` | Overdue, discrepancy, blocked |
| `--info` | `#2F5BD3` | `#6E93FF` | Neutral information |
| `--simulated` | `#6B4FA0` | `#B69CFF` | Badge on every simulated surface |

All text and interactive pairs meet WCAG 2.2 AA (4.5:1 body, 3:1 large text and UI). `scripts/check-contrast.mjs` verifies the token pairs in CI.

### 2.2 Typography

| Role | Typeface | Notes |
|---|---|---|
| UI text | Geist Sans (OFL) | 14 px base in the officer app, 16 px in the institution portal and verify page |
| Figures, IDs, amounts, dates | Geist Mono (OFL) with tabular numerals | Every amount and instrument number |
| Display numerals and page titles | Instrument Serif (OFL) | Only the headline figures on the command view, page titles, and letters. Used sparingly so it stays special |
| Hindi | Noto Sans Devanagari (OFL) | Letters, verify page, institution portal headings |

Scale (rem, 1 rem = 16 px): 0.75, 0.8125, 0.875 (body), 1, 1.125, 1.375, 1.75, 2.5, 3.5 (display). Line height 1.5 for text, 1.15 for display. Letter spacing: -0.01em for display, +0.04em uppercase for the small labels only.

Number formatting (shared util `formatINR`): full amounts in Indian grouping `Rs 15,00,000` displayed as `₹15,00,000`; compact `₹15 L`, `₹412.6 Cr`; dates `12 Mar 2027`; relative "in 23 days" next to absolute dates, never alone.

### 2.3 Space, grid, shape

- 4 px base unit; spacing scale 4, 8, 12, 16, 20, 24, 32, 40, 56, 72.
- Officer app: 64 px left rail (expands to 232 px on hover or pin), 56 px top bar, content max width 1600 px with 24 px gutters, 12-column grid.
- Radius: 6 px controls, 10 px panels, 999 px chips. Panels use a hairline border and no shadow; only overlays (popover, dialog, palette) cast a soft shadow.
- Density toggle in the registry: comfortable 44 px rows, compact 34 px rows.

### 2.4 Iconography

Lucide icons at 16 and 20 px, 1.5 px stroke. Custom glyphs (SVG components): assurance ring, bank seal, provenance source marks (D, X, B), Pramaan mark.

### 2.5 Motion

Library: Motion (`motion/react`). Tokens: `fast 120ms`, `base 200ms`, `slow 320ms`, `story 600ms`; easing `cubic-bezier(0.2, 0, 0, 1)` for entering, `cubic-bezier(0.4, 0, 1, 1)` for leaving.

Meaningful motion only:
- Assurance ring segments fill when evidence arrives (story duration, once).
- Provenance cells cross-fade from conflict to match when a bank response lands, with a brief seal stamp.
- Numbers roll (count up or down) when the as-of date changes.
- The maturity river and map recolour smoothly between forecast steps.
- Lists animate insertions (new queue items slide in from the top, 200 ms).
- Route changes: 120 ms fade only.

Security print adds (D36): guilloche strands drawing in once, seals and rubber stamps pressing down when an event lands, split-flap figures riffling when a value changes, a scan line sweeping a document once when it loads, a foil sheen that follows the pointer or the phone's tilt, and very slow rotation of background rosettes. Each is tied to a change of state or to the identity of a surface.

`prefers-reduced-motion`: replace all movement with instant state changes; keep colour transitions at 0 ms.

## 3. Signature components

These make Pramaan recognisable. Build them first, in `apps/web/src/components/signature/`, with Storybook-style demo routes under `/dev/components` (dev builds only).

1. **AssuranceRing.** SVG ring with three segments (document, bank, re-confirmation). Sizes 16, 24, 40, 96 px. Tooltip lists the evidence behind each segment with timestamps. A0 renders as a dashed hollow ring.
2. **ProvenanceGrid.** Rows are fields; columns are Declared, Extracted, Confirmed, State. Each cell shows the value, source mark, time, and confidence (for extraction). State column: match (check), conflict (crossed), missing (dash), pending (clock). Conflicting values are highlighted at character level (diff), so "15,00,000" against "35,00,000" highlights the "3".
3. **MaturityRiver.** ECharts stacked area (or stream) of instrument value maturing per week over 24 months, layered by assurance level, with a vertical "as of" line and hover for the week's list. Click a week to filter the registry.
4. **IndiaRegionMap.** MapLibre GL map with the AICTE regional offices as proportional nodes (value held), ringed by assurance mix, with an overdue badge. Uses a boundary dataset that follows Survey of India boundaries; the dataset and licence are recorded in `THIRD_PARTY.md`. If no compliant dataset can be confirmed, fall back to a tile cartogram of regions (decision recorded).
5. **AsOfControl.** Date pill in the top bar: "As of 24 Oct 2026 · Today". Click opens a calendar plus a horizontal 24-month scrubber with month ticks; drag to move; "Today" snaps back. When not today, the top bar shows a copper outline and the label "Forecast view: nothing is saved".
6. **SignalCard.** Severity bar, title in plain language, the evidence (thumbnail crop, values, rule or model with version), actions: confirm, dismiss with reason, open record.
7. **DocumentViewer.** Pan and zoom canvas for images and PDF pages (pages rendered server-side to images). Layers: OCR boxes (toggle), field labels, forensic heatmap (opacity slider), duplicate match link. Keyboard: +/- zoom, 0 fit, L toggle layers.
8. **BankMessage.** Shows a bank response like a statement extract: bank name with simulated badge, fields, a signature row ("Ed25519 signature valid, key bank-sbx-03, received 14:02:11"), and an expandable raw JSON view.
9. **ClearanceLanes.** For release cases: three parallel lanes (PGRC, Vigilance, Grants) feeding a final authorisation node, each lane showing state, officer, time and reason.
10. **CommandPalette.** cmdk: search instruments by number, institutions by name or AICTE ID, jump to pages, run actions ("Request bank confirmation for FDR 00412..."), switch theme.
11. **AuditChain.** A vertical chain of blocks with hashes; "Verify chain" walks the chain with a progress line and marks each block verified; a broken link renders in overdue colour with the first bad entry.

## 4. Application shell

- **Left rail:** Pramaan mark at top; icons with labels on expand: Command, Queue (with count), Instruments, Institutions, Releases (count), Alerts (count), Forecast, Reports, Letters, Audit, Admin. Bottom: help, theme, user.
- **Top bar:** breadcrumb or page title on the left; centre: global search trigger ("Search or ask... Ctrl K"); right: AsOfControl, notifications bell, role badge (for example "Regulation Bureau · Scrutiny"), avatar.
- **Notifications drawer:** right side, grouped by Today / Earlier, each linking to the record.
- **Toasts:** bottom right, Sonner, for confirmations of the user's own actions only.
- **Simulated badge:** any screen or panel showing simulated bank data carries the `--simulated` badge "Simulated bank".

## 5. Screens: officer app

For every screen: loading uses skeletons that match the final layout; empty states explain what will appear and offer the next action; errors show what failed, a retry, and a request ID.

### 5.1 Sign-in (`/signin`)
- Split layout. Left 40%: Pramaan mark, product name in Instrument Serif, one line "Security deposits and FDRs, proven at source", the AICTE Regulation Bureau context line, and a small live figure strip (value held, bank-confirmed share) fetched from a public summary endpoint. Right 60%: sign-in form (email, password), and below it "Explore the prototype as" with persona cards: Bureau officer, Section head, Regional officer (Western), PGRC officer, Institution (Demo Institute of Technology, Pune), Bank desk (simulated), Auditor. One click signs in as that persona in demo mode.
- No hero image. Background: canvas colour with a very faint ledger-line pattern.

### 5.2 Command view (`/`)
Layout (12 columns):
- Row 1 (full width): headline band. Four figures in Instrument Serif display size with Geist Mono units: **Value held** (₹412.6 Cr), **Bank-confirmed** (68% of value, with AssuranceRing at 40 px), **Needs action today** (23), **Maturing in 90 days** (₹38.2 Cr, 117 instruments). Each figure has a one-line caption and a delta against 30 days ago. Figures roll when the as-of date changes.
- Row 2: left 8 columns, MaturityRiver (24 months). Right 4 columns, Assurance composition: a horizontal stacked bar by value with A0 to A3 and a short list "Largest unproven exposures" (top 5 instruments at A0 or A1 by value).
- Row 3: left 5 columns, IndiaRegionMap. Right 7 columns, Action queue table: rank, item, institution, due, owner, severity. Row click opens the record in a side sheet (not a new page) so the officer keeps context.
- Row 4: left 6 columns, Recent signals (SignalCard list, latest 6). Right 6 columns, Impact panel: verification turnaround median and p90 with a small trend line, field agreement rate, reminders sent on time, items without owner, each labelled "computed from synthetic data".

States: skeletons per panel; if a panel fails, only that panel shows an error with retry.

### 5.3 Verification queue (`/queue`)
- Two-pane triage. Left: list of work items (new submission, discrepancy, bank response received, deficiency reply) with filters (type, severity, region, assigned to me). Right: the selected item's provenance grid, document thumbnail with heatmap toggle, signals, and actions: Request bank confirmation, Return with deficiency, Mark verified (only if rules allow), Assign.
- Keyboard: J and K move, Enter opens full record, B requests bank confirmation, R returns, A assigns.
- Empty state: "Queue clear. Next reminder run at 06:00."

### 5.4 Instrument registry (`/instruments`)
- Ask bar on top: input with placeholder "Ask in plain English, for example: SBI FDRs in the Western region maturing before March 2027 without renewal". On submit, shows interpreted filters as chips with an "Interpreted by AI, check before use" note; chips are editable; "Apply" runs the query.
- Filter row: chips for Region, Bank, Type, Status, Assurance, Maturity range, Signals; "Saved views" menu; density toggle; column chooser; Export CSV.
- Table (TanStack Table plus Virtual): columns Instrument No. (mono), Institution, Region, Bank, Amount (right-aligned mono), Issue, Maturity (date plus relative), Status chip, Assurance ring, Signals count, Owner. Sticky header and first column. Row hover reveals quick actions.
- Selection enables bulk bar: Request confirmation, Send reminder, Assign.

### 5.5 Instrument detail (`/instruments/:id`)
- Header: instrument number in mono, type chip, institution link, amount in display size, AssuranceRing 96 px with level name, status chip, owner, next action with due date, actions menu.
- Tabs:
  - **Overview:** ProvenanceGrid (main), right column with Key dates (issue, maturity, reminder schedule with sent ticks), Renewal chain (predecessor and successor cards), Linked demand (Table 1.4 calculation).
  - **Documents:** DocumentViewer with file list, layers and signals panel.
  - **Bank:** BankMessage thread; "Request confirmation" or "Request re-confirmation"; delivery status.
  - **Timeline:** vertical timeline of all events with filters (lifecycle, reminders, signals, observations, audit).
  - **Audit:** this instrument's audit entries with hash prefixes.
- Observations: a composer at the bottom of Overview; corrections require a reason and show "corrected from X by Y" inline.

### 5.6 Institutions (`/institutions`, `/institutions/:id`)
- List with search by name, AICTE permanent ID, region; columns include value held, assurance mix bar, open items.
- Profile: header with name, AICTE ID, region, premises (own or leased), status flags (complaints open, dispute lien, embezzlement NOC pending); sections: Programmes and demand calculation (each Table 1.4 line with the APH clause), Instruments, Release cases, Letters, Activity.

### 5.7 Release cases (`/releases`, `/releases/:id`)
- List: case ID, institution, instruments, amount, stage, blocking reason, age.
- Case page: eligibility checklist at top (each item pass, fail or pending with the clause), ClearanceLanes in the middle, documents submitted (application letter, Affidavit 6, FDR copy, LoA or EoA) with check marks, penalty calculation if any, final authorisation panel (only visible to authorised roles) with "Issue NOC" or "Issue sanction order", then bank discharge status.

### 5.8 Alerts (`/alerts`)
- Two tabs: Reminders (scheduled and sent, by channel) and Escalations (current level, days overdue, next escalation date). Filters by rule, region, level. Each row links to the record.

### 5.9 Forecast (`/forecast`)
- Full-screen, Command theme by default.
- Top: AsOfControl enlarged into a 12-month scrubber with play, pause, speed (1 week per second, 2, 4) and "Today".
- Centre left (7 columns): IndiaRegionMap with nodes recolouring by overdue share; arcs pulse briefly from a region to a bank node when a reminder or bank event fires.
- Centre right (5 columns): figures that roll (value maturing this month, overdue count, open escalations, officer workload top 5).
- Bottom (full width): MaturityRiver with the playhead, and an event stream ticker listing events as they occur ("Week of 12 Jan 2027: 14 reminders at T-30, 3 escalations to Deputy Director, 2 instruments matured without release application").
- Label in the corner: "Forecast from current rules and data. Nothing is saved."

### 5.10 Reports (`/reports`)
- Gallery of report cards (Pending verifications, Upcoming maturities, Missing documents, Cases needing intervention, Ageing by stage, Region exposure, Bank exposure, Release pipeline). Each opens a parameter panel and a preview table with Export CSV and PDF.

### 5.11 Letters (`/letters`)
- Table of generated letters with type, reference, recipient, date, status (issued, superseded, revoked); preview pane shows the PDF; actions: download, revoke (authorised roles), copy verification link.

### 5.12 Audit (`/audit`)
- Filterable log (actor, action, entity, date). Right panel: AuditChain with "Verify chain". Export evidence bundle (PDF plus JSON).

### 5.13 Admin (`/admin/rules`, `/admin/users`)
- Rules: sections for Rate card (editable Table 1.4 with effective-from date), Leased multiplier, Term, Reminder ladder (chips for offsets), Escalation matrix (table), Penalty slabs, Clearance cells, Re-confirmation window. Each rule shows its APH clause. Changes create a new rule version; the old version remains for history.
- Users: list, role assignment, region scope, deactivate.

## 6. Screens: clearance cells (`/clearances`)
- Queue of release cases waiting for this cell, with institution context, the cell's own flags (for PGRC: open complaints with references), and Clear or Block with mandatory reason. Same triage pattern as the verification queue.

## 7. Screens: bank desk (`/bank`), simulated
- Distinct but related look: neutral greys with the `--simulated` badge in the header ("Bank confirmation desk. Simulated bank: Bharat National Bank").
- Inbox of confirmation and discharge requests. Selecting a request shows the request fields beside the bank's own record (from the simulated core banking table) with a field-by-field comparison. Actions: Confirm (all fields), Report mismatch (choose fields, enter bank values), Mark lien discharged. Submitting shows the message being signed (key ID, signature preview) and sent.

## 8. Screens: institution portal (`/portal`)
- Lighter, simpler shell: top navigation only (Home, Submit, Instruments, Release, Letters), 16 px base text, bilingual headings (Hindi above English in smaller size).
- Home: demand card (amount due, how calculated, deadline countdown, penalty that would apply after each date), instrument list with status and next step, tasks ("Upload Affidavit 3", "Renewal due in 30 days"), notifications.
- Submit wizard (4 steps with a progress rail): Details, Upload scan (drag and drop; extraction runs and shows "We read these values from your document" with mismatches inline), Affidavit and declaration, Review and submit. Autosave of the draft.
- Instrument status: a plain timeline of what happened and what happens next; deficiency replies.
- Release: guided form with the required documents checklist and live eligibility hints.
- Fully usable at 360 px width.

## 9. Public verify page (`/verify/:token`)
- Mobile first. Pramaan mark, bilingual title "दस्तावेज़ सत्यापन / Document verification", result banner (Genuine, Superseded, Revoked, Not recognised) with icon and colour, key fields of the letter (type, reference, institution, date, amount where relevant), issuing office, and a note on how verification works (signed token, checked against Pramaan's key). No sign-in.

## 10. Responsive behaviour

| Breakpoint | Officer app | Portal and verify |
|---|---|---|
| >= 1440 | Full layout as specified | Centered, max 960 px |
| 1280 to 1439 | Command view rows collapse widths; rail collapsed by default | Same |
| 768 to 1279 | Single column panels, tables scroll horizontally with sticky first column, side sheets become full-screen | Same |
| < 768 | Read-mostly: command figures, queue list, record detail; editing flows prompt to use a larger screen | Fully functional |

## 11. Accessibility checklist

- All interactive elements reachable by keyboard in a logical order; visible 2 px copper focus ring with 2 px offset.
- Radix primitives for dialogs, menus, tabs, tooltips (correct roles and focus management).
- Charts have a table alternative ("View as table") and descriptive titles.
- Status is never colour-only: chips carry text, rings carry glyphs and tooltips.
- Map nodes are focusable with labels; the region list is available as a table.
- Reduced motion respected; no flashing content.
- Forms: labels, descriptions, inline errors linked with `aria-describedby`.

## 12. Demo script and shot list (target 3:00)

| Time | Shot | Screen and action | What it proves |
|---|---|---|---|
| 0:00 to 0:15 | Cold open | Command view loads, figures roll in; caption "₹412.6 crore held in trust. How much of it is proven?" | The problem and the product in one frame |
| 0:15 to 0:35 | Ask | Officer types a plain-English query in the registry; chips appear; results filter | Usability, AI used responsibly |
| 0:35 to 1:00 | Forecast | Forecast screen plays 6 months; map and river change; event stream ticks | No deadline is missed (R5, R6, R12) |
| 1:00 to 1:30 | Catch | Institution uploads a scan; extraction runs; heatmap highlights the altered amount; signal opens | Discrepancy identification, real ML (R3) |
| 1:30 to 1:55 | Proof | Bank desk confirms a genuine instrument; signature valid; provenance cells turn to proof; ring fills to A2 | Submitted versus confirmed (R4) |
| 1:55 to 2:30 | Release | Release case blocked by PGRC; PGRC clears; NOC issued; phone scans QR; verify page says Genuine | Authorised release (R8, C4) |
| 2:30 to 2:45 | Trust | Audit chain verify; impact panel | Accountability, measurable improvement (R13, R15) |
| 2:45 to 3:00 | Close | Command view, product name, team name | Memorable ending |

Recording notes: 2560 by 1440 capture at 60 fps, browser zoom 110% for legibility, demo data reset before each take, Command theme for the forecast shot, Ledger theme elsewhere.

## 13. Security print (DECISION D36)

Components live in `apps/web/src/components/security/`; the pattern maths in `src/lib/guilloche.ts` (rosettes and woven bands from a seed) and `src/lib/guilloche-mask.ts` (the same as CSS masks, cheap enough for every panel).

| Element | Where | Meaning |
|---|---|---|
| Guilloche rosette, seeded | Instrument header, letters, passport, panel corners | Identity: the same number always draws the same pattern |
| Assurance seal (40 px and up) | Instrument header, command board | A0 dashed outline, A1 watermark rosette, A2 embossed seal, A3 seal with foil |
| Rubber stamp | Home lifecycle, deposit passport | A recorded event, with its date |
| Split-flap figures | Home board, sign-in, legacy import | Live figures; they riffle when the value changes |
| Security thread | Active rail item, re-confirmed specimen | Where you are; continuity |
| Microprint, tricolour hairline, GIGW strip | Every shell | Official identity; the strip says it is a prototype |
| UV lamp | Document viewer (U key) | The forensic heatmap, magnified, as a note checker shows it |
| Foil | A3 seals, verify page, identity cards on hover | Highest assurance; a genuine letter |

Dashboards (D38): the command view is a brief, a board with a 13-week maturity runway (D39), a maturity clock (river and table one click away), a proof meter, isometric regional towers, a docket of case files, signal cards and analogue dials. The forecast is a time-machine console. The institution home is a certificate band, a challan with a counterfoil countdown and sealed deposit cards. Every surface follows the chosen theme (D39), and the rail never scrolls.

New screens and moments: public home (`/home`, signed-out visitors land here; `/home?tour=1` starts the tour), identity-card personas on sign-in, the proof moment on the bank desk, the deposit passport (instrument Timeline tab), reminder previews on a phone (Alerts), the audit tamper drill, and legacy import (`/admin/import`, D37).
