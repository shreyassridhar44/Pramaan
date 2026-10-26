#!/bin/bash
# Runs on the host (through SSM Run Command) from an unpacked release directory. Writes infra/.env
# from SSM Parameter Store, builds and starts the stack, migrates, and seeds on the first deploy
# or when SEED=1. Installs the nightly database backup timer.
#   bash infra/aws/remote-deploy.sh <release-dir> <bucket> <region> [seed]
set -euo pipefail
REL=$1
BUCKET=$2
REGION=$3
SEED=${4:-0}
NAME=pramaan
cd "$REL"

for _ in $(seq 60); do [ -f /opt/pramaan/.bootstrapped ] && break; sleep 5; done
[ -f /opt/pramaan/.bootstrapped ] || { echo "host bootstrap did not finish"; exit 1; }

param() {
  aws ssm get-parameter --region "$REGION" --name "/$NAME/$1" --with-decryption \
    --query Parameter.Value --output text
}
umask 077
{
  for k in POSTGRES_PASSWORD SESSION_SECRET LETTER_SIGNING_KEY_B64 ORIGIN_SECRET MAIL_UI_AUTH \
    PUBLIC_BASE_URL; do
    echo "$k=$(param "$k")"
  done
  echo "STORAGE_BACKEND=local"
  echo "AWS_REGION=$REGION"
} > infra/.env
umask 022

compose() { docker compose -f infra/compose.yml "$@"; }
compose build
compose up -d postgres valkey mailpit
compose run --rm api alembic upgrade head
if [ "$SEED" = "1" ] || [ ! -f /opt/pramaan/.seeded ]; then
  compose run --rm api python -m scripts.seed
  touch /opt/pramaan/.seeded
fi
compose up -d --remove-orphans
ln -sfn "$REL" /opt/pramaan/current

# Nightly backup to S3 (kept 14 days by the bucket lifecycle rule).
install -m 0755 infra/aws/backup.sh /usr/local/bin/pramaan-backup
printf 'BUCKET=%s\n' "$BUCKET" > /etc/pramaan-backup.env
install -m 0644 infra/aws/pramaan-backup.service infra/aws/pramaan-backup.timer \
  /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pramaan-backup.timer

# Keep the three newest releases and clear old images and build cache.
find /opt/pramaan/releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -rn | tail -n +4 | cut -d' ' -f2- | xargs -r rm -rf
docker image prune -f >/dev/null
docker builder prune -f --filter until=72h >/dev/null

sleep 10
compose ps
echo "readyz: $(curl -s -H "X-Pramaan-Origin: $(param ORIGIN_SECRET)" \
  http://127.0.0.1/api/v1/readyz)"
