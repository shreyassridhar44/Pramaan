# Deployment

## 1. Local

Prerequisites: Docker Desktop, Node.js 22 or later, Python 3.12, `uv`.

1. `cp .env.example .env` and adjust if needed.
2. `docker compose -f infra/compose.dev.yml up -d` starts Postgres, Redis, MinIO and Mailpit.
3. API: `cd services/api && uv sync && uv run alembic upgrade head && uv run python -m scripts.seed && uv run uvicorn app.main:app --reload`
4. Worker: `cd services/api && uv run arq app.workers.settings.WorkerSettings`
5. Web: `cd apps/web && npm install && npm run dev`, then open http://localhost:5173
6. Mailpit inbox: http://localhost:8025; MinIO console: http://localhost:9001

## 2. AWS (ap-south-1)

Budget target: about $21 to $24 per month, so that a $100 credit lasts into early 2027. Prices checked with the AWS Pricing API on 24 October 2026.

### 2.1 Resources

| Resource | Configuration | Estimated monthly cost |
|---|---|---|
| EC2 | t4g.medium (2 vCPU, 4 GB, Graviton), Amazon Linux 2023 arm64, 30 GB gp3 encrypted, 2 GB swap | $16.4 + $2.7 |
| S3 | `pramaan-web-<suffix>` (static site, private, CloudFront OAC); `pramaan-docs-<suffix>` (documents, letters, backups; SSE; lifecycle on `backups/` 14 days) | under $1 |
| CloudFront | One distribution: default behaviour to the web bucket; `/api/*` and `/verify/*` to the EC2 origin with a secret origin header; HTTPS with the default certificate | free tier at demo volume |
| SES | Verified sender identity; sandbox is enough for demo recipients | free tier |
| Bedrock | India-resident Claude Haiku 4.5 profile | about $1 to $3 |
| SSM Parameter Store | `/pramaan/*` SecureString parameters | free (standard tier) |
| CloudWatch Logs | Container logs, 7-day retention | under $1 |

### 2.2 Steps

Scripts live in `infra/aws/` and are written in Step 10. Each step is idempotent.

1. Create the two buckets with Block Public Access, default encryption, and the lifecycle rule.
2. Create the IAM role and instance profile with least privilege (buckets, SES send, Bedrock invoke on the chosen profile, SSM read `/pramaan/*`, CloudWatch Logs write).
3. Put secrets in SSM: database password, session secret, letter signing key, origin header secret.
4. Launch the EC2 instance with the role, a security group that allows port 80 only from the CloudFront origin-facing managed prefix list, and SSH only through Systems Manager Session Manager (no open port 22).
5. On the instance: install Docker and the Compose plugin, clone the repository, pull secrets from SSM into `.env`, `docker compose -f infra/compose.yml up -d --build`, run migrations and the seed.
6. Build the web app locally or in CI with the production API base path and sync `apps/web/dist` to the web bucket.
7. Create the CloudFront distribution with the two origins and behaviours; invalidate after each web deploy.
8. Verify: `https://<distribution>.cloudfront.net/api/v1/readyz`, sign in, run the smoke test.
9. Enable the nightly backup container; run a restore drill once.

### 2.3 Operating the budget

- Stop the instance when not needed (EBS charges continue, about $2.7 per month); start it before evaluations and demos.
- Set an AWS Budget alarm at $20 per month and $80 cumulative.

## 3. Health checks

- `/api/v1/healthz`: process alive.
- `/api/v1/readyz`: database, Redis, object storage and model files available.
- Docker health checks restart unhealthy containers; CloudWatch alarm on repeated restarts (optional).

## 4. Rollback

Each deploy is a Git tag. Roll back with `git checkout <previous-tag> && docker compose up -d --build` and re-sync the previous web build from the tagged CI artifact.
