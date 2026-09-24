#!/usr/bin/env bash
# Run the password_changed_at migration on the MAIN DB (us-west-2 RDS).
# From a machine that can reach AWS RDS (your laptop with VPN, or an EC2 in the same VPC):
#
#   chmod +x scripts/run-migration-main-db.sh
#   ./scripts/run-migration-main-db.sh
#
# Or set env and run the npm script:
#   export DATABASE_URL="postgresql://USER:PASSWORD@startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com:5432/postgres?sslmode=require"
#   npm run db:add-password-changed-at

set -e
MAIN_DB_HOST="${MAIN_DB_HOST:-startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com}"
MAIN_DB_USER="${DATABASE_USER:-startupvarsity}"
MAIN_DB_PASS="${DATABASE_PASSWORD}"
MAIN_DB_NAME="${DATABASE_NAME:-postgres}"
MAIN_DB_PORT="${DB_PORT:-5432}"

if [ -z "$MAIN_DB_PASS" ]; then
  echo "Set DATABASE_PASSWORD (or MAIN_DB_PASS) and re-run."
  exit 1
fi

export DATABASE_URL="postgresql://${MAIN_DB_USER}:${MAIN_DB_PASS}@${MAIN_DB_HOST}:${MAIN_DB_PORT}/${MAIN_DB_NAME}?sslmode=require"
echo "Running migration on main DB (${MAIN_DB_HOST})..."
npm run db:add-password-changed-at
