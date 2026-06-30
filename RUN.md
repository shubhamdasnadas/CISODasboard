# CISO Dashboard — Complete Run Guide (CMD-based)

Single source of truth for running the CISO Dashboard from the command line.
Covers prerequisites, database creation, migrations, seeding, backend, frontend,
and troubleshooting.

> **Project root:** `C:\Shubham\Tehsec\CISO`
>
> **Stack:** Node.js + Express + PostgreSQL (`pg`) + JWT + bcrypt + `node-cron` (backend) · React + Vite + Tailwind CSS (frontend)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Folder Structure](#2-folder-structure)
3. [Database — Create from CMD](#3-database--create-from-cmd)
4. [Backend — Setup & Run](#4-backend--setup--run)
5. [Frontend — Setup & Run](#5-frontend--setup--run)
6. [Seed Login Credentials](#6-seed-login-credentials)
7. [Endpoints](#7-endpoints)
8. [Architecture: Per-Org Databases](#8-architecture-per-org-databases)
9. [Background Job](#9-background-job)
10. [Reset Everything](#10-reset-everything)
11. [Troubleshooting](#11-troubleshooting)
12. [Quick Command Cheatsheet](#12-quick-command-cheatsheet)

---

## 1. Prerequisites

Install these once on the machine:

| Tool            | Version   | Verify with           |
|-----------------|-----------|-----------------------|
| Node.js         | 18+ (LTS) | `node -v`             |
| npm             | 9+        | `npm -v`              |
| PostgreSQL      | 16        | `psql --version`      |
| Git (optional)  | latest    | `git --version`       |

PostgreSQL 16 default `psql` path on Windows:

```
C:\Program Files\PostgreSQL\16\bin\psql.exe
```

Add it to your `PATH` (optional) or use the full path as shown below.

---

## 2. Folder Structure

```
CISO/
├── backend/
│   ├── db.js                  # central + per-org connection pools
│   ├── server.js              # express app + cron
│   ├── migrate.js             # one-shot central → per-org migration
│   ├── seed-users.js          # regenerate bcrypt hashes for users
│   ├── seed-data.js           # dummy api_tokens + api_responses per org
│   ├── setup.sql              # ⭐ single SQL file — creates central DB
│   ├── schema_per_org.sql     # applied to every ciso_org_<id> on startup
│   ├── .env                   # DB creds + JWT secret
│   ├── middleware/
│   ├── routes/
│   └── start.bat              # double-click launcher for backend
└── frontend/
    ├── index.html
    ├── vite.config.js         # proxies /api → http://localhost:5000
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── components/
        └── pages/
```

---

## 3. Database — Create from CMD

The single SQL file `backend/setup.sql` drops and recreates everything. It also
seeds 5 organisations + 7 users + 4 legacy tokens in one shot.

Open **Command Prompt** (or PowerShell) and run:

```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d postgres -f "C:\Shubham\Tehsec\CISO\backend\setup.sql"
```

You'll be prompted for the postgres password (default in this project: `root`).

### What this command does

1. Drops every existing `ciso_org_*` database (safe re-run)
2. Drops `cisodashboard` if it exists
3. Creates `cisodashboard` (the central identity DB)
4. Creates tables: `super_admin`, `organisations`, `users`, `api_tokens`, `api_responses`
5. Seeds 5 organisations, 7 users (real bcrypt hashes), 4 legacy tokens
6. Connects to `cisodashboard` for the rest of the script

### Verify central DB

```cmd
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

> The per-org databases (`ciso_org_techsec` … `ciso_org_blueshield`) are **not** created by
> `setup.sql`. They are created automatically the first time you start the
> backend (see [Backend](#4-backend--setup--run)).

---

## 4. Backend — Setup & Run

### 4.1 Install dependencies (first time only)

```cmd
cd C:\Shubham\Tehsec\CISO\backend
npm install
```

### 4.2 Verify `.env`

`backend/.env` should look like this (adjust `DB_PASSWORD` to match your setup):

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

### 4.3 (Optional) Regenerate bcrypt hashes

Only run this if you want fresh password hashes. The hashes baked into
`setup.sql` already work, so you can skip this on a clean install:

```cmd
node seed-users.js
```

### 4.4 Start the backend

```cmd
npm run dev
```

Or, on Windows, just **double-click** `backend\start.bat`.

Expected console output:

```
🔌 Central DB connection OK (localhost:5432/cisodashboard)
✅ Connected to central database: cisodashboard
🆕 Created database: ciso_org_techsec (for Techsec Global Private Ltd)
✔  Database exists: ciso_org_pcpl
🆕 Created database: ciso_org_acme (for Acme Cyber Defense)
🆕 Created database: ciso_org_northwind (for Northwind Logistics)
🆕 Created database: ciso_org_blueshield (for BlueShield Healthcare)
🚚 Migration complete. Totals: 4 tokens, 0 responses.
🌱 Seed complete. Totals: 11 tokens, 12 responses.
🚀 CISO Dashboard API listening on http://localhost:5000
```

### 4.5 Health check

Open in browser: <http://localhost:5000/api/health>

```json
{
  "status": "ok",
  "time": "...",
  "database": { "reachable": true, "error": null, "users": 7, "orgs": 5 }
}
```

### 4.6 Standalone scripts (optional)

Run migration manually:
```cmd
node migrate.js
```

Run seed manually:
```cmd
node seed-data.js
```

Run the backend diagnostic test:
```cmd
node test-backend.js
```

---

## 5. Frontend — Setup & Run

Open a **second** terminal (keep the backend running):

```cmd
cd C:\Shubham\Tehsec\CISO\frontend
npm install
npm run dev
```

App opens at <http://localhost:5173>.

`vite.config.js` proxies `/api/*` → `http://localhost:5000`, so the React app
talks to the backend transparently.

### Production build

```cmd
npm run build
npm run preview
```

---

## 6. Seed Login Credentials

| Username  | Password      | Role        | Organisations            |
|-----------|---------------|-------------|--------------------------|
| Radhesh   | Radhesh@123   | member      | 1 (Techsec)              |
| Ramesh    | Ramesh@123    | admin       | 1, 2 (Techsec, PCPL)     |
| Raju      | Raju@123      | member      | 2 (PCPL)                 |
| Shubham   | Shubham@123   | superAdmin  | 1, 2, 3, 4, 5 (all)      |
| Priya     | Priya@123     | admin       | 3 (Acme)                 |
| Karan     | Karan@123     | admin       | 4 (Northwind)            |
| Anita     | Anita@123     | admin       | 5 (BlueShield)           |

---

## 7. Endpoints

| Method | Path                       | Auth          | Description                          |
|--------|----------------------------|---------------|--------------------------------------|
| GET    | `/api/health`              | public        | DB status, user/org counts           |
| POST   | `/api/auth/check-username` | public        | Check if a username exists           |
| POST   | `/api/auth/login`          | public        | Login → JWT                          |
| GET    | `/api/auth/me`             | JWT           | Current user                         |
| GET    | `/api/users`               | superAdmin    | List all users                       |
| POST   | `/api/users`               | superAdmin    | Add user                             |
| DELETE | `/api/users/:id`           | superAdmin    | Delete user                          |
| GET    | `/api/organisations`       | JWT           | List orgs (filtered by role)         |
| POST   | `/api/organisations`       | superAdmin    | Add org (creates `ciso_org_<id>`)     |
| DELETE | `/api/organisations/:id`   | superAdmin    | Delete org (drops `ciso_org_<id>`)    |
| GET    | `/api/tokens/:orgId`       | JWT           | Tokens for an org (from `ciso_org_<id>`) |
| POST   | `/api/tokens`              | JWT/admin+    | Add a token to `ciso_org_<id>`       |
| DELETE | `/api/tokens/:id?org_id=N` | superAdmin    | Delete token from `ciso_org_<id>`    |
| POST   | `/api/responses/fetch`     | JWT/admin+    | Manually refresh one response        |
| GET    | `/api/responses/:orgId`    | JWT           | Latest responses per api per org     |

---

## 8. Architecture: Per-Org Databases

Tenant isolation via one database per organisation:

- **`cisodashboard`** (central) — identity only: organisations registry, users, super_admin. Source of truth for which per-org DBs exist. Configured via `DB_NAME` env var.
- **`ciso_org_<id>`** (one per org) — that org's `api_tokens` + `api_responses`. Created automatically at server startup.

The organisations registry in the central DB is the source of truth. Adding or
deleting an org via `/api/organisations` automatically creates or drops its
database.

A one-shot migration (`migrate.js`) runs on startup and copies any historical
rows from the legacy central `api_tokens` / `api_responses` tables into the
matching per-org databases. It is **idempotent** — gated by a `_migration_done`
flag table inside each per-org DB.

`seed-data.js` populates each per-org DB with 2-4 realistic-looking tokens and
5-6 responses, gated by `_seed_done`. Safe to re-run; never duplicates.

---

## 9. Background Job

`node-cron` is started in `server.js`. Every **1 minute** it:

1. Reads all org IDs from the central registry.
2. For each org, opens `ciso_org_<id>` and reads its `api_tokens`.
3. For each `(org, api_name)` pair, calls `fetchAndStore(...)` to refresh the
   cached response in that same per-org database.

This means the dashboard shows fresh data even when the frontend is closed.

---

## 10. Reset Everything

To wipe all data and start completely fresh:

```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d postgres -f "C:\Shubham\Tehsec\CISO\backend\setup.sql"
```

This drops and recreates `cisodashboard` plus every `ciso_org_*`. Safe to
re-run any time.

Then restart the backend (it will recreate `ciso_org_<id>` DBs and re-seed).

---

## 11. Troubleshooting

### Login page shows "Server error while checking username"

Work this checklist top to bottom:

1. **Backend running?** You should see `npm run dev` logs in its terminal.
2. **Hit the health endpoint:** open <http://localhost:5000/api/health>.
3. **`database.reachable: false`?** Fix `backend/.env`; ensure Postgres is running.
4. **`users: 0`?** You didn't run `setup.sql`.
5. **Browser console (F12)** — look for `[check-username] failed:` for the full axios error.
6. **Backend console** — look for `check-username error:` with the actual reason.

### `❌ FATAL: Port 5000 is already in use`

Stop the process holding the port (or change `PORT=5050` in `.env` and update
the proxy in `frontend/vite.config.js` to match):

```js
proxy: { '/api': 'http://localhost:5050' }
```

### `❌ FATAL: Cannot connect to the central PostgreSQL database`

Startup smoke test failed. Check:

- Postgres running? (`services.msc` → `postgresql-x64-16` → Start)
- Database `cisodashboard` exists?
- Credentials in `backend/.env` match your setup?
- Firewall not blocking port 5432?

### Quick diagnostic

From the `backend/` folder:

```cmd
node test-backend.js
```

Tests DB connection, table contents, per-org DB existence, and the auth route —
all without needing the frontend running.

---

## 12. Quick Command Cheatsheet

Copy-paste this block into a fresh `cmd` to go from zero → running app:

```cmd
REM ─────────────────────────────────────────────────────────
REM 1. Create the central database (one-time / on reset)
REM ─────────────────────────────────────────────────────────
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d postgres -f "C:\Shubham\Tehsec\CISO\backend\setup.sql"

REM ─────────────────────────────────────────────────────────
REM 2. Backend — install + start
REM ─────────────────────────────────────────────────────────
cd C:\Shubham\Tehsec\CISO\backend
npm install
npm run dev

REM (in a SEPARATE terminal)

REM ─────────────────────────────────────────────────────────
REM 3. Frontend — install + start
REM ─────────────────────────────────────────────────────────
cd C:\Shubham\Tehsec\CISO\frontend
npm install
npm run dev
```

Then open <http://localhost:5173> and log in with any seed credential from
[section 6](#6-seed-login-credentials).

---

### Useful one-liners

```cmd
REM Health check
curl http://localhost:5000/api/health

REM Login (returns JWT)
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"Shubham\",\"password\":\"Shubham@123\"}"

REM List organisations (with JWT)
curl http://localhost:5000/api/organisations -H "Authorization: Bearer <JWT>"

REM Manual data reset (DROPS EVERYTHING)
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d postgres -f "C:\Shubham\Tehsec\CISO\backend\setup.sql"
```
