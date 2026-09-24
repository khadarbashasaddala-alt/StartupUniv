#!/usr/bin/env bash
# =============================================================================
# Run a migration SQL file against the PRODUCTION database.
#
# Production Postgres (startupvarsity-portal-db) has no public endpoint, and the
# app runs in a container on the portal EC2 instance. That container already
# holds both the migration SQL and a DATABASE_URL, so this drives the migration
# from inside it over SSM -- no SSH, no key file, and no copy of the production
# credential anywhere on your machine.
#
# Usage:
#   ./scripts/run-migration-on-production.sh add-dynamic-roles.sql
#   ./scripts/run-migration-on-production.sh add-dynamic-roles.sql --dry-run
#
# --dry-run reports the current schema state and exits without writing.
#
# Requires: awscli, and IAM permission for ssm:SendCommand on the instance.
# =============================================================================

set -euo pipefail

SQL_NAME="${1:-}"
DRY_RUN="${2:-}"
INSTANCE_ID="${PORTAL_INSTANCE_ID:-i-0291cd8bc616ab51a}"
REGION="${AWS_REGION_OVERRIDE:-ap-south-1}"
CONTAINER="${PORTAL_CONTAINER:-startupvarsity-portal}"

fail() { echo "ERROR: $*" >&2; exit 1; }

[[ -n "$SQL_NAME" ]] || fail "give a SQL file name from scripts/sql/, e.g. add-dynamic-roles.sql"
SQL_NAME="$(basename "$SQL_NAME")"
[[ -f "$(dirname "${BASH_SOURCE[0]}")/sql/$SQL_NAME" ]] \
  || fail "scripts/sql/$SQL_NAME does not exist locally -- check the name"

command -v aws >/dev/null || fail "awscli is not installed"

# The runner executes inside the container. Two things it must get right:
#   - strip sslmode from the URL: newer pg treats sslmode=require as verify-full and
#     lets it override the ssl option, which fails against RDS's private CA with
#     "self-signed certificate in certificate chain" (server/db.ts does the same)
#   - print the schema state either side of the change, so the run is auditable
read -r -d '' RUNNER <<'NODE' || true
const { Client } = require('/app/node_modules/pg');
const { readFileSync } = require('fs');
const file = '/app/scripts/sql/' + process.argv[2];
const dryRun = process.argv[3] === '--dry-run';
(async () => {
  const u = new URL(process.env.DATABASE_URL);
  u.search = '';
  const c = new Client({ connectionString: u.toString(), ssl: { rejectUnauthorized: false } });
  c.on('notice', (n) => console.log('  notice: ' + (n.message || '')));
  await c.connect();
  const state = async () => {
    const t = await c.query(`select table_name from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE' order by table_name`);
    const e = await c.query(`select typname from pg_type where typname='user_role'`);
    return { tables: t.rowCount, enum_user_role: e.rowCount > 0,
             has_roles: t.rows.some(r => r.table_name === 'roles'),
             has_cohort_role_counts: t.rows.some(r => r.table_name === 'cohort_role_counts') };
  };
  console.log('BEFORE ' + JSON.stringify(await state()));
  if (dryRun) { console.log('DRY RUN -- nothing written'); await c.end(); return; }
  const sql = readFileSync(file, 'utf8');
  console.log('running ' + file + ' (' + sql.length + ' bytes)');
  await c.query(sql);            // the file carries its own BEGIN/COMMIT
  console.log('AFTER  ' + JSON.stringify(await state()));
  console.log('MIGRATION OK');
  await c.end();
})().catch((e) => { console.error('MIGRATION FAILED: ' + e.message); process.exit(1); });
NODE

B64="$(printf '%s' "$RUNNER" | base64 -w0)"
ARGS="$SQL_NAME"
[[ "$DRY_RUN" == "--dry-run" ]] && ARGS="$SQL_NAME --dry-run"

echo "==> instance $INSTANCE_ID / container $CONTAINER / $SQL_NAME ${DRY_RUN:-}"

COMMAND_ID="$(aws ssm send-command \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --timeout-seconds 900 \
  --parameters "commands=[\
\"echo $B64 | base64 -d > /tmp/svmig.cjs\",\
\"docker cp /tmp/svmig.cjs $CONTAINER:/tmp/svmig.cjs\",\
\"docker exec $CONTAINER node /tmp/svmig.cjs $ARGS 2>&1 | grep -vi 'security warning\\|sslmode\\|libpq\\|trace-warnings\\|postgresql.org\\|adopt standard\\|explicitly use\\|prepare for this\\|these modes\\|next major'\",\
\"docker exec $CONTAINER rm -f /tmp/svmig.cjs; rm -f /tmp/svmig.cjs\"]" \
  --query 'Command.CommandId' --output text)"

echo "==> command $COMMAND_ID -- waiting..."
while true; do
  STATUS="$(aws ssm get-command-invocation --region "$REGION" \
    --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
    --query Status --output text 2>/dev/null || echo Pending)"
  [[ "$STATUS" == "InProgress" || "$STATUS" == "Pending" ]] || break
  sleep 4
done

aws ssm get-command-invocation --region "$REGION" \
  --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --query 'StandardOutputContent' --output text
ERR="$(aws ssm get-command-invocation --region "$REGION" \
  --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --query 'StandardErrorContent' --output text)"
[[ -n "$ERR" && "$ERR" != "None" ]] && { echo "--- stderr ---"; echo "$ERR"; }

echo "==> status: $STATUS"
[[ "$STATUS" == "Success" ]] || exit 1

if [[ "$DRY_RUN" != "--dry-run" ]]; then
  echo "==> checking the endpoints that were failing"
  for ep in /api/cohorts /api/cohorts/open-for-registration; do
    printf '    %-40s -> %s\n' "$ep" \
      "$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://www.startupvarsity.com$ep")"
  done
fi
