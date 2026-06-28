# CISO Dashboard — Backend

Node.js + Express API for the CISO Dashboard SaaS.

## Architecture: per-organisation databases

This backend uses **one database per organisation** for tenant isolation:

- **`cisodashboard`** (central DB) — identity only: organisations registry, users,
  super_admin. Configure via the `DB_NAME` env var.
- **`ciso_org_<id>`** (one DB per organisation) — holds that org's `api_tokens`
  and `api_responses`. Created automatically at server startup.

The organisations registry in the central DB is the source of truth for which
per-org databases exist. Adding or deleting an organisation via the API
automatically creates or drops its database.

A one-shot migration (`migrate.js`) runs on startup and copies any historical
rows from the legacy central `api_tokens` / `api_responses` tables into the
matching per-org databases. It's idempotent — gated by a `_migration_done`
flag table inside each per-org DB.

## Setup (Windows + PostgreSQL 16)

### 1. Run the single SQL setup file

Open a terminal (cmd or PowerShell) and run:

```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d postgres -f "C:\Shubham\Tehsec\CISO\backend\setup.sql"
```

Enter your postgres password when prompted. This single command:
- Drops every `ciso_org_*` database (if any exist)
- Drops and recreates the `cisodashboard` database
- Creates all tables
- Seeds 5 organisations + 7 users (real bcrypt hashes) + 4 legacy tokens

### 2. Verify the central database

```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d cisodashboard -c "SELECT id, org_name FROM organisations ORDER BY id;"
```

Expected:
```
 id |         org_name
----+---------------------------
  1 | Techsec Global Private Ltd
  2 | PCPL Construction
  3 | Acme Cyber Defense
  4 | Northwind Logistics
  5 | BlueShield Healthcare
```

### 3. Install dependencies (one time)

```bash
cd C:\Shubham\Tehsec\CISO\backend
npm install
```

On Windows you can also just double-click `start.bat`.

### 4. Verify `.env`

`backend/.env` should contain:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cisodashboard
DB_USER=postgres
DB_PASSWORD=root
JWT_SECRET=ciso_dashboard_super_secret_key_change_in_prod
JWT_EXPIRES_IN=8h
```

Change `DB_PASSWORD` if your postgres password is not `root`.

### 5. Start the backend

```bash
npm run dev
```

On Windows: double-click `start.bat`.

You should see:

```
🔌 Central DB connection OK (localhost:5432/cisodashboard)
✅ Connected to central database: cisodashboard
🆕 Created database: ciso_org_1 (for Techsec Global Private Ltd)
✔  Database exists: ciso_org_2
🆕 Created database: ciso_org_3 (for Acme Cyber Defense)
🆕 Created database: ciso_org_4 (for Northwind Logistics)
🆕 Created database: ciso_org_5 (for BlueShield Healthcare)
✔  ciso_org_3 (Acme Cyber Defense): seeded 4 token(s), 6 response(s)
✔  ciso_org_4 (Northwind Logistics): seeded 2 token(s), 2 response(s)
✔  ciso_org_5 (BlueShield Healthcare): seeded 3 token(s), 4 response(s)
🚚 Migration complete. Totals: 4 tokens, 0 responses.
🌱 Seed complete. Totals: 11 tokens, 12 responses.
🚀 CISO Dashboard API listening on http://localhost:5000
```

### 6. Verify the backend is healthy

Open in browser: **http://localhost:5000/api/health**

Expected JSON:
```json
{
  "status": "ok",
  "time": "...",
  "database": { "reachable": true, "error": null, "users": 7, "orgs": 5 }
}
```

### 7. Start the frontend (in a second terminal)

```bash
cd C:\Shubham\Tehsec\CISO\frontend
npm install
npm run dev
```

Open **http://localhost:5173** and log in.

## Default users (after running setup.sql)

| Username  | Password      | Role        | Organisations            |
|-----------|---------------|-------------|--------------------------|
| Radhesh   | Radhesh@123   | member      | 1 (Techsec)              |
| Ramesh    | Ramesh@123    | admin       | 1, 2 (Techsec, PCPL)     |
| Raju      | Raju@123      | member      | 2 (PCPL)                 |
| Shubham   | Shubham@123   | superAdmin  | 1, 2, 3, 4, 5 (all)      |
| Priya     | Priya@123     | admin       | 3 (Acme)                 |
| Karan     | Karan@123     | admin       | 4 (Northwind)            |
| Anita     | Anita@123     | admin       | 5 (BlueShield)           |

## Routes

| Method | Path                       | Auth          | Description                          |
|--------|----------------------------|---------------|--------------------------------------|
| GET    | /api/health                | public        | DB status, user/org counts           |
| POST   | /api/auth/check-username   | public        | Check if a username exists           |
| POST   | /api/auth/login            | public        | Login → JWT                          |
| GET    | /api/auth/me               | JWT           | Current user                         |
| GET    | /api/users                 | superAdmin    | List all users                       |
| POST   | /api/users                 | superAdmin    | Add user                             |
| DELETE | /api/users/:id             | superAdmin    | Delete user                          |
| GET    | /api/organisations         | JWT           | List orgs (filtered by role)         |
| POST   | /api/organisations         | superAdmin    | Add org (creates ciso_org_<id>)      |
| DELETE | /api/organisations/:id     | superAdmin    | Delete org (drops ciso_org_<id>)     |
| GET    | /api/tokens/:orgId         | JWT           | Tokens for an org (from ciso_org_<id>)|
| POST   | /api/tokens                | JWT/admin+    | Add a token to ciso_org_<id>         |
| DELETE | /api/tokens/:id?org_id=N   | superAdmin    | Delete token from ciso_org_<id>      |
| POST   | /api/responses/fetch       | JWT/admin+    | Manually refresh one response        |
| GET    | /api/responses/:orgId      | JWT           | Latest responses per api per org     |

## Background job

A `node-cron` job runs every 1 minute. For each registered org it reads that
org's `api_tokens` from `ciso_org_<id>` and stores fresh responses back into
the same database. This keeps every tenant's dashboard populated independently.

## Troubleshooting

### Quick diagnostic

From the `backend/` folder:
```bash
node test-backend.js
```

This tests the DB connection, table contents, per-org DB existence, and the
auth route — all without needing the frontend running.

### Login page shows "Server error while checking username"

Work through this checklist:

1. Is the backend running? You should see `npm run dev` logs in a terminal.
2. Hit the health endpoint: open http://localhost:5000/api/health in browser.
3. Does `/api/health` return `database.reachable: false`? Fix your `.env` and ensure Postgres is running.
4. Does `/api/health` return `users: 0`? You didn't run `setup.sql`.
5. Browser console (F12) — look for `[check-username] failed:` line for the full axios error.
6. Backend console — look for `check-username error:` with the actual reason.

### `❌ FATAL: Port 5000 is already in use`

Stop the process holding the port (or change `PORT=5050` in `.env` and update
`frontend/vite.config.js` proxy to match).

### `❌ FATAL: Cannot connect to the central PostgreSQL database`

Startup smoke test failed. Check:
- Postgres running? (`services.msc` → `postgresql-x64-16` → Start)
- Database `cisodashboard` exists?
- Credentials in `.env` match your setup?

### Reset everything

To wipe all data and start completely fresh:

```bash
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d postgres -f "C:\Shubham\Tehsec\CISO\backend\setup.sql"
```

This drops and recreates everything. Safe to re-run any time.