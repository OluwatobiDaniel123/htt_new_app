# HTT Academy Admin

React and Vite frontend for the HTT Academy administration application. It
communicates with the custom Express REST API in `../htt_server`; the API uses
Supabase PostgreSQL through Sequelize. Authentication uses the existing custom
JWT and HttpOnly cookie flow.

## Requirements and setup

- Node.js 20 or newer
- A separately configured development instance of `htt_server`

From this directory:

```sh
npm install
npm run dev
```

Vite serves the frontend and proxies `/api` to `http://localhost:8000` as
configured in `vite.config.js`. The backend defaults to port 4000, so configure
the backend port to 8000 for this proxy or set `VITE_API_BASE_URL` to the
backend's `/api/v1` URL in the frontend environment. For a separate production
API host, set `VITE_API_BASE_URL` and configure the exact frontend origin in the
backend's `FRONTEND_URL`.

Never put database credentials or server secrets in frontend environment
variables. Never use a production database for local development or destructive
testing.

## Available checks

```sh
npm run lint
npm test
npm run typecheck
npm run build
```

The frontend API client is `src/api/client.js`. It sends cookie credentials,
handles the custom session refresh/retry flow, and parses API errors. Keep
authentication, redirect validation, RBAC checks, and the existing `/api`
proxy intact when adding features.

## Backend and database notes

See [`../htt_server/README.md`](../htt_server/README.md),
[`../htt_server/DATABASE_ARCHITECTURE.md`](../htt_server/DATABASE_ARCHITECTURE.md),
and the Phase 7 integration/preflight documents for backend setup and known
integration gaps. Those Phase 7 files are historical records. Supabase
migration history has not been reconciled with all local migration files; do
not run migrations or seeders without explicit approval and a reviewed target.

Legacy entity definitions and serverless functions remain in `base44/` pending
verification of external callers and data migration. They are not the active
frontend API or authentication architecture. Existing payments and Paystack
integration are handled by the Express backend; production webhook delivery has
not been verified by this repository cleanup.
