#!/usr/bin/env bash
# Creates the Pramaan deployment in one AWS account and region (DEPLOYMENT.md Section 2). Every
# step looks for an existing resource first, so the script can be rerun safely. Needs the AWS CLI
# with credentials that can manage S3, IAM, SSM, EC2 (and CloudFront). Prints the public URL.
#   bash infra/aws/provision.sh                  # Caddy and Let's Encrypt on the instance
#   EDGE=cloudfront bash infra/aws/provision.sh  # CloudFront in front (account must be verified)
set -euo pipefail
export MSYS_NO_PATHCONV=1 AWS_PAGER=""
cd "$(dirname "$0")"
source ./config.sh

log() { echo "[provision] $*"; }
gen() { openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-"${1:-40}"; }

# 1. Bucket for release bundles and backups.
if ! aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1; then
  log "creating bucket $BUCKET"
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
fi
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" --lifecycle-configuration '{
  "Rules":[
    {"ID":"backups","Filter":{"Prefix":"backups/"},"Status":"Enabled","Expiration":{"Days":14}},
    {"ID":"releases","Filter":{"Prefix":"releases/"},"Status":"Enabled","Expiration":{"Days":30}}
  ]}'

# 2. Instance role: Session Manager, the bucket, its own SSM parameters, CloudWatch Logs.
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  log "creating role $ROLE"
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document '{
    "Version":"2012-10-17",
    "Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},
      "Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
fi
aws iam put-role-policy --role-name "$ROLE" --policy-name pramaan-app --policy-document "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:PutObject\"],
      \"Resource\":\"arn:aws:s3:::$BUCKET/*\"},
    {\"Effect\":\"Allow\",\"Action\":\"s3:ListBucket\",\"Resource\":\"arn:aws:s3:::$BUCKET\"},
    {\"Effect\":\"Allow\",\"Action\":[\"ssm:GetParameter\",\"ssm:GetParameters\",
      \"ssm:GetParametersByPath\"],
      \"Resource\":\"arn:aws:ssm:$REGION:$ACCOUNT:parameter/$NAME/*\"},
    {\"Effect\":\"Allow\",\"Action\":\"kms:Decrypt\",\"Resource\":\"*\",
      \"Condition\":{\"StringEquals\":{\"kms:ViaService\":\"ssm.$REGION.amazonaws.com\"}}},
    {\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",
      \"logs:PutLogEvents\",\"logs:DescribeLogStreams\"],
      \"Resource\":\"arn:aws:logs:$REGION:$ACCOUNT:log-group:/$NAME*\"}
  ]}"
if ! aws iam get-instance-profile --instance-profile-name "$ROLE" >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name "$ROLE" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$ROLE" --role-name "$ROLE"
  log "waiting for the instance profile to propagate"
  sleep 15
fi

# 3. Secrets in SSM Parameter Store, generated once and never printed.
put_secret() {
  if ! aws ssm get-parameter --region "$REGION" --name "/$NAME/$1" >/dev/null 2>&1; then
    log "creating parameter /$NAME/$1"
    aws ssm put-parameter --region "$REGION" --name "/$NAME/$1" --type SecureString \
      --value "$2" >/dev/null
  fi
}
put_secret POSTGRES_PASSWORD "$(gen 32)"
put_secret SESSION_SECRET "$(gen 48)"
put_secret ORIGIN_SECRET "$(gen 40)"
put_secret MAIL_UI_AUTH "demo:$(gen 16)"
put_secret LETTER_SIGNING_KEY_B64 \
  "$(openssl genpkey -algorithm ed25519 -outform DER | tail -c 32 | base64 | tr -d '\n')"

# 4. Security group: port 80 from CloudFront's origin-facing addresses (step 7 opens 80 and 443 to
#    everyone when Caddy is the edge). No SSH; Session Manager is used instead.
VPC=$(aws ec2 describe-vpcs --region "$REGION" --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --region "$REGION" \
  --filters Name=group-name,Values="$NAME-web" Name=vpc-id,Values="$VPC" \
  --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = "None" ]; then
  log "creating security group $NAME-web"
  SG=$(aws ec2 create-security-group --region "$REGION" --group-name "$NAME-web" --vpc-id "$VPC" \
    --description "Pramaan web" --query GroupId --output text)
  PL=$(aws ec2 describe-managed-prefix-lists --region "$REGION" \
    --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing \
    --query 'PrefixLists[0].PrefixListId' --output text)
  aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG" \
    --ip-permissions "IpProtocol=tcp,FromPort=80,ToPort=80,PrefixListIds=[{PrefixListId=$PL}]" \
    >/dev/null
fi

# 5. Instance (Graviton, encrypted gp3, IMDSv2 with hop limit 2 so containers can use the role).
INSTANCE=$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=tag:Name,Values="$NAME" Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ "$INSTANCE" = "None" ]; then
  AMI=$(aws ssm get-parameter --region "$REGION" \
    --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
    --query Parameter.Value --output text)
  log "launching $INSTANCE_TYPE from $AMI"
  INSTANCE=$(aws ec2 run-instances --region "$REGION" --image-id "$AMI" \
    --instance-type "$INSTANCE_TYPE" --iam-instance-profile Name="$ROLE" \
    --security-group-ids "$SG" --user-data file://user-data.sh \
    --metadata-options HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled \
    --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3","Encrypted":true,"DeleteOnTermination":true}}]' \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME},{Key=project,Value=$NAME}]" \
      "ResourceType=volume,Tags=[{Key=Name,Value=$NAME},{Key=project,Value=$NAME}]" \
    --query 'Instances[0].InstanceId' --output text)
  aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE"
fi
log "instance $INSTANCE"

# 6. Elastic IP so the address (and the URL) survives a stop and start.
ALLOC=$(aws ec2 describe-addresses --region "$REGION" --filters Name=tag:Name,Values="$NAME" \
  --query 'Addresses[0].AllocationId' --output text)
if [ "$ALLOC" = "None" ]; then
  ALLOC=$(aws ec2 allocate-address --region "$REGION" --domain vpc \
    --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME}]" \
    --query AllocationId --output text)
fi
aws ec2 associate-address --region "$REGION" --instance-id "$INSTANCE" --allocation-id "$ALLOC" \
  --allow-reassociation >/dev/null
IP=$(aws ec2 describe-addresses --region "$REGION" --allocation-ids "$ALLOC" \
  --query 'Addresses[0].PublicIp' --output text)
ORIGIN="ec2-${IP//./-}.$REGION.compute.amazonaws.com"
log "origin $ORIGIN"

# 7a. Default edge: Caddy on the instance with a Let's Encrypt certificate for an sslip.io name
#     that resolves to the Elastic IP. Ports 80 (certificate challenge, redirect) and 443 open.
if [ "$EDGE" = "caddy" ]; then
  for port in 80 443; do
    aws ec2 authorize-security-group-ingress --region "$REGION" --group-id "$SG"       --ip-permissions "IpProtocol=tcp,FromPort=$port,ToPort=$port,IpRanges=[{CidrIp=0.0.0.0/0}]"       >/dev/null 2>&1 || true
  done
  SITE="${IP//./-}.sslip.io"
  aws ssm put-parameter --region "$REGION" --name "/$NAME/SITE_ADDRESS" --type String     --value "$SITE" --overwrite >/dev/null
  aws ssm put-parameter --region "$REGION" --name "/$NAME/PUBLIC_BASE_URL" --type String     --value "https://$SITE" --overwrite >/dev/null
  log "done: instance $INSTANCE"
  log "public URL: https://$SITE (the certificate is issued on the first deploy)"
  log "next: bash infra/aws/deploy.sh"
  exit 0
fi

# 7b. EDGE=cloudfront: HTTPS at CloudFront, the secret header to the origin, nothing cached except
#     the hashed web assets. Needs an account that AWS has verified for CloudFront.
aws ssm put-parameter --region "$REGION" --name "/$NAME/SITE_ADDRESS" --type String   --value ":80" --overwrite >/dev/null
DIST=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='$NAME'].Id | [0]" --output text)
if [ "$DIST" = "None" ] || [ -z "$DIST" ]; then
  ORIGIN_SECRET=$(aws ssm get-parameter --region "$REGION" --name "/$NAME/ORIGIN_SECRET" \
    --with-decryption --query Parameter.Value --output text)
  CFG=$(mktemp .cloudfront.XXXXXX)
  cat >"$CFG" <<EOF
{
  "CallerReference": "$NAME-$(date +%s)",
  "Comment": "$NAME",
  "Enabled": true,
  "PriceClass": "PriceClass_200",
  "HttpVersion": "http2and3",
  "ViewerCertificate": {"CloudFrontDefaultCertificate": true},
  "Origins": {"Quantity": 1, "Items": [{
    "Id": "web", "DomainName": "$ORIGIN",
    "CustomHeaders": {"Quantity": 1, "Items": [
      {"HeaderName": "X-Pramaan-Origin", "HeaderValue": "$ORIGIN_SECRET"}]},
    "CustomOriginConfig": {"HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "http-only",
      "OriginReadTimeout": 60, "OriginKeepaliveTimeout": 5,
      "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]}}
  }]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "web", "ViewerProtocolPolicy": "redirect-to-https", "Compress": true,
    "AllowedMethods": {"Quantity": 7, "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}},
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "216adef6-5c7f-47e4-b989-5492eafa07d3"
  },
  "CacheBehaviors": {"Quantity": 1, "Items": [{
    "PathPattern": "/assets/*", "TargetOriginId": "web",
    "ViewerProtocolPolicy": "redirect-to-https", "Compress": true,
    "AllowedMethods": {"Quantity": 2, "Items": ["GET","HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}},
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }]}
}
EOF
  log "creating CloudFront distribution"
  DIST=$(aws cloudfront create-distribution --distribution-config "file://$CFG" \
    --query Distribution.Id --output text)
  rm -f "$CFG"
fi
DOMAIN=$(aws cloudfront get-distribution --id "$DIST" --query Distribution.DomainName --output text)
aws ssm put-parameter --region "$REGION" --name "/$NAME/PUBLIC_BASE_URL" --type String \
  --value "https://$DOMAIN" --overwrite >/dev/null

log "done: instance $INSTANCE, distribution $DIST"
log "public URL: https://$DOMAIN (CloudFront takes a few minutes to deploy)"
log "next: bash infra/aws/deploy.sh"
