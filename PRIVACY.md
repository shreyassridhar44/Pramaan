# Privacy

Pramaan handles institutional financial records and personal data of institution representatives and officials. This document describes how the design protects that data. The prototype uses only synthetic data.

## 1. Data inventory

| Category | Examples | Purpose | Retention (proposed default) |
|---|---|---|---|
| Institution data | Name, AICTE ID, trust name, address, programmes | Regulatory record | As per AICTE record policy |
| Financial instrument data | FDR number, bank, amount, dates, lien | Core purpose | Term of deposit plus the AICTE retention period |
| Documents | FDR scans, affidavits, LoA or EoA, letters | Evidence | Same as the instrument |
| Personal data of representatives | Name, designation, email, phone of trust secretary or accounts officer | Communication, accountability | While the user account is active, plus the audit period |
| Officer and bank user data | Name, role, email, sign-in times | Access control, audit | While active, plus the audit period |
| Audit log | Actions, timestamps, actor | Accountability | Not deleted; append-only |

## 2. Principles applied

- **Purpose limitation.** Data is used only to manage security deposits under AICTE rules.
- **Data minimisation.** No Aadhaar, PAN or bank account numbers of individuals are collected. FDR numbers and branch codes are collected because the instrument requires them.
- **Access control.** Roles and scopes (region, institution, bank, cell) restrict who sees what; institution users see only their own institution.
- **Transparency.** Institution users can see every value recorded about their instruments and its source.
- **Accountability.** Every view of a document and every export is audited.
- **Security.** See `SECURITY.md`.

## 3. Alignment with the Digital Personal Data Protection Act, 2023

The design follows the Act's principles (notice, purpose limitation, minimisation, accuracy, storage limitation, security safeguards, accountability). It has not been assessed for compliance. A production deployment would need AICTE's data protection review, a notice for data principals, and a defined grievance channel.

## 4. Third parties

| Party | Data shared | Basis |
|---|---|---|
| Amazon Web Services (ap-south-1) | All application data, as the hosting provider | Hosting in India |
| Amazon Bedrock (India-resident inference profile) | Officer query text only, no records | Search feature; can be disabled |
| Banks (simulated in the prototype) | Instrument identifiers needed for confirmation | Verification of the deposit |
| Email provider (Amazon SES) | Recipient address and notice text | Notifications |

## 5. Data subject requests

In production, requests for access or correction from representatives would be handled through the institution portal (correction requests are recorded as observations with reasons) and AICTE's grievance process.
