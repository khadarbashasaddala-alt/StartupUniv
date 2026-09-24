#!/bin/bash
# =============================================================================
# Deploy StartupVarsity monitoring configs to the monitoring EC2 instance
# Instance: i-0d2074724754c91a0 (ap-south-1)
#
# Usage:
#   chmod +x monitoring/deploy-to-ec2.sh
#   ./monitoring/deploy-to-ec2.sh
# =============================================================================

set -euo pipefail

INSTANCE_ID="i-0d2074724754c91a0"
REGION="ap-south-1"
KEY_FILE="startupvarsity-key.pem"
MONITORING_DIR="/opt/monitoring"

# Resolve script location (works from any cwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Fetching EC2 public IP for $INSTANCE_ID..."
EC2_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text)

if [[ -z "$EC2_IP" || "$EC2_IP" == "None" ]]; then
  echo "ERROR: Could not fetch public IP. Is the instance running?"
  exit 1
fi

echo "==> EC2 IP: $EC2_IP"

SSH="ssh -i $SCRIPT_DIR/../$KEY_FILE -o StrictHostKeyChecking=no ec2-user@$EC2_IP"
SCP="scp -i $SCRIPT_DIR/../$KEY_FILE -o StrictHostKeyChecking=no"

# --------------------------------------------------------------------------
# 1. Copy Prometheus config + alert rules
# --------------------------------------------------------------------------
echo "==> Copying Prometheus config..."
$SSH "mkdir -p $MONITORING_DIR/prometheus"
$SCP "$SCRIPT_DIR/aws-ecs/prometheus-ecs.yml" \
     "ec2-user@$EC2_IP:$MONITORING_DIR/prometheus/prometheus.yml"
$SCP "$SCRIPT_DIR/prometheus/alert_rules.yml" \
     "ec2-user@$EC2_IP:$MONITORING_DIR/prometheus/alert_rules.yml"

# --------------------------------------------------------------------------
# 2. Copy Grafana dashboard + provisioning
# --------------------------------------------------------------------------
echo "==> Copying Grafana dashboard and provisioning..."
$SSH "mkdir -p $MONITORING_DIR/grafana/{provisioning/{dashboards,datasources},dashboards}"

$SCP "$SCRIPT_DIR/grafana/provisioning/dashboards/dashboards.yml" \
     "ec2-user@$EC2_IP:$MONITORING_DIR/grafana/provisioning/dashboards/dashboards.yml"
$SCP "$SCRIPT_DIR/grafana/provisioning/datasources/datasources.yml" \
     "ec2-user@$EC2_IP:$MONITORING_DIR/grafana/provisioning/datasources/datasources.yml"
$SCP "$SCRIPT_DIR/grafana/dashboards/startupvarsity-overview.json" \
     "ec2-user@$EC2_IP:$MONITORING_DIR/grafana/dashboards/startupvarsity-overview.json"

# --------------------------------------------------------------------------
# 3. Reload Prometheus (hot-reload via /-/reload, no container restart needed)
# --------------------------------------------------------------------------
echo "==> Reloading Prometheus config..."
$SSH "curl -s -X POST http://localhost:9090/-/reload && echo 'Prometheus reloaded'"

# --------------------------------------------------------------------------
# 4. Restart Grafana to pick up new dashboard provisioning
# --------------------------------------------------------------------------
echo "==> Restarting Grafana..."
$SSH "cd $MONITORING_DIR && docker-compose restart grafana"

echo ""
echo "=== Done ==="
echo "Grafana:    http://$EC2_IP:3001  (admin / admin)"
echo "Prometheus: http://$EC2_IP:9090"
echo ""
echo "The 'StartupVarsity - Overview' dashboard will appear under the"
echo "StartupVarsity folder in Grafana."
