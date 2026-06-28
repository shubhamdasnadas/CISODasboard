# CISO Dashboard — Full-stack SaaS

A CISO/security operations dashboard built with:

- **Backend** — Node.js + Express + PostgreSQL (`pg`) + JWT + bcrypt + `node-cron`
- **Frontend** — React + Vite + Tailwind CSS + React Router + Axios
- **Background job** — runs every 5 minutes, refreshes API responses even when the frontend is closed

## Folder structure

```
CISODashboard/
├── backend/
│   ├── db.js
│   ├── server.js
│   ├── seed-users.js          # generate real bcrypt hashes for seed users
│   ├── schema.sql             # PostgreSQL DDL + seed inserts
│   ├── .env                   # DB creds + JWT secret
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── routes/
│       ├── auth.js
│       ├── users.js
│       ├── organisations.js
│       ├── apiTokens.js
│       └── apiResponses.js
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api.js
        ├── index.css
        ├── components/
        │   ├── AppLayout.jsx   # sidebar + outlet
        │   └── UI.jsx          # Card, Button, Input, Badge, StatCard
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Organisations.jsx
            ├── Users.jsx
            ├── ApiTokens.jsx
            └── ApiResponses.jsx
```

## Quick start

### 1. Database

1. Create the database in pgAdmin: name **`CISODashboard`** on port **`5432`** (user `postgres`, password `root`).
2. Open a Query Tool against `CISODashboard` and run the contents of `backend/schema.sql`.

### 2. Backend

```bash
cd backend
npm install
# optional: generate fresh bcrypt hashes for the seed users
node seed-users.js
npm run dev
```

API will run on `http://localhost:5000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App will run on `http://localhost:5173` and proxy `/api` to the backend.

## Seed login credentials

The seeder sets passwords to:

| Username | Password     | Role        | Orgs |
|----------|--------------|-------------|------|
| Shubham  | Shubham@123  | superAdmin  | 1, 2 |
| Ramesh   | Ramesh@123   | admin       | 1, 2 |
| Radhesh  | Radhesh@123  | member      | 1    |
| Raju     | Raju@123     | member      | 2    |

## Important behaviors implemented

1. **Real-time username check** — Login page debounces 500ms and calls `/api/auth/check-username`; org chips appear below the username field once it exists.
2. **Org chips come from DB join** — backend `check-username` joins `users.org_ids` with `organisations`.
3. **Background polling** — `node-cron` job in `server.js` runs every 5 minutes and refreshes every row in `api_tokens`.
4. **Cached responses** — Dashboard reads from `api_responses`, so users see immediately-fetched data on login.
5. **Role-based access** — `superAdmin` sees everything; `admin`/`member` see only their orgs; `Users` page is superAdmin-only.
6. **bcrypt hashes** — passwords stored hashed (seeded via `seed-users.js`).
7. **JWT** — 8-hour expiry (configurable via `JWT_EXPIRES_IN`).