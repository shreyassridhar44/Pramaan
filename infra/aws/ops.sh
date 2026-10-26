#!/usr/bin/env bash
# Day-to-day operations on the deployment.
#   bash infra/aws/ops.sh status | start | stop | logs [service] | shell | backup | inbox-login
# "stop" halts the instance to save money (the disk and the Elastic IP are still billed); "start"
# brings it back on the same URL, and the containers restart on their own.
set -euo pipefail
export MSYS_NO_PATHCONV=1 AWS_PAGER=""
cd "$(dirname "$0")"
source ./config.sh
INSTANCE=$(instance_id)

run() {
  local id params
  params=$(mktemp .params.XXXXXX)
  printf '{"commands":["%s"]}' "$1" > "$params"
  id=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" \
    --document-name AWS-RunShellScript --parameters "file://$params" \
    --query Command.CommandId --output text)
  rm -f "$params"
  aws ssm wait command-executed --region "$REGION" --command-id "$id" \
    --instance-id "$INSTANCE" 2>/dev/null || true
  aws ssm get-command-invocation --region "$REGION" --command-id "$id" \
    --instance-id "$INSTANCE" --query '[StandardOutputContent,StandardErrorContent]' --output text
}
state() {
  aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE" \
    --query 'Reservations[0].Instances[0].State.Name' --output text
}

case "${1:-status}" in
  status)
    echo "$INSTANCE $(state)"
    if [ "$(state)" = running ]; then
      run 'cd /opt/pramaan/current && docker compose -f infra/compose.yml ps'
    fi
    ;;
  start)
    aws ec2 start-instances --region "$REGION" --instance-ids "$INSTANCE" >/dev/null
    aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE"
    echo "running; the containers come up within a minute or two"
    ;;
  stop)
    aws ec2 stop-instances --region "$REGION" --instance-ids "$INSTANCE" >/dev/null
    echo "stopping $INSTANCE"
    ;;
  logs)
    run "cd /opt/pramaan/current && docker compose -f infra/compose.yml logs --tail 80 ${2:-api}"
    ;;
  shell)
    aws ssm start-session --region "$REGION" --target "$INSTANCE"
    ;;
  backup)
    run '/usr/local/bin/pramaan-backup'
    ;;
  inbox-login)
    aws ssm get-parameter --region "$REGION" --name "/$NAME/MAIL_UI_AUTH" --with-decryption \
      --query Parameter.Value --output text
    ;;
  *)
    echo "unknown command: $1"
    exit 1
    ;;
esac
