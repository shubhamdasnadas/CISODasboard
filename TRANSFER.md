# TRANSFER.md — SoneTenancy → CISODasboard Migration

This document records all changes made during the migration of the security dashboard from the
SoneTenancy project (Next.js / TypeScript / multi-tenant) into the CISODasboard project
(Express.js / React-Vite / JavaScript).

---

## Architecture Differences

| Concern | SoneTenancy (source) | CISODasboard (target) |
|---|---|---|
| Framework | Next.js 16 + React 19 (TypeScript) | Express 4 + React/Vite (JavaScript) |
| Auth | Cookie-based JWT | Bearer token JWT (Authorization header) |
| Org identification | String slug (`saas_org_pcpl`) | Integer ID (`ciso_org_techsec`) |
| Org DB naming | `saas_org_<slug>` | `ciso_org_<id>` |
| DB query helper | `orgQuery(orgSlug, sql)` | `req.orgPool.query(sql)` |
| Frontend data fetching | `useSWR` | `useEffect + api.get()` |
| Auth hook | `useAuth()` | `useOrg()` from OrgContext |
| Org header | — | `X-Org-Id` header on every API call |

---

## Conversion Patterns Applied

```
TypeScript → JavaScript:   Remove `: Type`, `interface`, `as Type`, `import type`
API routes:                `NextResponse.json({}, {status: X})` → `res.status(X).json({})`
Dynamic params:            `await params` → `req.params.xxx`
Org context:               `orgQuery(orgSlug, sql)` → `req.orgPool.query(sql)`
Frontend fetch:            `fetch("/api/...", { credentials: "include" })` → `api.get("/...")`
```

---

## Phase 1 — Database Schema

### `CISODasboard/backend/setup.sql`
- Extended `organisations` table with: `slug VARCHAR(100) UNIQUE`, `is_active BOOLEAN DEFAULT TRUE`, `email`, `website`, `industry`, `plan`, `color`, `description`
- Added `org_users` table: per-org members with `id UUID`, `org_id`, `name`, `email`, `password`, `role DEFAULT 'org_user'`, `department`, `is_active`, `allowed_pages TEXT[]`, timestamps
- Added `cron_config` table: `key TEXT PRIMARY KEY, value TEXT` — seeded with `('total_shards', '1')`

### `CISODasboard/backend/schema_per_org.sql`
All tables appended using `CREATE TABLE IF NOT EXISTS`:
- `integration_credentials` — `integration TEXT PRIMARY KEY, credentials JSONB NOT NULL, token TEXT`
- `s1_threats`, `s1_agents`, `s1_application_agent`, `s1_application_cve`, `s1_device_control`, `s1_rss`
- `firewall_reports` — `report_name TEXT UNIQUE`, `data JSONB`, timestamps
- `firewall_widgets`
- `checkpoint_events` — `event_id TEXT NOT NULL UNIQUE`, `type`, `state`, `severity`, `raw JSONB NOT NULL`, full event fields
- `dashboard_layout` — `user_id INTEGER UNIQUE`, `layout JSONB`
- `zohotable`, `projects`, `reports`, `notifications`, `support_tickets`, `billing`, `analytics_events`, `news_articles`

---

## Phase 2 — Backend Sync Services

### `CISODasboard/backend/services/sentinelone.js` *(new)*
- `fetchAllPages(baseUrl, apiToken, endpoint)` — cursor pagination + exponential backoff on 429 (5 retries, 3000ms × 2^n)
- `syncSentinelOne(orgId, creds)` — fetches threats + agents, truncates tables, bulk-inserts via `getOrgPool(orgId)`

### `CISODasboard/backend/services/firewall.js` *(new)*
- 36-item `REPORTS` array covering all Palo Alto report types
- `syncFirewall(orgId, creds)` — fetches XML from Palo Alto API, parses via `fast-xml-parser`, upserts into `firewall_reports`
- `https.Agent({ rejectUnauthorized: false })` for self-signed firewall certificates

### `CISODasboard/backend/services/harmony.js` *(new)*
- `getHarmonyToken(clientId, accessKey)` — POST OAuth2 to `cloudinfra-gw.in.portal.checkpoint.com`
- `syncHarmony(orgId, creds, eventTypes)` — scroll pagination (up to 200 pages), upserts into `checkpoint_events`

**New backend dependency:**
```bash
npm install fast-xml-parser
```

---

## Phase 3 — Backend Middleware & Routes

### `CISODasboard/backend/middleware/orgMiddleware.js` *(new)*
Reads org from `X-Org-Id` header (or `?orgId=` or first user org), validates membership, attaches `req.currentOrgId` and `req.orgPool`. Allows superAdmin bypass.

### New Express Route Files

| File | Endpoints | Notes |
|---|---|---|
| `routes/sentinelone.js` | GET/PUT `/credentials`, POST `/sync`, GET `/db/threats`, `/db/agents`, `/db/application-agent`, `/db/application-cve`, `/db/device-control`, `/db/rss`, + aliases | 15 endpoints |
| `routes/firewall.js` | GET/PUT `/credentials`, POST `/collect`, GET `/reports/:name`, GET `/reports-list`, GET/POST/PUT/DELETE `/widgets` | |
| `routes/harmony.js` | GET `/auth`, GET/PUT `/credentials`, POST `/sync`, GET `/events`, GET `/events-db` | |
| `routes/dashboard.js` | GET `/aggregate`, GET/PUT `/layout`, GET `/stats` | Parallel queries across all integration tables |
| `routes/zoho.js` | GET `/`, POST `/sync`, GET `/tickets-db` | OAuth2 + Zoho API |
| `routes/news.js` | GET `/`, POST `/` | `limit` param, bulk insert with `ON CONFLICT DO NOTHING` |
| `routes/projects.js` | GET `/`, POST `/`, DELETE `/:id` | |
| `routes/reportsRoute.js` | GET `/`, POST `/`, DELETE `/:id` | |
| `routes/notificationsRoute.js` | GET `/`, POST `/`, PUT `/:id/read` | |
| `routes/support.js` | GET `/`, POST `/`, PUT `/:id` | status/assigned_to update |
| `routes/billing.js` | GET `/`, PUT `/` | upsert pattern |
| `routes/analyticsRoute.js` | GET `/`, POST `/` | `limit` param |
| `routes/syncRoute.js` | POST `/all`, POST `/cron` | `/cron` verifies CRON_SECRET, responds 200 immediately, syncs in background |
| `routes/adminOrgs.js` | CRUD `/organizations`, `/org-users` | superAdmin only, uses `centralPool` + bcrypt |
| `routes/memberRoute.js` | GET `/orgs` | joins `org_users` + `organisations` by email |

### `CISODasboard/backend/server.js` *(modified)*
- Added imports for all new routes, middleware, and sync services
- Added `const withOrg = [authMiddleware, orgMiddleware]` — applied to all integration routes
- Registered all new routes: `/api/sentinelone`, `/api/firewall`, `/api/harmony`, `/api/dashboard`, `/api/zoho`, `/api/news`, `/api/projects`, `/api/reports`, `/api/notifications`, `/api/support`, `/api/billing`, `/api/analytics`, `/api/sync`, `/api/member`, `/api/admin`
- Added `runIntegrationSync()` — runs every 30 minutes, iterates all active orgs, calls all three sync services

---

## Phase 4 — Frontend Context

### `CISODasboard/frontend/src/api.js` *(modified)*
On module init: reads `ciso_current_org_id` from localStorage, sets `api.defaults.headers.common['X-Org-Id']` so the header survives page refreshes.

### `CISODasboard/frontend/src/context/OrgContext.jsx` *(modified)*
`setCurrentOrg(org)` now also updates `api.defaults.headers.common['X-Org-Id']` when org is set, and deletes it when cleared.

### `CISODasboard/frontend/src/context/DashboardContext.jsx` *(new)*
Fetches S1/Firewall/Harmony credentials on mount (whenever `currentOrg` changes). Provides `{ sentinelCreds, firewallCreds, harmonyCreds, loadingCreds, refreshCreds }` via `useDashboard()` hook.

---

## Phase 5 — Frontend Dependencies

```bash
# Frontend
npm install recharts react-grid-layout react-resizable
```
Used for: charts (Recharts), drag-and-drop dashboard widget grid (react-grid-layout).

---

## Phase 6 — Frontend Pages

### New page directories created:
- `frontend/src/pages/security/`
- `frontend/src/pages/paloalto/`
- `frontend/src/pages/checkpoint/`
- `frontend/src/pages/zoho/`
- `frontend/src/pages/admin/`

### New/modified page files:

| File | Route | Description |
|---|---|---|
| `pages/Settings.jsx` | `/settings` | Credentials management for S1/Firewall/Harmony, Sync All button |
| `pages/security/SecurityPage.jsx` | `/security` | S1 overview with charts (threats by status, agents by OS) |
| `pages/security/Threats.jsx` | `/security/threats` | Searchable threat list |
| `pages/security/Agent.jsx` | `/security/agent` | Searchable agent list |
| `pages/security/S1Agent.jsx` | `/security/s1agent` | Application inventory per endpoint |
| `pages/security/S1Cve.jsx` | `/security/s1cve` | CVE table with severity badges |
| `pages/security/RiskyEndpoint.jsx` | `/security/riskyendpoint` | Endpoints scored by active threats + offline status |
| `pages/paloalto/PaloAltoPage.jsx` | `/paloalto` | Grid of all firewall reports with expandable modal + bar chart |
| `pages/checkpoint/CheckpointPage.jsx` | `/checkpoint` | Events table with severity/type/state filters, charts, detail panel |
| `pages/zoho/ZohoPage.jsx` | `/zoho` | Ticket list with status/priority charts and sync button |
| `pages/Projects.jsx` | `/projects` | CRUD card grid |
| `pages/Reports.jsx` | `/reports` | CRUD list |
| `pages/Analytics.jsx` | `/analytics` | Events-per-day line chart + top event types |
| `pages/News.jsx` | `/news` | Security news articles |
| `pages/Support.jsx` | `/support` | Ticket CRUD with inline status update |
| `pages/Notifications.jsx` | `/notifications` | Notification list with mark-read |
| `pages/Billing.jsx` | `/billing` | Subscription details view/edit |
| `pages/admin/AdminOrganizations.jsx` | `/admin/organizations` | SuperAdmin: org CRUD table |
| `pages/admin/AdminOrgUsers.jsx` | `/admin/organizations/:id/users` | SuperAdmin: per-org user CRUD |

---

## Phase 7 — Router & Sidebar

### `CISODasboard/frontend/src/components/AppLayout.jsx` *(modified)*
- Added collapsible sidebar toggle
- Added `NavSection` component for grouped nav labels
- Added all new nav items: Security sub-pages, Integrations (PaloAlto, Harmony, Zoho), Operations (Projects → Billing), Settings
- Admin section (Admin Orgs) gated to `user.role === 'superAdmin'`
- Removed hardcoded `<div className="p-8">` wrapper — pages now handle their own padding

### `CISODasboard/frontend/src/App.jsx` *(modified)*
- Added `DashboardProvider` wrapper around all routes
- Added all new `<Route>` entries for security, integrations, operations, and admin pages
- Admin routes wrapped in `<ProtectedRoute requireSuperAdmin>` guard

---

## Environment Variables Required

No new backend environment variables are required. The existing `.env` suffices.

Optional:
- `CRON_SECRET` — if set, the `POST /api/sync/cron` endpoint verifies `Authorization: Bearer <CRON_SECRET>` before running the sync (for external cron triggers)

---

## Running the Migration

1. **Apply DB schema changes:**
   ```sql
   -- In pgAdmin or psql on the central DB:
   \i backend/setup.sql
   
   -- The per-org schema is applied automatically on server startup via runMigration()
   ```

2. **Install new dependencies:**
   ```bash
   cd CISODasboard/backend && npm install fast-xml-parser
   cd CISODasboard/frontend && npm install recharts react-grid-layout react-resizable
   ```

3. **Start both servers:**
   ```bash
   cd CISODasboard/backend && npm start
   cd CISODasboard/frontend && npm run dev
   ```

4. **Configure credentials:**
   - Navigate to `/settings`
   - Enter SentinelOne token, Palo Alto Base URL + API Key, Harmony Client ID + Access Key
   - Click "Save & Sync" for each integration

---

## Verification Checklist

- [ ] `/settings` — credentials form saves and triggers sync
- [ ] `/security` — S1 threats and agents display with charts
- [ ] `/security/threats` — searchable threat list
- [ ] `/paloalto` — firewall report cards load after collecting
- [ ] `/checkpoint` — events table with filters
- [ ] `/zoho` — ticket list and sync button
- [ ] `/projects`, `/reports`, `/support` — CRUD works
- [ ] `/analytics` — event chart renders
- [ ] `/notifications` — mark-read works
- [ ] `/billing` — view and edit billing info
- [ ] `/admin/organizations` — only visible/accessible as superAdmin
- [ ] Integration sync cron runs every 30 minutes (check server logs)
