#!/usr/bin/env bash
# Ships the committed HEAD to the host and (re)starts the stack. SEED=1 reseeds the demo data.
#   bash infra/aws/deploy.sh
set -euo pipefail
export MSYS_NO_PATHCONV=1 AWS_PAGER=""
cd "$(dirname "$0")"
source ./config.sh
SEED=${SEED:-0}

INSTANCE=$(instance_id)
[ "$INSTANCE" != "None" ] || { echo "no instance; run provision.sh first"; exit 1; }
SHA=$(git rev-parse --short HEAD)
[ -z "$(git status --porcelain)" ] || echo "[deploy] note: uncommitted changes are not shipped"

TMP=$PWD/$(mktemp -d .release.XXXXXX)
git -C ../.. archive --format=tar.gz -o "$TMP/$SHA.tar.gz" HEAD
aws s3 cp --only-show-errors "$(basename "$TMP")/$SHA.tar.gz" "s3://$BUCKET/releases/$SHA.tar.gz"
rm -rf "$TMP"
echo "[deploy] uploaded release $SHA"

REL=/opt/pramaan/releases/$SHA
PARAMS=$(mktemp .params.XXXXXX)
cat > "$PARAMS" <<EOF
{
  "executionTimeout": ["3600"],
  "commands": [
    "set -e",
    "rm -rf $REL && mkdir -p $REL",
    "aws s3 cp --only-show-errors s3://$BUCKET/releases/$SHA.tar.gz /tmp/$SHA.tar.gz",
    "tar -xzf /tmp/$SHA.tar.gz -C $REL && rm /tmp/$SHA.tar.gz",
    "bash $REL/infra/aws/remote-deploy.sh $REL $BUCKET $REGION $SEED"
  ]
}
EOF
CMD_ID=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript --timeout-seconds 600 \
  --comment "pramaan deploy $SHA" --parameters "file://$PARAMS" \
  --query Command.CommandId --output text)
rm -f "$PARAMS"
echo "[deploy] running on $INSTANCE (command $CMD_ID); the first build takes 10 to 20 minutes"

while :; do
  STATUS=$(aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" \
    --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || echo Pending)
  case "$STATUS" in Pending | InProgress | Delayed) sleep 20 ;; *) break ;; esac
done
out() {
  aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" \
    --instance-id "$INSTANCE" --query "$1" --output text
}
out StandardOutputContent | tail -n 30
echo "[deploy] status: $STATUS"
if [ "$STATUS" != "Success" ]; then
  out StandardErrorContent | tail -n 40
  exit 1
fi
echo "[deploy] live at $(aws ssm get-parameter --region "$REGION" --name "/$NAME/PUBLIC_BASE_URL" \
  --query Parameter.Value --output text)"
