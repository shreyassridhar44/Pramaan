#!/bin/bash
# Installed on the host as /usr/local/bin/pramaan-backup and run nightly by pramaan-backup.timer.
# Copies the database and the document store to S3 (the bucket keeps backups for 14 days).
set -euo pipefail
source /etc/pramaan-backup.env
cd /opt/pramaan/current
stamp=$(date -u +%Y%m%dT%H%M%SZ)
db=/tmp/pramaan-db-$stamp.sql.gz
files=/tmp/pramaan-storage-$stamp.tar.gz
docker compose -f infra/compose.yml exec -T postgres pg_dump -U pramaan pramaan | gzip > "$db"
docker compose -f infra/compose.yml exec -T api tar -czf - -C /data storage > "$files"
for f in "$db" "$files"; do
  aws s3 cp --only-show-errors "$f" "s3://$BUCKET/backups/$(basename "$f")"
  rm -f "$f"
done
echo "backed up $stamp to s3://$BUCKET/backups/"
