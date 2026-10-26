# AWS deployment scripts

One Graviton instance runs the whole stack with Docker Compose (`infra/compose.yml`); CloudFront in front gives HTTPS and is the only way in. `DEPLOYMENT.md` Section 2 explains the design and the costs; DECISION D33 records why the web app is served from the instance.

Run from Git Bash or any Unix shell with the AWS CLI v2, `git` and `openssl`. Default region `ap-south-1`; override `REGION`, `NAME` or `INSTANCE_TYPE` in the environment (see `config.sh`).

| Script | What it does |
|---|---|
| `provision.sh` | Creates or reuses: the S3 bucket (releases and backups, private, encrypted, lifecycle), the instance role (Session Manager, its bucket, `/pramaan/*` parameters), generated secrets in SSM Parameter Store, a security group open on port 80 to CloudFront only, the t4g.medium instance, an Elastic IP, and the CloudFront distribution with a secret origin header. Prints the public URL. Safe to rerun. |
| `deploy.sh` | Packs the committed `HEAD` with `git archive`, uploads it, and runs `remote-deploy.sh` on the instance through SSM Run Command: writes `infra/.env` from SSM, builds the images, migrates, seeds on the first deploy (`SEED=1` reseeds), starts everything and installs the nightly backup timer. |
| `ops.sh` | `status`, `start`, `stop`, `logs [service]`, `shell` (Session Manager), `backup`, `inbox-login`. |

First time:

```bash
bash infra/aws/provision.sh
bash infra/aws/deploy.sh          # 10 to 20 minutes the first time (image builds on the instance)
```

Later deploys: commit, then `bash infra/aws/deploy.sh`. To save money between demos: `bash infra/aws/ops.sh stop`, and `start` before the next one; the URL stays the same.

Notes:
- No SSH port is open. Use `bash infra/aws/ops.sh shell` (needs the Session Manager plugin) or `ops.sh logs`.
- Secrets never leave SSM except into `infra/.env` on the instance (mode 600). The scripts never print them, except `ops.sh inbox-login`, which prints the login for the captured inbox at `/mail/`.
- Backups: `pramaan-db-<time>.sql.gz` and `pramaan-storage-<time>.tar.gz` in `s3://<bucket>/backups/`, nightly at 02:00 IST and on `ops.sh backup`.
- Restore drill, on the instance from `/opt/pramaan/current`: copy both files down with `aws s3 cp`, then `gunzip -c pramaan-db-<time>.sql.gz | docker compose -f infra/compose.yml exec -T postgres psql -U pramaan pramaan` into an empty database, and `docker compose -f infra/compose.yml exec -T api tar -xzf - -C /data < pramaan-storage-<time>.tar.gz`.
