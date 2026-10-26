#!/usr/bin/env bash
# Sets the host up to deploy every new commit on main by itself, whoever pushes it. Run once,
# after provision.sh and a first deploy.sh:
#   bash infra/aws/enable-autodeploy.sh
# The host makes its own SSH key and GitHub gets the public half as a read-only deploy key, so the
# private key never leaves the instance. Registering the key needs a GitHub token with admin
# rights on the repository: GITHUB_TOKEN, or the credential git already uses for github.com.
set -euo pipefail
export MSYS_NO_PATHCONV=1 AWS_PAGER="" PYTHONUTF8=1 PYTHONIOENCODING=utf-8
cd "$(dirname "$0")"
source ./config.sh
GITHUB_REPO=${GITHUB_REPO:-shreyassridhar44/Pramaan}
INSTANCE=$(instance_id)

run() {
  local id params
  params=$(mktemp .params.XXXXXX)
  printf '%s' "$1" > "$params"
  id=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" \
    --document-name AWS-RunShellScript --parameters "file://$params" \
    --query Command.CommandId --output text)
  rm -f "$params"
  # `aws ssm wait command-executed` can return while the command is still running.
  while :; do
    case $(aws ssm get-command-invocation --region "$REGION" --command-id "$id" \
      --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || echo Pending) in
      Pending | InProgress | Delayed) sleep 3 ;;
      *) break ;;
    esac
  done
  aws ssm get-command-invocation --region "$REGION" --command-id "$id" \
    --instance-id "$INSTANCE" --query StandardOutputContent --output text
}

echo "[autodeploy] preparing the host"
PUB=$(run '{"commands":[
  "set -e",
  "dnf install -y -q git >/dev/null",
  "mkdir -p /root/.ssh && chmod 700 /root/.ssh",
  "[ -f /root/.ssh/pramaan_deploy ] || ssh-keygen -q -t ed25519 -N \"\" -C pramaan-autodeploy -f /root/.ssh/pramaan_deploy",
  "cat /root/.ssh/pramaan_deploy.pub"
]}' | grep -m1 '^ssh-ed25519 ')
case "$PUB" in ssh-ed25519\ *) ;; *) echo "could not read the host key: $PUB"; exit 1 ;; esac

TOKEN=${GITHUB_TOKEN:-$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill \
  2>/dev/null | sed -n 's/^password=//p')}
[ -n "$TOKEN" ] || { echo "set GITHUB_TOKEN (admin on $GITHUB_REPO)"; exit 1; }
KEY_BODY=$(echo "$PUB" | cut -d' ' -f2)
if curl -fsS -H "Authorization: Bearer $TOKEN" "https://api.github.com/repos/$GITHUB_REPO/keys" \
  | grep -q "$KEY_BODY"; then
  echo "[autodeploy] deploy key already registered"
else
  BODY=$(mktemp .params.XXXXXX)
  printf '{"title":"pramaan-autodeploy (%s)","key":"%s","read_only":true}' "$INSTANCE" "$PUB" \
    > "$BODY"
  curl -fsS -o /dev/null -X POST -H "Authorization: Bearer $TOKEN" \
    -H "Accept: application/vnd.github+json" --data "@$BODY" \
    "https://api.github.com/repos/$GITHUB_REPO/keys"
  rm -f "$BODY"
  echo "[autodeploy] registered a read-only deploy key on $GITHUB_REPO"
fi

echo "[autodeploy] installing the timer"
run "{\"commands\":[
  \"set -e\",
  \"echo BUCKET=$BUCKET > /etc/pramaan-autodeploy.env\",
  \"echo REGION=$REGION >> /etc/pramaan-autodeploy.env\",
  \"echo REPO=git@github.com:$GITHUB_REPO.git >> /etc/pramaan-autodeploy.env\",
  \"cd /opt/pramaan/current\",
  \"install -m 0755 infra/aws/autodeploy.sh /usr/local/bin/pramaan-autodeploy\",
  \"install -m 0644 infra/aws/pramaan-autodeploy.service infra/aws/pramaan-autodeploy.timer /etc/systemd/system/\",
  \"systemctl daemon-reload\",
  \"systemctl enable --now pramaan-autodeploy.timer\",
  \"systemctl list-timers pramaan-autodeploy.timer --no-pager | head -2\"
]}"
echo "[autodeploy] done: pushes to main go live within a few minutes."
echo "[autodeploy] watch it with: bash infra/aws/ops.sh autodeploy-log"
