#!/bin/bash
# Installed on the host as /usr/local/bin/pramaan-autodeploy and run every 2 minutes by
# pramaan-autodeploy.timer. Deploys the newest commit on origin/main, whoever pushed it, with a
# read-only deploy key. If the new release fails to build, start or answer /readyz, the previous
# release is redeployed and the failed commit is not retried until a newer one arrives.
set -euo pipefail
source /etc/pramaan-autodeploy.env # BUCKET, REGION, REPO
exec 8>/run/pramaan-autodeploy.lock
flock -n 8 || exit 0

ROOT=/opt/pramaan
GIT_DIR=$ROOT/repo.git
export GIT_DIR
export GIT_SSH_COMMAND="ssh -i /root/.ssh/pramaan_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
[ -d "$GIT_DIR" ] || git init -q --bare "$GIT_DIR"
git fetch -q --depth 1 "$REPO" main
SHA=$(git rev-parse --short=7 FETCH_HEAD)
CURRENT=$(basename "$(readlink -f "$ROOT/current" 2>/dev/null || echo none)")
[ "$SHA" = "$CURRENT" ] && exit 0
mkdir -p "$ROOT/failed"
[ -f "$ROOT/failed/$SHA" ] && exit 0

REL=$ROOT/releases/$SHA
rm -rf "$REL" && mkdir -p "$REL"
git archive FETCH_HEAD | tar -x -C "$REL"
unset GIT_DIR
echo "deploying $SHA ($(git --git-dir="$ROOT/repo.git" log -1 --format='%an: %s' FETCH_HEAD)), was $CURRENT"

URL=$(aws ssm get-parameter --region "$REGION" --name /pramaan/PUBLIC_BASE_URL \
  --query Parameter.Value --output text)
healthy() {
  for _ in $(seq 18); do
    curl -fsS --max-time 5 "$URL/api/v1/readyz" | grep -q '"status":"ok"' && return 0
    sleep 10
  done
  return 1
}

if bash "$REL/infra/aws/remote-deploy.sh" "$REL" "$BUCKET" "$REGION" 0 && healthy; then
  echo "deployed $SHA"
else
  echo "release $SHA failed; restoring $CURRENT"
  touch "$ROOT/failed/$SHA"
  if [ -d "$ROOT/releases/$CURRENT" ]; then
    bash "$ROOT/releases/$CURRENT/infra/aws/remote-deploy.sh" "$ROOT/releases/$CURRENT" \
      "$BUCKET" "$REGION" 0
  fi
  exit 1
fi
