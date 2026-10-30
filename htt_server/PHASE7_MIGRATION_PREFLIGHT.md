# Phase 7 Base44 Data Migration Preflight

## Status

**Preflight prepared from static schemas only. No Base44 export, source database, target database, or production credentials were accessed. No records were counted or migrated.** Counts and conflict totals are therefore `NOT MEASURED`. No target migration or seeder was executed. This is not a clearance to migrate production data.

The source entity definitions in `../base44/entities/*.jsonc` and target Sequelize models/migrations were reviewed at code level. Before execution, export a point-in-time Base44 dataset, select an isolated development database, and run a read-only dry-run that produces the required counts and row-level exception report. Production migration remains behind explicit approval.

## Proposed record mapping

| Base44 source | Custom target | Migration treatment / open checks |
| --- | --- | --- |
| `User` | `staff_accounts`, `roles`, `staff_roles` | Normalize email and role names; detect duplicate emails; retain source ID in a migration map if it is not a UUID. Do not migrate passwords or access tokens. Re-invite/reset staff after account import. |
| `Player` | `players` | Preserve valid UUIDs where collision-free; otherwise use a source-to-target ID map. Validate DOB, age group, centre/programme references, registration status, and duplicate name/DOB candidates. Restrict personal notes to approved data. |
| `Guardian` | `guardians` | Normalize phone numbers; detect duplicate normalized phones and conflicting email/contact values. Preserve consent/account statuses and avoid importing unnecessary contact fields. |
| `GuardianLink` | `player_guardians` | Resolve both IDs through the migration map; preserve relationship, primary and emergency flags; detect duplicate links and multiple-primary conflicts. |
| `Registration` | `registrations`, `registration_status_history`, `registration_documents`, consent records | Preserve reference and status history. Validate required guardian/child fields and centre/programme IDs. Map documents only after private-file migration produces valid `MediaAsset` references; Base44 file URIs cannot be copied as working custom storage links. |
| `Centre` | `centres`, `centre_programmes` | Preserve codes if unique; validate status, proposed/approved state, programme links, fee and capacity constraints. |
| `Programme` | `programmes`, `centre_programmes` | Preserve unique codes; validate age bounds, fees, status, availability and centre links. |
| `Payment` | `payments`, `payment_allocations`, `payment_events` | Preserve references and amounts exactly; reconcile duplicate references, currency and status. Map legacy `paid` to `successful` only after source payment evidence is verified. Do not replay provider transactions or create new charges. |
| `Refund` (if present in export) | `refunds` | The legacy entity catalog does not list a dedicated Refund entity. Locate legacy refund records/fields and reconcile against payment history before mapping. Preserve provider references and approved/processed outcomes. |
| `Notification` | `notifications` | Import only records whose recipient maps to a current staff account. Preserve read state/type/date; avoid importing obsolete announcements or private payloads without a retention review. |
| `AuditLog` | `audit_logs` | Preserve source actor and timestamps, label imported events as legacy, and map actor IDs. Do not synthesize missing actors. |
| `ConsentRecord` | `consent_records` | Preserve consent type, version, timestamp, and evidence/source where present; verify target legal basis and required evidence fields. |
| `Assessment`, `AttendanceRecord`, `AttendanceSession` | Target models exist, REST workflows are not integrated | Need field-level mapping, centre/season/session relationships, duplicate checks, retention review, and dedicated reconciliation before these records are imported. |
| `ScholarshipApplication`, `ScholarshipAward` | Target models exist, REST workflows are not integrated | Map application/award statuses, player/guardian links, award values, effective dates and decisions; reconcile totals before importing. |
| `Enquiry`, `SponsorshipEnquiry`, `FollowUpTask` | Target communication/task models exist, REST workflows are not integrated | Map ownership, contact consent/opt-out, assignments, due dates and status; exclude unnecessary message content and personal data. |
| `Sponsor`, `FundingRecord` | No verified end-to-end custom REST replacement | Confirm target model/table coverage and funding semantics, then map pledge vs received amounts separately. |
| `Season`, `Team`, `Fixture`, `Story`, `SystemSettings` | Some target models exist, but workflows/configuration differ | Require an explicit field-level mapping and owner sign-off. Do not copy role-permission settings wholesale; translate them to permission IDs and review least-privilege grants. |

## Mandatory dry-run output

`scripts/base44-migration-dry-run.cjs` is a standalone read-only JSON export scanner. It currently produces a versioned report with:

- source counts, required-field presence, missing/repeated source IDs, and duplicate IDs;
- input file SHA-256, scan timestamp, migration version, and explicit no-database-write markers.

It does **not** currently calculate target counts, preserve/remap IDs, validate relationships, detect normalized-contact/player/payment collisions, validate enums/dates/amounts, reconcile payments/refunds/registration balances, or apply/import records. The expanded output requirements below are blockers for migration readiness, not existing script features. Use `npm run migration:dry-run -- --input=<export.json>` only with an authorized local export; a report path may be supplied with `--report=<report.json>` (the script refuses to overwrite an existing report).

The next migration implementation must additionally produce:

- IDs preserved/remapped and relationship-resolution totals;
- target collisions, normalized phone/player duplicates, payment-reference conflicts, invalid enum/date/amount values, and unresolved foreign keys;
- per-entity created/already-migrated/skipped/failed/rejected counts in apply mode;
- payment totals by currency/status, refund reconciliation and registration due/paid/outstanding comparisons;
- target environment identity without secrets, and a resumable source-to-target ledger.

The execution should be resumable through a unique `(source_system, source_entity, source_id)` mapping ledger and idempotent upserts that never overwrite a target record with a conflicting owner/value. Conflicts must stop the affected record for review. It must support a dry-run mode and a separately approved apply mode.

## Required operator decisions

1. Confirm the authoritative Base44 export and whether archived/deleted records are in scope.
2. Decide staff invitation/reset and deactivated-account policy; Base44 passwords are not transferable to the Argon2 credential store.
3. Confirm how to export/download and re-upload private documents into Cloudinary (or another approved private object store), and verify access controls before rewriting document references.
4. Resolve unsupported/legacy refund data and scholarship/funding reconciliation rules.
5. Review the development dry-run report and approve the exact production export window and migration plan before any production data write.

No production migration, database write, Base44 source deletion, or irreversible dependency removal has been performed.
