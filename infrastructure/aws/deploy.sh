#!/bin/bash
# =============================================================================
# Deploy the portal container on the EC2 instance.
#
# THIS FILE IS THE SOURCE OF TRUTH. The deploy workflow uploads it to
# /opt/startupvarsity/deploy.sh on every run and executes it there, so editing it
# here is enough — nothing needs re-bootstrapping for a change to take effect.
#
# That indirection exists because it went wrong the other way round: the script
# lived only on the instance, written once at provisioning time, and had drifted
# from every copy in the repo. Fixing the repo changed nothing on the box.
#
# Usage:  deploy.sh [IMAGE_TAG]     # tag defaults to "latest"
# Log:    /var/log/startupvarsity/deploy.log
# =============================================================================

# Without this, a failed ECR login or docker pull falls straight through to
# `docker run` with the stale local image and the script still exits 0 — a deploy
# that reports success while serving the previous build. That is exactly what
# happened on 6 Aug 2026: four consecutive green deploys changed nothing.
set -euo pipefail

mkdir -p /var/log/startupvarsity
# tee, not a plain redirect. Sending everything to the file alone left SSM — and so the
# Actions log — with nothing but "failed to run commands: exit status 1". The deploy that
# broke on 13 Aug 2026 could only be diagnosed by logging in to read this file, which
# defeats the point of having the workflow report the failure at all.
exec > >(tee -a /var/log/startupvarsity/deploy.log) 2>&1

REGION=ap-south-1
ACCOUNT_ID=011266921462
APP_NAME=startupvarsity-portal
ECR_REGISTRY=${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com
S3_BUCKET=${APP_NAME}-files-${ACCOUNT_ID}

# A commit sha is preferred over "latest": it makes the running build identifiable,
# and stops a stale local image passing for a fresh pull.
IMAGE_TAG=${1:-latest}
IMAGE=${ECR_REGISTRY}/${APP_NAME}:${IMAGE_TAG}

# A pull needs room for the compressed download and the extracted layers.
MIN_FREE_MB=4000

echo "=== Deploy started: $(date) — tag ${IMAGE_TAG} ==="

get_secret() {
  aws secretsmanager get-secret-value \
    --secret-id "$1" --region "$REGION" \
    --query SecretString --output text 2>/dev/null || echo ""
}

# --- Reclaim space BEFORE pulling -------------------------------------------------
# Pruning afterwards is too late: the pull is what needs the room. At ~1.3GB an image,
# old builds had filled the 30GB root volume to 98% and the pull failed with ENOSPC.
echo "Disk before prune:"
df -h / | tail -1

# Dangling layers first. This alone used to be enough, back when the instance pulled
# ":latest" and each new pull left its predecessor untagged and therefore prunable.
docker image prune -f || true

# Then superseded builds of this app, which the prune above cannot touch: deploys are
# tagged with the commit sha now, so every image keeps a tag forever and none of them
# is ever dangling. That turned the switch to sha tags into a slow disk leak — 21
# deploys between 6 and 13 Aug 2026 left ~21 tagged images behind, the 22nd had nowhere
# to land, and the free-space check below stopped the deploy.
#
# Keep the image the running container is on, so a rollback stays possible and so the
# site keeps serving if this deploy fails; keep the one we are about to pull, for a
# redeploy of the same sha. Drop the rest. Removing a reference only untags, so an
# image still in use survives regardless of what is listed here.
CURRENT_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$APP_NAME" 2>/dev/null || echo "")
SUPERSEDED=$(docker images "${ECR_REGISTRY}/${APP_NAME}" --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -v ':<none>$' || true)
for ref in $SUPERSEDED; do
  if [ "$ref" != "$IMAGE" ] && [ "$ref" != "$CURRENT_IMAGE" ]; then
    echo "Removing superseded image ${ref}"
    docker rmi "$ref" > /dev/null 2>&1 || true
  fi
done
# Layers orphaned by those removals.
docker image prune -f || true

echo "Disk after prune:"
df -h / | tail -1

AVAIL_MB=$(df -Pm / | awk 'NR==2 {print $4}')
if [ "$AVAIL_MB" -lt "$MIN_FREE_MB" ]; then
  echo "FATAL: ${AVAIL_MB}MB free, need ${MIN_FREE_MB}MB for a pull."
  echo "Refusing to continue — carrying on would redeploy the OLD image and report success."
  echo "Investigate with: docker system df ; du -sh /var/lib/docker/* | sort -h | tail"
  exit 1
fi

# --- Pull -------------------------------------------------------------------------
echo "Logging into ECR..."
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

echo "Pulling ${IMAGE} ..."
docker pull "$IMAGE"

# Prove the image is actually present locally before tearing down what is serving
# traffic. Under set -e a failed pull already aborts; this also catches a pull that
# succeeds without producing the image.
docker image inspect "$IMAGE" > /dev/null

# --- Secrets ----------------------------------------------------------------------
echo "Fetching secrets..."
DATABASE_URL=$(get_secret "${APP_NAME}/DATABASE_URL")
SESSION_SECRET=$(get_secret "${APP_NAME}/SESSION_SECRET")
SENDGRID_API_KEY=$(get_secret "${APP_NAME}/SENDGRID_API_KEY")
GOOGLE_CALENDAR_CLIENT_ID=$(get_secret "${APP_NAME}/GOOGLE_CALENDAR_CLIENT_ID")
GOOGLE_CALENDAR_CLIENT_SECRET=$(get_secret "${APP_NAME}/GOOGLE_CALENDAR_CLIENT_SECRET")
GOOGLE_CALENDAR_REFRESH_TOKEN=$(get_secret "${APP_NAME}/GOOGLE_CALENDAR_REFRESH_TOKEN")
GOOGLE_CALENDAR_ID=$(get_secret "${APP_NAME}/GOOGLE_CALENDAR_ID")
RAZORPAY_KEY_ID=$(get_secret "${APP_NAME}/RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET=$(get_secret "${APP_NAME}/RAZORPAY_KEY_SECRET")
RAZORPAY_WEBHOOK_SECRET=$(get_secret "${APP_NAME}/RAZORPAY_WEBHOOK_SECRET")
OPENAI_API_KEY=$(get_secret "${APP_NAME}/OPENAI_API_KEY")

if [ -z "$DATABASE_URL" ]; then
  echo "FATAL: ${APP_NAME}/DATABASE_URL is empty. Refusing to start a container with no database."
  exit 1
fi

# --- Swap the container -----------------------------------------------------------
echo "Stopping existing container..."
docker stop "$APP_NAME" 2>/dev/null || true
docker rm "$APP_NAME" 2>/dev/null || true

echo "Starting container..."
docker run -d --name "$APP_NAME" --restart unless-stopped \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e AWS_REGION="$REGION" \
  -e AWS_S3_BUCKET_NAME="$S3_BUCKET" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e SESSION_SECRET="$SESSION_SECRET" \
  -e SENDGRID_API_KEY="$SENDGRID_API_KEY" \
  -e DEFAULT_FROM_EMAIL=hello@startupvarsity.com \
  -e EMAIL_FROM=hello@startupvarsity.com \
  -e GOOGLE_CALENDAR_CLIENT_ID="$GOOGLE_CALENDAR_CLIENT_ID" \
  -e GOOGLE_CALENDAR_CLIENT_SECRET="$GOOGLE_CALENDAR_CLIENT_SECRET" \
  -e GOOGLE_CALENDAR_REFRESH_TOKEN="$GOOGLE_CALENDAR_REFRESH_TOKEN" \
  -e GOOGLE_CALENDAR_ID="$GOOGLE_CALENDAR_ID" \
  -e RAZORPAY_KEY_ID="$RAZORPAY_KEY_ID" \
  -e RAZORPAY_KEY_SECRET="$RAZORPAY_KEY_SECRET" \
  -e RAZORPAY_WEBHOOK_SECRET="$RAZORPAY_WEBHOOK_SECRET" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e PORTAL_URL=https://www.startupvarsity.com \
  -e PAYMENT_PORTAL_URL=https://startupvarsity.rooman.net \
  -e BOT_PORT=4001 \
  -e BOT_SERVICE_URL=http://localhost:4001 \
  --log-driver awslogs \
  --log-opt awslogs-region="$REGION" \
  --log-opt awslogs-group=/ec2/${APP_NAME} \
  --log-opt awslogs-stream=app \
  --log-opt awslogs-create-group=true \
  "$IMAGE"

# --- Confirm what is running ------------------------------------------------------
# Local checks only. Whether the site serves the new build is asserted by the
# workflow against /health; this just makes the deploy log say what it started.
sleep 5
RUNNING_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$APP_NAME")
echo "Container image: ${RUNNING_IMAGE}"
if [ "$RUNNING_IMAGE" != "$IMAGE" ]; then
  echo "FATAL: container is running ${RUNNING_IMAGE}, expected ${IMAGE}."
  exit 1
fi
if [ "$(docker inspect -f '{{.State.Running}}' "$APP_NAME")" != "true" ]; then
  echo "FATAL: container is not running. Last output:"
  docker logs --tail 50 "$APP_NAME" || true
  exit 1
fi

# Layers the container swap released. The image the previous deploy was on is kept
# deliberately — it is the rollback — and the next deploy's pre-pull sweep is what
# finally removes it, once this build has proved it starts.
docker image prune -f || true
echo "Disk after deploy:"
df -h / | tail -1
docker images "${ECR_REGISTRY}/${APP_NAME}" --format '  {{.Repository}}:{{.Tag}} ({{.Size}})'

echo "=== Deploy completed: $(date) — running ${IMAGE_TAG} ==="
