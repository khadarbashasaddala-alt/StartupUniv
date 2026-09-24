#!/usr/bin/env bash
# One-off: Add Google Calendar secrets to the current ECS task definition and update the service.
# Run from a machine with AWS CLI and jq, with credentials that can read ECS + Secrets Manager.
#
# Usage:
#   export AWS_REGION=us-west-2   # optional, default below
#   ./scripts/deploy/add-google-calendar-secrets-to-task-def.sh

set -e

REGION="${AWS_REGION:-us-west-2}"
CLUSTER="${ECS_CLUSTER:-startupvarsity-portal-cluster}"
SERVICE="${ECS_SERVICE:-startupvarsity-portal-service}"
APP_NAME="startupvarsity-portal"

echo "Region: $REGION, Cluster: $CLUSTER, Service: $SERVICE"
echo ""

# 1. Get current task definition ARN from service
TASK_DEF_ARN=$(aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION" \
  --query 'services[0].taskDefinition' \
  --output text)

if [ -z "$TASK_DEF_ARN" ] || [ "$TASK_DEF_ARN" = "None" ]; then
  echo "ERROR: Could not get task definition from service."
  exit 1
fi

echo "Current task definition: $TASK_DEF_ARN"

# 2. Get full task definition
aws ecs describe-task-definition --task-definition "$TASK_DEF_ARN" --region "$REGION" \
  --query 'taskDefinition' > /tmp/current-task-def.json

# 3. Get Google Calendar secret ARNs
get_secret_arn() {
  aws secretsmanager describe-secret --secret-id "${APP_NAME}/$1" --region "$REGION" --query ARN --output text 2>/dev/null || echo ""
}

CAL_CLIENT_ID=$(get_secret_arn "GOOGLE_CALENDAR_CLIENT_ID")
CAL_CLIENT_SECRET=$(get_secret_arn "GOOGLE_CALENDAR_CLIENT_SECRET")
CAL_REFRESH=$(get_secret_arn "GOOGLE_CALENDAR_REFRESH_TOKEN")
CAL_ID_ARN=$(get_secret_arn "GOOGLE_CALENDAR_ID")

if [ -z "$CAL_CLIENT_ID" ] || [ -z "$CAL_CLIENT_SECRET" ] || [ -z "$CAL_REFRESH" ]; then
  echo "ERROR: Google Calendar secrets not found in Secrets Manager."
  echo "  Expected: ${APP_NAME}/GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN"
  exit 1
fi

echo "Found secrets in Secrets Manager."

# 4. Build new task definition: add 4 secrets to first container, strip read-only fields
#    Ensure .secrets exists (may be empty or missing)
NEW_TASK_DEF=$(jq --arg cid "$CAL_CLIENT_ID" --arg csec "$CAL_CLIENT_SECRET" --arg ref "$CAL_REFRESH" --arg cid2 "${CAL_ID_ARN:-}" \
  'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
  | .containerDefinitions[0] |= del(.containerArn)
  | .containerDefinitions[0].secrets = ((.containerDefinitions[0].secrets // []) + [
      { "name": "GOOGLE_CALENDAR_CLIENT_ID", "valueFrom": $cid },
      { "name": "GOOGLE_CALENDAR_CLIENT_SECRET", "valueFrom": $csec },
      { "name": "GOOGLE_CALENDAR_REFRESH_TOKEN", "valueFrom": $ref }
    ])
  | if $cid2 != "" then .containerDefinitions[0].secrets += [{ "name": "GOOGLE_CALENDAR_ID", "valueFrom": $cid2 }] else . end
  | .containerDefinitions[0].secrets |= unique_by(.name)' /tmp/current-task-def.json)

REGISTER_DEF=$(echo "$NEW_TASK_DEF" | jq 'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')
echo "$REGISTER_DEF" > /tmp/new-task-def.json

# 5. Register new task definition
NEW_REV=$(aws ecs register-task-definition \
  --cli-input-json file:///tmp/new-task-def.json \
  --region "$REGION" \
  --query 'taskDefinition.revision' \
  --output text)

FAMILY=$(echo "$REGISTER_DEF" | jq -r '.family')
NEW_TASK_DEF_REF="${FAMILY}:${NEW_REV}"

echo "Registered new task definition: $NEW_TASK_DEF_REF"

# 6. Update ECS service to use new task definition
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --task-definition "$NEW_TASK_DEF_REF" \
  --force-new-deployment \
  --region "$REGION" \
  --output json > /dev/null

echo "ECS service updated to use $NEW_TASK_DEF_REF. New tasks will have Google Calendar env vars."
echo "Wait a few minutes for new tasks to be healthy, then try Schedule Meeting again."
