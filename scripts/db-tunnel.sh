#!/usr/bin/env bash
#
# Opens a tunnel to the shared dev database (RDS "startupvarsity-local").
#
# That instance has PubliclyAccessible=false, so it has no public endpoint and
# cannot be reached from a laptop directly -- you get a connection timeout.
# This forwards a local port to it through AWS Systems Manager, using an EC2
# instance that already lives in the database's VPC. No VPN, no SSH key.
#
# Usage:
#   ./scripts/db-tunnel.sh          # runs in the foreground; Ctrl-C to stop
#
# Leave it running in its own terminal, then start the app in another.
#
# Override the defaults with env vars if needed, e.g.:
#   LOCAL_PORT=5544 ./scripts/db-tunnel.sh
#
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
BASTION="${BASTION_INSTANCE_ID:-i-0fd5c7f32fc4bf271}"
RDS_HOST="${RDS_HOST:-startupvarsity-local.cvpkcfi2aqhq.ap-south-1.rds.amazonaws.com}"
RDS_PORT="${RDS_PORT:-5432}"
# Deliberately not 5433: that is the conventional "second postgres" port and
# gets claimed by other projects' containers (e.g. getdr-db). If that happens
# while the tunnel is down, DATABASE_URL silently points at the wrong database.
LOCAL_PORT="${LOCAL_PORT:-5544}"

fail() { echo "ERROR: $*" >&2; exit 1; }

# --- prerequisites -----------------------------------------------------------

command -v aws >/dev/null \
  || fail "aws CLI not found. Install it: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"

command -v session-manager-plugin >/dev/null \
  || fail "session-manager-plugin not found. Install it:
  https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html"

# .env ships stale/rotated AWS keys for other services; they are not the ones
# that grant SSM access. Ignore whatever is exported and use the CLI's own
# configured profile.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN

aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1 \
  || fail "AWS credentials are not working. Run 'aws configure' (or set AWS_PROFILE) and try again."

if ss -ltn 2>/dev/null | grep -q ":${LOCAL_PORT} "; then
  fail "port ${LOCAL_PORT} is already in use -- a tunnel may already be running.
  Check with: ss -ltnp | grep ${LOCAL_PORT}
  Or pick another port: LOCAL_PORT=5544 ./scripts/db-tunnel.sh"
fi

ping_status=$(aws ssm describe-instance-information \
  --region "$REGION" \
  --filters "Key=InstanceIds,Values=${BASTION}" \
  --query 'InstanceInformationList[0].PingStatus' \
  --output text 2>/dev/null || echo "None")

[ "$ping_status" = "Online" ] \
  || fail "bastion ${BASTION} is not reachable via SSM (status: ${ping_status}).
  Either it is stopped, or your IAM user lacks ssm:StartSession / ssm:DescribeInstanceInformation.
  Ask an admin, or point at another SSM-managed instance in the DB's VPC:
    BASTION_INSTANCE_ID=i-xxxxxxxx ./scripts/db-tunnel.sh"

# --- tunnel ------------------------------------------------------------------

echo "Tunnelling localhost:${LOCAL_PORT} -> ${RDS_HOST}:${RDS_PORT} via ${BASTION}"
echo "Leave this running. Press Ctrl-C to stop."
echo

exec aws ssm start-session \
  --region "$REGION" \
  --target "$BASTION" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "{\"host\":[\"${RDS_HOST}\"],\"portNumber\":[\"${RDS_PORT}\"],\"localPortNumber\":[\"${LOCAL_PORT}\"]}"
