# HTT Academy API

HTT Academy's custom Express 5 and TypeScript REST backend. The React and Vite frontend in `../HTT_NEW` uses this API; authentication is handled by the custom JWT and HttpOnly cookie implementation.

See [DATABASE_ARCHITECTURE.md](./DATABASE_ARCHITECTURE.md) for the proposed schema, mapping, relationships, security notes, and unresolved design decisions.

## Requirements

- Node.js 20 or newer
- PostgreSQL credentials for database-backed work (the health endpoint does not connect to PostgreSQL)

## Local setup

```sh
npm install
cp .env.example .env
```

Replace the example JWT secrets and database placeholders before using the corresponding features. Do not commit `.env` or real credentials.

```sh
npm run dev
```

The API listens on port 4000 by default. Health: `GET http://localhost:4000/api/v1/health`. Swagger UI: `http://localhost:4000/api-docs`.

## Scripts

- `npm run dev` — restart-on-change TypeScript development server
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run compiled production server
- `npm run typecheck` — compile without emitting files
- `npm run lint` — lint backend TypeScript and ESLint configuration
- `npm run db:migrate` — apply pending Sequelize CLI migrations (not run in Phase 2)
- `npm run db:migrate:undo` — revert the latest Sequelize CLI migration (not run in Phase 2)
- `npm run db:seed:phase5` — add Phase 5 payment and reporting permissions after prior RBAC seeds

## Database

Sequelize is configured for Supabase-hosted PostgreSQL via `DATABASE_URL` or the `PG*` variables. SSL and pool options are environment controlled. The connection is configured but is not authenticated on server startup. Migrations and RBAC seeding require a configured development database and are intentionally not run here.

`npm test` builds and runs unit and unauthenticated route smoke tests. `npm run db:seed:rbac` seeds the existing staff role matrix and permission catalog. Apply `npm run db:seed:phase4` only after the Phase 3 RBAC seed; neither seeder has been run.

Phase 4 adds `20261029000002-academy-integrity.cjs` for one player per source registration and normalized guardian-phone uniqueness. Before applying it to an existing database, check for duplicate non-null `players.registration_id` values and duplicate phone numbers after stripping non-digits; the unique indexes intentionally fail rather than silently choosing a record.

## Phase 5 payments and finance API

Payments reuse the existing `payments`, `payment_allocations`, and `payment_events` tables. Migration `20261029000003-phase5-finance.cjs` adds payment links and idempotency metadata, normalizes the legacy `paid` status to `successful`, and creates a separate refund ledger. Before applying it, run these read-only checks:

```sql
SELECT status, count(*) FROM payments GROUP BY status;
SELECT currency, count(*) FROM payments GROUP BY currency;
SELECT count(*) FROM payments WHERE amount <= 0;
SELECT reference, count(*) FROM payments GROUP BY reference HAVING count(*) > 1;
```

Expected existing statuses are `pending`, `paid`, `failed`, `refunded`, and `partially_refunded`; expected currency is NGN. Do not run the migration until a development database is explicitly selected and reviewed.

The Phase 5 permission seed `20261029000002-phase5-finance-permissions.cjs` runs after the Phase 3 RBAC seed and Phase 4 permissions. Paystack configuration uses `PAYSTACK_SECRET_KEY`, `PAYSTACK_API_BASE_URL`, and `PAYSTACK_TIMEOUT_MS`. Paystack signs webhook payloads with its secret key; if the legacy `PAYSTACK_WEBHOOK_SECRET` variable is retained, it must match `PAYSTACK_SECRET_KEY`. Online initialization derives the amount from the registration, reserves its outstanding balance while pending, and leaves ambiguous provider timeouts pending for verification. Manual payments require an idempotency key. Receipt responses redact player and payer names unless corresponding sensitive-data permissions are also granted.

Payment and finance routes are under `/api/v1/payments`; Swagger UI is under `/api-docs`. Financial amounts are currently restricted to NGN with two decimal places. Receipt data is provided as JSON; PDF rendering and storage are not implemented. Provider sandbox and live behavior is not verified by the automated suite.

## Phase 6 notifications

Phase 6 adds transactional event enqueueing for registration decisions, payment status, and refund status; a database outbox worker; delivery attempt records; staff in-app notifications; staff notification preferences; guardian SMS consent tracking; admin delivery retry and delivery history; an in-app staff announcement API; and a code-managed template catalog. The worker starts with the server except in `NODE_ENV=test`. It claims rows with PostgreSQL row locks and retries transient failures up to five times with exponential backoff. Recipient addresses are not stored in attempt rows; a SHA-256 recipient hash is used for diagnostics.

External channels are disabled by default. Set `NOTIFICATIONS_ENABLED=true` only after configuring and reviewing the Resend sender and SMS provider settings. SMS uses a generic HTTP contract: `POST SMS_API_URL`, Bearer `SMS_API_KEY`, JSON `{ "to": "234...", "from": "...", "text": "..." }`. The provider must accept international numbers as digits only and return an optional JSON `id`. Provider acceptance is recorded as delivery; no delivery receipt webhook is implemented. Email uses the existing Resend integration. Templates are code-managed and listed via the admin API; editing templates through the API is not supported. Announcements currently create in-app notifications for active staff only. Guardians do not have app accounts, so no guardian in-app inbox exists.

New routes (all under `/api/v1`):

- `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/{id}`, `PATCH /notifications/{id}/read`, `PATCH /notifications/read-all`
- `GET /notifications/preferences`, `PUT /notifications/preferences`
- `GET /admin/notifications/deliveries`, `POST /admin/notifications/deliveries/{id}/retry`, `GET /admin/notifications/templates`
- `POST /admin/notifications/announcements`, `PUT /admin/notifications/guardians/{id}/sms-consent`

The notification migration is `20261029000004-phase6-notifications.cjs`; the permission seeder is `20261029000003-phase6-notification-permissions.cjs`. Apply the migration only after reviewing the target development database and completing prior migrations. Then run `npm run db:seed:phase6` after the Phase 3 RBAC and Phase 4/5 permission seeds. Neither Phase 6 migration nor seeder has been run as part of this work. Do not use a production database for setup validation. The `payment.initiated` notification is enqueued after the Paystack initialization call succeeds, because the external provider call cannot share a database transaction; an outbox write failure does not reverse provider initialization. Outbox delivery is at-least-once across a process crash after provider acceptance but before the successful attempt is committed, so providers with idempotency support should be configured accordingly.

Set `NOTIFICATIONS_ENABLED=false` for local verification. No live email or SMS has been sent and no provider credentials are required to run unit tests or the health endpoint.

## Authentication and authorization

Authentication uses Argon2id password hashes, short-lived signed access JWTs, rotating opaque refresh tokens stored as hashes, and HttpOnly cookies. Staff invitations and password resets share one-time token storage. Email delivery is disabled in development and requires Resend configuration outside development. Set distinct random JWT secrets and review the cookie SameSite policy for the deployed frontend/API origins.

The RBAC seed preserves the existing frontend role matrix (`admin`, `ceo`, `operations`, `finance`, `coach`, `marketing`, `sponsorship`, `user`). Sensitive grants such as safeguarding management, sensitive player/guardian details, refunds, and audit details are separate keys and are not granted by the module matrix. Admin and CEO receive staff and role administration grants. Review and apply the seed only to a development database before creating staff accounts.

## Phase 4 academy API

Player, guardian, registration, centre, and programme routes use the role permission rows seeded by the Phase 4 permission seed. Player names and dates of birth require `players.read_sensitive`; guardian phone, email, and address require `guardians.read_contact`. Registration approval serializes on the registration row and a normalized child name/date key, explicitly asks an administrator to resolve possible existing-player matches, links or creates a guardian, writes consent/history/audit records in one transaction, and leaves payment status unpaid. It does not upload registration documents; documents may reference existing private `MediaAsset` records.

## Public registration and checkout

The public site submits the multipart endpoint `POST /api/v1/public/intake` with JSON in `registration` and a profile image in `file`. The academy payload uses centre and programme `uuid` values that may be their seeded slugs (for example `magodo` and `ogudu-programme-1`) or database UUIDs. The backend resolves those values to active database rows, rejects programmes marked closed, and verifies the centre-programme association again during the registration transaction. It requires `agreeTerms: true`; a missing or false value is rejected. `consentMedical` is optional and defaults to false. Optional player school, class, position, guardian address, and alternative phone values may be omitted. The compatible legacy registration shape remains accepted; it requires child name/date of birth, guardian name/phone/email, and centre/programme IDs, and initializes payment using the approved programme fee.

The academy public registration fee is fixed at NGN 40,000. The submitted `payment.fee` must match that amount. The programme `baseFee` is retained as a submitted snapshot and is not used to set the registration charge or update programme fees. A submission returns `201` with `registrationId`, `paymentReference`, and checkout details only when a checkout URL is available. If provider initialization fails or its outcome is ambiguous, the endpoint returns `503` with the registration/payment references in error details; the local pending payment is retained to avoid duplicate charges. Identical retries use a submission fingerprint and payment idempotency key. Do not submit a different registration or reinitialize an ambiguous payment until its status has been reconciled.

If the payment page is refreshed, retrieve the existing checkout summary with `GET /api/v1/public/payments/{paymentReference}`. This rate-limited public endpoint does not initialize a payment. It returns only registration name/centre/programme summary and payment reference, amount, currency, status, provider status, verification time, and the stored authorization URL while the payment is pending. Keep the opaque payment reference for this lookup. If registration/payment initialization returned an issue, retry the exact same multipart submission to resume the same registration safely.

The callback must send the returned Paystack reference to `POST /api/v1/payments/verify/{reference}`. This route is limited to 12 requests per minute per client IP. The webhook is limited to 600 requests per minute per client IP; both use the in-memory express-rate-limit store. In multi-instance deployments, configure a shared rate-limit store or equivalent edge protection. Express proxy trust is not enabled by default, so do not rely on forwarded client-IP headers unless trusted proxies are explicitly configured.

The backend verifies transactions directly with Paystack and only then updates the existing payment and registration. Browser callback status parameters are not proof of payment. Webhooks accept legacy `x-paystack-signature` using `PAYSTACK_SECRET_KEY`, and timestamped `Paystack-Signature` using the dedicated dashboard signing secret in `PAYSTACK_WEBHOOK_SECRET`. Keep the API secret configured while the dashboard still sends the legacy header. For an ambiguous initialization, inspect/verify the stored provider reference and reconcile it before taking another payment action; pending refunds also require provider/dashboard reconciliation if no matching webhook arrives. Local tests stub image-storage and Paystack requests; they do not exercise live providers.
