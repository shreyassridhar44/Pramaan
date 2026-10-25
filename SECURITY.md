# Security

## 1. Reporting

This is a hackathon prototype with synthetic data. To report a vulnerability, open a private security advisory on the GitHub repository or email the maintainer listed in the repository profile. Do not open a public issue.

## 2. Threat model (summary)

| Threat | Example | Controls |
|---|---|---|
| Forged or altered receipts | Edited amount or maturity date on a scan | Bank confirmation with signed responses; document forensics signals; duplicate detection; declared values never treated as confirmed |
| Spoofed bank confirmation | Fake "confirmed" response | Ed25519 signatures verified against a key registry; raw message stored; unknown keys rejected |
| Privilege misuse | Officer viewing other regions; institution viewing another institution | Role and scope checks in API dependencies and SQL filters; deny by default; audit of sensitive reads |
| Unauthorised release | Release without clearances | State machine guards; only authorised roles can issue NOC or sanction; every action audited |
| Tampering with records | Direct database edits | Hash-chained audit log with verification; corrections only through the application with reasons |
| Account takeover | Password guessing | Argon2id hashing; rate limiting; lockout after repeated failures; session timeout |
| Web attacks | XSS, CSRF, injection | React escaping and a strict Content Security Policy; CSRF token header; SQLAlchemy parameterised queries; Pydantic validation |
| Malicious uploads | Oversized or disguised files | MIME sniffing, extension allowlist (PDF, PNG, JPEG), size limit, rendering in a worker with resource limits, no execution |
| Letter forgery | Fake NOC | Ed25519-signed QR token checked on the public verify page against the published key; the page reads the letter's live state, so revoked and superseded letters show as such; the private key lives only in `LETTER_SIGNING_KEY_B64` (required in production) |
| Secret leakage | Keys in git | Secrets only in environment or SSM Parameter Store; `.env` ignored; secret scanning in CI |
| LLM misuse | Prompt injection through the search box | Model output must validate against a fixed filter schema; model has no data access or write ability |

## 3. Controls

- **Authentication:** email and password with Argon2id; signed httpOnly, Secure, SameSite=Lax session cookie; idle timeout 8 hours for officers, 2 hours for others.
- **Authorisation:** role plus scope, enforced server-side for every endpoint; tests for denials.
- **Transport:** HTTPS via CloudFront; HSTS; origin accepts traffic only from CloudFront.
- **Data at rest:** S3 server-side encryption; EBS volume encryption; database credentials in SSM SecureString.
- **Headers:** Content-Security-Policy, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, frame-ancestors none.
- **Audit:** append-only hash chain; verification endpoint; exports audited.
- **Dependencies:** pinned versions; `pip-audit` and `npm audit` in CI; Dependabot alerts.
- **Backups:** nightly database dump to S3 with lifecycle expiry; restore drill in Step 10.

## 4. Known limitations of the prototype

- Single EC2 instance; no high availability.
- Demo personas allow one-click sign-in; disabled when `DEMO_MODE=false`.
- Simulated bank keys are generated locally and are not real bank keys.
