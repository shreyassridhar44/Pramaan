# Shared settings for the AWS scripts. Override any of them in the environment.
REGION=${REGION:-ap-south-1}
NAME=${NAME:-pramaan}
INSTANCE_TYPE=${INSTANCE_TYPE:-t4g.small}
ACCOUNT=${ACCOUNT:-$(aws sts get-caller-identity --query Account --output text)}
BUCKET=${BUCKET:-$NAME-$ACCOUNT-$REGION}
ROLE=${ROLE:-$NAME-ec2}

instance_id() {
  aws ec2 describe-instances --region "$REGION" \
    --filters Name=tag:Name,Values="$NAME" \
    Name=instance-state-name,Values=pending,running,stopping,stopped \
    --query 'Reservations[0].Instances[0].InstanceId' --output text
}
