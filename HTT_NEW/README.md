# Base44 Project

Use this repository to run and edit the app locally, then publish changes back through Base44.

Any change pushed to the repo will also be reflected in the Base44 Builder.

## Prerequisites

1. Clone the repository using the project's Git URL.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.
4. Install the Base44 CLI: `npm install -g base44@latest`.
5. Install [Deno](https://docs.deno.com/runtime/getting_started/installation/) — the local Base44 backend runs on it.

Run `base44 --help` (or see the [CLI reference](https://docs.base44.com/developers/references/cli/commands/introduction)) for the full command surface.

## Run Locally

Three commands, from the project root:

```bash
base44 login   # one-time per machine
base44 link    # one-time per clone
base44 dev     # local backend + frontend together
```

Open the frontend URL that `base44 dev` prints (typically `http://localhost:5173`).

Notes:

- **Every fresh clone needs `base44 link`.** It writes `base44/.app.jsonc` (the app-id pointer), which is deliberately gitignored. Your app id is in the Builder URL (`app.base44.com/apps/<id>/...`); `base44 link --help` shows the non-interactive flags.
- **`base44 dev` runs the frontend for you** (via `site.serveCommand` in this repo's `base44/config.jsonc`) — never run `npm run dev` yourself: alone it serves a UI with no backend behind it (`[base44] Proxy not enabled`, every `/api` call fails), and alongside `base44 dev` the second Vite silently takes the next port and you end up looking at the wrong one.
- **The app must be published at least once for the UI to load under `base44 dev`.** The frontend boots by fetching app settings from the hosted app; before the first publish that fails and every page redirects to login. The local API works regardless.
- Entities, functions, and auth run locally — entity data is **in-memory only**, wiped when `base44 dev` restarts. Everything else (Core integrations, OAuth login) is forwarded to your deployed app. Full breakdown: [Local development overview](https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview).

## Frontend Only, Hosted Backend

To work on just the frontend against your app's live hosted backend:

```bash
base44 dev --remote
```

⚠️ In this mode writes go to your app's **production data** — plain `base44 dev` keeps everything local.

## Publish Your Changes

After pushing your changes to git, open the Base44 dashboard and publish the app:

```bash
base44 dashboard open
```

This repo syncs to Base44 through git, so publish from the dashboard rather than `base44 deploy` — a CLI deploy ships your local tree directly, bypassing the sync, and the deployed state silently diverges from the repo.

## Docs & Support

GitHub integration: [https://docs.base44.com/developers/app-code/local-development/github](https://docs.base44.com/developers/app-code/local-development/github)

Local development: [https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview](https://docs.base44.com/developers/backend/overview/local-dev/local-development-overview)

Support: [https://app.base44.com/support](https://app.base44.com/support)

## Custom API integration (Phase 7)

The frontend now uses the Express API for staff login/session refresh/logout and password reset, plus API-backed staff/role administration, player/guardian/registration/centre/programme collections, payments, receipts, finance summary, and staff notifications. Those API calls use HttpOnly cookies and `credentials: include`.

For local API-backed development, create `htt_server/.env` from `htt_server/.env.example`, set `FRONTEND_URL=http://localhost:5173`, and configure a **development** PostgreSQL database before using authenticated API routes. Set `VITE_API_BASE_URL=http://localhost:4000/api/v1` in the frontend environment (see `.env.example` at the repository root). The frontend falls back to localhost in Vite development and to same-origin `/api/v1` in a production build; deployments with a separate API host must set `VITE_API_BASE_URL` and allow the exact frontend origin in backend `FRONTEND_URL`.

The migration is incomplete: attendance, assessment, scholarships, sponsors/funding, league data, enquiries/tasks, content/media, settings, and per-registration balance details still depend on Base44 or have no REST replacement. Keep the Base44 CLI/plugin and source configuration until those features are replaced and verified. Do not use `base44 dev --remote` for integration testing: it writes to hosted Base44 production data. See the [Phase 7 integration status](./htt_server/PHASE7_INTEGRATION_STATUS.md) and [migration preflight](./htt_server/PHASE7_MIGRATION_PREFLIGHT.md) for verification results and unresolved source/target mappings.
