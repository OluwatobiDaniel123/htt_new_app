# HTT Academy Admin — Agent Notes

## Architecture

- Frontend: React and Vite in this directory.
- Backend: the custom Express and TypeScript API in `../htt_server`.
- Database: Supabase PostgreSQL, accessed by the backend.
- Authentication: the custom backend's JWT and HttpOnly cookie flow.

Read this file and `README.md` before making changes. Preserve existing pages,
layouts, navigation, API behavior, authentication, permissions, and user changes.
Use the existing API client in `src/api/client.js` and existing UI patterns.
Do not add another backend or call the database directly from the frontend.

## Local development

Install dependencies with `npm install`, then run `npm run dev`. Vite proxies
`/api` to `http://localhost:8000`; configure the Express development server or
`VITE_API_BASE_URL` to match the local setup. Do not use production credentials
for local testing.

## Checks

Available scripts are `npm run lint`, `npm test`, `npm run typecheck`, and
`npm run build`. The backend has corresponding lint, test, and build scripts in
`../htt_server/package.json`. Never run database migrations or seeders unless
the user explicitly authorizes them.
