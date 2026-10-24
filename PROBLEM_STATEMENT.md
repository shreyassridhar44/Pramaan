# Problem Statement SIH26265

This file holds the official problem statement exactly as published, followed by our analysis of it. The official text is in Section 2 and has not been edited. Everything after Section 2 is our interpretation, and it is labelled as such.

## 1. Official metadata

| Field | Value (as published) |
|---|---|
| Problem Statement ID | SIH26265 (portal modal shows `26265`) |
| Title | Streamline of security deposit/ FDR portal. |
| Organization | AICTE |
| Department | Regulation Bureau |
| Category | Software |
| Theme | Smart Automation |
| Submission deadline | 28 October 2026 |
| YouTube link | None published |
| Dataset link | None published |
| Source URL | https://sih.gov.in/sih2026PS |
| Captured on | 24 October 2026 (page downloaded and parsed from the portal HTML) |
| Ideas submitted at capture | 16 of a 500 cap (portal counter, 24 October 2026) |

## 2. Official description (verbatim)

The portal publishes the description as one paragraph. It is reproduced below without changes. Line breaks are not added, so that the text matches the source exactly.

> Description (Background, Detailed Description and Expected Solution) Background The All India Council for Technical Education (AICTE), Ministry of Education, Government of India, undertakes approval-related regulatory activities for technical institutions in accordance with applicable regulations, approval process handbooks and prescribed administrative procedures. Depending on the applicable requirements, institutions may be required to submit or maintain security deposits or Fixed Deposit Receipts (FDRs) as part of the approval and compliance process. The management of security deposits and FDRs involves maintaining institution-wise records, verifying submitted financial instruments, monitoring validity and maturity dates, tracking renewal or replacement requirements, recording release or refund requests and ensuring that the relevant documents remain available for regulatory verification. When these activities are managed through fragmented records, manual correspondence or multiple tracking mechanisms, it may become difficult to maintain an accurate and up-to-date view of deposit status, pending actions and time-sensitive requirements. There is a need for a centralized and streamlined digital portal that enables systematic management of security deposits and FDRs, reduces repetitive administrative work, improves record accuracy and provides timely alerts to the concerned officials and institutions. Such a system should support transparent tracking throughout the lifecycle of each deposit while ensuring adherence to applicable AICTE requirements and authorized financial procedures. Detailed Description The proposed solution envisages the development of a secure, centralized Security Deposit/FDR Management Portal for the AICTE Regulation Bureau and other authorized stakeholders. The portal should maintain institution-wise and instrument-wise records of security deposits and FDRs, including relevant reference numbers, issuing bank details, deposit amount, issue date, maturity date, validity status, supporting documents and current administrative status, as applicable. The system should facilitate the digital submission and storage of FDR documents and other prescribed supporting records. It should enable authorized officials to review the submitted information, verify available instrument details through legitimate bank-issued verification mechanisms wherever supported, identify incomplete records and flag discrepancies requiring further scrutiny. The system should distinguish between information submitted by an institution and information independently confirmed by an authorized bank or financial source. An automated monitoring module should track maturity dates, validity periods, renewal or replacement requirements and other prescribed timelines. Configurable reminders should be generated before relevant deadlines, while overdue or unresolved cases should be flagged for appropriate follow-up. The portal should also support the recording and tracking of requests relating to release, discharge or refund of security deposits/FDRs, subject to applicable regulations, fulfillment of prescribed conditions and authorization by the competent authority. A centralized dashboard should provide an overview of active, expiring, matured, renewed, released and pending instruments. Authorized users should be able to search records, review document histories, update permitted fields, record scrutiny observations and monitor the status of each case. Automated reports should help officials identify pending verifications, upcoming maturity dates, missing documents and cases requiring intervention. The system should incorporate role-based access, secure document storage, appropriate encryption, audit trails and controlled access to financial and institutional information. Where technically feasible and formally authorized, integration with existing AICTE systems and bank verification services should be considered to reduce duplicate data entry and improve the reliability of records. Expected Solution The expected solution is a user-friendly, secure and integrated Security Deposit/FDR Management Portal that streamlines the complete administrative lifecycle of security deposits and FDRs associated with applicable AICTE approval-related processes. The proposed system should provide the following capabilities: 1. Centralized Security Deposit/FDR Repository: Maintain institution-wise and instrument-wise records, supporting documents and status in a single portal. 2. Digital Document Management: Enable secure uploading, storage, retrieval and review of FDRs, deposit confirmations and other prescribed records. 3. Verification and Discrepancy Detection: Facilitate verification through authorized sources wherever available and flag missing information, inconsistencies or documents requiring further scrutiny. 4. Automated Validity and Maturity Tracking: Monitor relevant dates and generate advance reminders for expiring or maturing instruments and prescribed renewal or replacement actions. 5. Renewal and Replacement Monitoring: Track submission of renewed or replacement instruments and maintain a complete history of changes. 6. Release and Refund Workflow: Facilitate submission, processing and status tracking of release or refund requests in accordance with applicable requirements and authorized procedures. 7. Automated Alerts and Escalation: Notify relevant stakeholders about pending verification, approaching deadlines, overdue actions and unresolved cases. 8. Dashboard and Management Reports: Provide consolidated information on active, expiring, matured, renewed, released and pending deposits/FDRs. 9. Audit Trail and Access Control: Maintain traceable records of submissions, verification results, changes, approvals and actions taken by authorized officials. 10. System Integration and Data Security: Support authorized integration with existing systems and protect confidential financial and institutional information. The prototype should demonstrate measurable improvements in record accuracy, verification turnaround time, timely renewal monitoring, reduction in manual tracking effort and visibility into pending cases. Testing should cover scenarios such as new FDR submission, validity tracking, approaching maturity, renewal, discrepancy identification and authorized release processing. The ultimate objective is to establish an efficient, transparent and accountable digital mechanism for managing security deposits and FDRs, minimizing avoidable administrative delays and enabling the AICTE Regulation Bureau to monitor relevant financial instruments systematically while ensuring compliance with applicable regulations and financial procedures.

## 3. Official requirements, itemised

Each item below is restated from the official text in Section 2. The ID is ours and is used for traceability in `PROJECT.md`, `TESTING.md` and `claude-code/STEPS.md`.

| ID | Official requirement (restated) | Where in the official text |
|---|---|---|
| R1 | Centralized repository of institution-wise and instrument-wise records: reference numbers, issuing bank details, amount, issue date, maturity date, validity status, supporting documents, current administrative status. | Detailed Description; Expected Solution item 1 |
| R2 | Digital submission, secure upload, storage, retrieval and review of FDRs, deposit confirmations and other prescribed records. | Detailed Description; Expected Solution item 2 |
| R3 | Officials review submitted information, verify instrument details through legitimate bank-issued verification mechanisms where supported, identify incomplete records and flag discrepancies. | Detailed Description; Expected Solution item 3 |
| R4 | Distinguish information submitted by an institution from information independently confirmed by an authorized bank or financial source. | Detailed Description |
| R5 | Automated monitoring of maturity dates, validity periods, renewal or replacement requirements and other prescribed timelines. | Detailed Description; Expected Solution item 4 |
| R6 | Configurable reminders before deadlines; overdue or unresolved cases flagged for follow-up. | Detailed Description; Expected Solution items 4 and 7 |
| R7 | Track submission of renewed or replacement instruments with complete change history. | Expected Solution item 5 |
| R8 | Record and track release, discharge or refund requests, subject to regulations, fulfilment of conditions and authorization by the competent authority. | Detailed Description; Expected Solution item 6 |
| R9 | Centralized dashboard: active, expiring, matured, renewed, released and pending instruments. | Detailed Description; Expected Solution item 8 |
| R10 | Search records, review document histories, update permitted fields, record scrutiny observations, monitor each case. | Detailed Description |
| R11 | Automated reports: pending verifications, upcoming maturity dates, missing documents, cases requiring intervention. | Detailed Description; Expected Solution item 8 |
| R12 | Notify stakeholders about pending verification, approaching deadlines, overdue actions and unresolved cases, with escalation. | Expected Solution item 7 |
| R13 | Role-based access, secure document storage, appropriate encryption, audit trails, controlled access to financial and institutional information. | Detailed Description; Expected Solution item 9 |
| R14 | Integration with existing AICTE systems and bank verification services, where technically feasible and formally authorized, to reduce duplicate entry and improve reliability. | Detailed Description; Expected Solution item 10 |
| R15 | Prototype demonstrates measurable improvements: record accuracy, verification turnaround time, timely renewal monitoring, reduction in manual tracking effort, visibility into pending cases. | Expected Solution, closing paragraph |
| R16 | Testing covers: new FDR submission, validity tracking, approaching maturity, renewal, discrepancy identification, authorized release processing. | Expected Solution, closing paragraph |

## 4. What the solution must demonstrate to the evaluators

The closing paragraph of the official text names the evaluation evidence directly. The prototype must show, with numbers where possible:

1. Record accuracy (R15): how often stored records match the source document and the bank's confirmation.
2. Verification turnaround time (R15): time from submission to a verified state.
3. Timely renewal monitoring (R15): no instrument reaches maturity without a reminder and an owner.
4. Reduction in manual tracking effort (R15): which manual steps disappear.
5. Visibility into pending cases (R15): every pending item has a state, an owner and an age.
6. The six named test scenarios (R16), each runnable end to end in the demo.

## 5. Constraints and what must not be done

These come from the wording of the official text. They are hard constraints for the product.

| ID | Constraint | Basis in the official text |
|---|---|---|
| C1 | Never present institution-submitted data as bank-confirmed. Each value must carry its source. | "distinguish between information submitted by an institution and information independently confirmed by an authorized bank or financial source" |
| C2 | Use only legitimate, bank-issued verification mechanisms. No scraping of bank sites, no unofficial channels. | "verify available instrument details through legitimate bank-issued verification mechanisms wherever supported" |
| C3 | Integrations with AICTE systems and banks only where formally authorized. In the prototype these are simulated and clearly labelled. | "Where technically feasible and formally authorized" |
| C4 | Release, discharge and refund are never automatic. They require prescribed conditions and competent-authority authorization. | "subject to applicable regulations, fulfillment of prescribed conditions and authorization by the competent authority" |
| C5 | Discrepancy detection flags items for scrutiny. It does not decide outcomes. | "flag discrepancies requiring further scrutiny" |
| C6 | Financial and institutional information is access-controlled, encrypted and audited. | "role-based access, secure document storage, appropriate encryption, audit trails and controlled access" |
| C7 | Rules must follow AICTE requirements and authorized financial procedures, so they must be configurable rather than hard-coded. | "ensuring adherence to applicable AICTE requirements and authorized financial procedures" |

## 6. Regulatory context from the Approval Process Handbook (our research, not part of the official text)

The problem statement refers to "applicable regulations, approval process handbooks and prescribed administrative procedures" without quoting them. We read the AICTE Approval Process Handbook 2024-2027 (APH) to ground the product in the actual rules. Page numbers refer to the 231-page PDF listed in `RESEARCH.md`. These provisions shape our rule engine and are configurable, because the handbook is revised each cycle.

| Topic | APH provision (paraphrased, with clause) |
|---|---|
| Who pays | New technical institutions other than Government or Government-aided institutions create a Security Deposit when recommended for Letter of Approval (Clause 1.12). Existing institutions in existence for more than 5 years under Clause 1.3.3 are exempt (1.12 i). |
| Amount | Table 1.4, in Rs. lakh, per programme and level: Engineering and Technology 15 (Diploma), 35 (UG), 15 (PG); Planning, Applied Arts and Crafts, Design, HMCT 15 each level; Computer Applications and Management 5 (UG), 15 (PG). The amount is summed across programmes and levels applied, and is doubled for a private leased building or land. |
| Term | The deposit remains with the Council for 10 years. Interest is retained by AICTE. The principal returns to the Trust, Society or Company at the end of the term, unless the term is extended case by case or the deposit is forfeited for violations, non-performance or complaints (1.12 iv, v). |
| Form | Affidavit 6 describes the deposit as held "in the joint name of the Secretary, <Name of the Trust> and the AICTE", for 8 or 10 years. Forms include joint FDR, RPGF (Refundable Performance Guaranty Fund) and RTGS. |
| Deadline and penalty | Payment proof with Affidavit 3 within 15 days of intimation; otherwise a 10% penalty up to 31 May and 20% up to 31 July of the calendar year, after which approval is withdrawn (Chapter II, item f). |
| Premature encashment | FDRs encashed before maturity, or no deposit at LoA: 10% penalty. Institutions with a smaller or shorter FDR than prescribed must top it up (Clause 7.7). |
| Release documents | Application letter, Affidavit 6, copy of the FDR (or RPGF and DD details, or online payment proof), latest LoA or EoA (Clause 6.46 a). |
| Release clearances | Clearance from the Public Grievance Redressal Cell (PGRC), the Vigilance Cell and other cells or bureaus that released grants (6.46 b). For FDR or RPGF, the Approval Bureau issues an NOC; for RTGS, the Council issues a sanction order (6.46 c, d). Financial embezzlement with government bodies or banks blocks release until that body issues an NOC (6.46 e). |
| Special releases | Conversion to a private or deemed university: release subject to no pending complaints or disciplinary proceedings (6.46 g). Progressive closure or merger: a university or board certificate that no students remain, unless already matured (6.46 h, i). |
| Closure penalties | Closure after an incomplete closure application: 10% penalty before release. Institutions that have not applied for EoA for six years: 50% penalty before release (2.21 h, i). |
| Lien during disputes | AICTE holds a lien over the FDR while a dispute among trustees is unresolved (2.20 d). |
| Online only | Release applications for FDR or RTGS are accepted only online, with status visible on the portal (APH general instructions, item 11). |
| Bank verification today | Certificate 3 is a bank manager's letterhead certificate stating that the FDRs are authentic, in the applicant's name and free of loans or mortgage. This is the manual verification the portal should digitize. |

## 7. Official requirements versus our proposals

To keep the boundary clear for evaluators and for implementation:

- **Official (must do):** R1 to R16 and C1 to C7 above.
- **Grounded in the APH (should do):** the deposit amount calculator from Table 1.4, the penalty rules, the release clearance chain from Clause 6.46, lien holds during disputes. These are not in the problem statement text but are the rules the Regulation Bureau applies, so the product treats them as configurable defaults.
- **Our proposals (differentiators):** field-level provenance, the simulated bank confirmation network with signed responses, ML-based document forensics, the forecast timeline ("time machine"), plain-language search, QR-verifiable letters. Each is listed in `PROJECT.md` with the requirement it serves.
- **Assumptions:** listed in `PROJECT.md` Section 13. None of them is presented to evaluators as fact.
