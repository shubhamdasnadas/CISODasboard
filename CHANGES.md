# Zoho Integration Fix — Change Summary

These changes were made to fix the Zoho Desk page and wire up real Zoho credentials, then reverted at the user's request. This file documents what was done so it can be reapplied later.

## Problem

- `POST /api/zoho/sync` expected an `accessToken` in the request body, but the frontend never sent one, and a raw OAuth access token expires hourly anyway — no refresh flow existed.
- `GET /api/zoho/tickets-db` read from the `support_tickets` table, which belongs to an unrelated internal "Support" feature (`backend/routes/support.js`), not Zoho. So syncing tickets from Zoho never actually populated what the ticket list displayed — the two endpoints were reading/writing completely different tables.
- There was no UI to enter Zoho credentials, and no persistence for them (other integrations like SentinelOne/Firewall/Harmony store credentials in the `integration_credentials` table; Zoho did not).

## Changes

### New: `backend/services/zoho.js`
- `getZohoAccessToken(creds)` — exchanges a stored refresh token for a short-lived Zoho access token via `https://accounts.zoho.<dc>/oauth/v2/token`.
- `syncZohoTickets(orgSlug, creds)` — paginates through `https://desk.zoho.<dc>/api/v1/tickets`, then caches the raw ticket array into the existing `zohotable` table (`data_name = 'tickets'`).

### `backend/routes/zoho.js`
- Added `GET /api/zoho/credentials` and `PUT /api/zoho/credentials` to read/write Zoho credentials (`clientId`, `clientSecret`, `refreshToken`, `orgId`, `dc`) from `integration_credentials`, matching the pattern used by `harmony.js`/`sentinelone.js`/`firewall.js`.
- Rewrote `POST /api/zoho/sync` to load stored credentials and call `syncZohoTickets` instead of expecting a client-supplied access token.
- Rewrote `GET /api/zoho/tickets-db` to read from `zohotable` (the actual Zoho cache) instead of `support_tickets`, mapping Zoho Desk's ticket shape (`subject`, `status`, `priority`, `contact.firstName/lastName`, `createdTime`, `description`) into the shape the frontend expects.

### `backend/routes/syncRoute.js`
- Wired Zoho into `POST /api/sync/all` and the `POST /api/sync/cron` background job, alongside SentinelOne, Firewall, and Harmony.

### `frontend/src/pages/Settings.jsx`
- Added a "Zoho Desk" credentials panel (Client ID, Client Secret, Refresh Token, Org ID, Data Center) with a "Save & Sync" button, following the same state/UI pattern as the existing Harmony panel.
- Added Zoho to the "Sync All" results breakdown list.

### `frontend/src/pages/zoho/ZohoPage.jsx`
- Fixed error handling: the page read `e.response?.data?.error`, but the backend always returns `{ message }`, so failures were silently swallowed instead of shown to the user. Changed both error handlers to read `.message`.

## Where credentials would go (Settings page → "Zoho Desk" panel)

| Field | Source |
|---|---|
| Client ID / Client Secret | [Zoho API Console](https://api-console.zoho.com) self-client app |
| Refresh Token | Generated via Zoho's self-client OAuth grant exchange, scope `Desk.tickets.READ` |
| Org ID | Zoho Desk → Setup → Developer Space → API |
| Data Center | `in` / `com` / `eu` / `com.au` / `jp`, matching the Zoho account's region |

## Status

**Reverted.** All of the above code changes were rolled back after this summary was written; `backend/services/zoho.js` was deleted and the four modified files were restored to their prior state. Only this `CHANGES.md` remains.
