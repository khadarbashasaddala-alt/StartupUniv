# Main DB (us-west-2 RDS) – add missing column

**Host:** `startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com`

The `users` table needs a `password_changed_at` column for login and Settings to work.

## Option 1: Run SQL (from any machine that can reach RDS)

With `psql` and a connection string:

```bash
psql "postgresql://USER:PASSWORD@startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com:5432/postgres?sslmode=require" -f scripts/sql/add-password-changed-at.sql
```

Or in pgAdmin / DBeaver / AWS Query Editor: connect to the main DB, then run the contents of `scripts/sql/add-password-changed-at.sql`.

## Option 2: Run migration script (from a machine that can reach RDS)

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@startupvarsity-portal-db.chqswiw22mww.us-west-2.rds.amazonaws.com:5432/postgres?sslmode=require"
npm run db:add-password-changed-at
```

Or use the helper script (reads DATABASE_USER and DATABASE_PASSWORD from env):

```bash
export DATABASE_PASSWORD=your_password
./scripts/run-migration-main-db.sh
```

## After adding the column

- Login will work (code already supports DBs with or without this column).
- Settings → “Last changed” for password will show the correct date after users change password.
- To use this RDS as your app’s main DB, set `DATABASE_URL` in `.env` to the same connection string above.
