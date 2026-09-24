#!/bin/bash
# Prepares a fresh EC2 instance: docker, directories, and deploy.sh.
#
# deploy.sh is NOT written inline here. It lives at infrastructure/aws/deploy.sh and is
# uploaded from this script, and again by the deploy workflow on every run. It used to be
# embedded here as an escaped one-liner, which meant three copies of the deploy logic in
# the repo — this one, the CloudFormation template's, and whatever was actually on the
# box. They drifted: the copy running in production lacked `set -e`, so when the disk
# filled and `docker pull` failed it carried on and restarted the OLD image while
# reporting success. Four consecutive green deploys shipped nothing.
#
# Run: bash infrastructure/aws/bootstrap-ec2.sh

INSTANCE_ID="i-0291cd8bc616ab51a"
REGION="ap-south-1"

echo "Sending bootstrap command to EC2..."

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --region "$REGION" \
  --parameters commands='[
    "set -e",
    "echo Installing packages...",
    "dnf install -y docker jq || true",
    "systemctl enable docker && systemctl start docker",
    "usermod -aG docker ec2-user",
    "mkdir -p /opt/startupvarsity /var/log/startupvarsity",
    "echo Bootstrap done - the deploy workflow installs deploy.sh",
    "chmod +x /opt/startupvarsity/deploy.sh",
    "echo Bootstrap complete - deploy.sh created"
  ]' \
  --query 'Command.CommandId' \
  --output text)

echo "Command ID: $COMMAND_ID"
echo "Uploading infrastructure/aws/deploy.sh ..."
DEPLOY_B64=$(base64 -w0 "$(dirname "${BASH_SOURCE[0]}")/deploy.sh")
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --region "$REGION" \
  --parameters commands="[\"mkdir -p /opt/startupvarsity\",\"echo $DEPLOY_B64 | base64 -d > /opt/startupvarsity/deploy.sh\",\"chmod +x /opt/startupvarsity/deploy.sh\",\"echo deploy.sh installed\"]" \
  --query 'Command.CommandId' --output text

echo "Waiting 15s for command to complete..."
sleep 15

echo "Checking result..."
aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --region "$REGION" \
  --query '[Status, StandardOutputContent, StandardErrorContent]' \
  --output text
