# Coaching Apprentice Recruitment API

This API module is implemented in source but the database migration has not been applied. The public route accepts the existing recruitment website form fields without applicant authentication.

## Public submission

```http
POST /api/v1/coaching-apprentices/apply
Content-Type: application/json
```

```json
{
  "fullName": "Taylor Example",
  "phoneNumber": "+234 801 234 5678",
  "email": "taylor@example.com",
  "location": "Lagos"
}
```

On success the API returns HTTP 201:

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "status": "pending",
    "createdAt": "<ISO timestamp>"
  }
}
```

The endpoint trims text fields, normalizes email to lowercase, rejects unknown fields, and allows eight submissions per IP in a one-minute window. Invalid input returns the standard 400 validation response. If PostgreSQL reports that `coaching_apprentice_applications` is missing, the API returns HTTP 503 with `RECRUITMENT_STORAGE_UNAVAILABLE`; it never returns a success receipt in that case.

## Staff review

- `GET /api/v1/coaching-apprentices?page=1&limit=25&status=pending`
- `GET /api/v1/coaching-apprentices/:id`
- `PATCH /api/v1/coaching-apprentices/:id/status` with `{ "status": "under_review" }`

List responses contain `data.items` and `data.pagination`. Status updates accept `pending`, `under_review`, `shortlisted`, `accepted`, or `declined`.

All staff endpoints require the existing JWT/session authentication. Reads require `coaching_apprentices` at `view`; status updates require it at `full`. The permission seeder creates the permission catalog entry only and grants it to no role. Assign it explicitly to the roles authorized to review applications.

## Database setup still required

`migrations/20261102000000-create-coaching-apprentice-applications.cjs` creates the new table and its indexes. It has not been executed. Reconcile the recorded Supabase migration history with local migration files and verify the intended non-production target before applying it. Then run `npm run db:seed:recruitment-permission` only when ready to add the permission catalog entry; that seeder makes no role grants.
