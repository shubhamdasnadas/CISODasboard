# CISO Dashboard — Frontend

React + Vite + Tailwind CSS.

## Setup

```bash
npm install
npm run dev
```

The app runs on `http://localhost:5173` and proxies `/api/*` to the backend
on `http://localhost:5000` (configured in `vite.config.js`).

## Pages

| Route            | Purpose                                      |
|------------------|----------------------------------------------|
| `/login`         | Username check + password login              |
| `/dashboard`     | Org cards with latest API response data      |
| `/organisations` | List + add orgs (superAdmin can add/delete)  |
| `/users`         | SuperAdmin only — manage users               |
| `/tokens`        | Manage API tokens per org                    |
| `/responses`     | Cached API responses + manual refresh button |

## Theme

- Background: `#0B1437`
- Card: `#111C44`
- Accent: `#4318FF`
- Muted text: `#A3AED0`

Defined as Tailwind colors (`navy-900`, `navy-800`, `accent`, `muted`) and used
through the `Card`, `PrimaryButton`, etc. helpers in `src/components/UI.jsx`.