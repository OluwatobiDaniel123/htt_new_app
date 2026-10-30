# HTT Academy database architecture — Phase 2

This is a proposed PostgreSQL design based on the Base44 entity definitions and the frontend/backend workflows inspected on 2026-10-29. It is not a claim that a database has been provisioned or tested. Base44 remains in place and is unchanged. Nothing in this phase connects to Supabase or runs a migration.

## Inventory and mapping

| Existing Base44 entity | Proposed PostgreSQL table(s) | Notes / application usage |
|---|---|---|
| User | `staff_accounts`, `roles`, `permissions`, `staff_roles`, `staff_centres`, `role_permissions`, `refresh_sessions`, `password_reset_tokens` | `src/pages/Staff.jsx`, `Roles.jsx`; User role/phone/active/centres become normalized identity and assignment data. Auth tables are proposed for the stated future requirements. |
| Centre | `centres`, `centre_programmes` | `Centres.jsx`, selectors, `publicIntake`; stores identity, operational status, contacts and schedules. |
| Programme | `programmes`, `centre_programmes` | `Programmes.jsx`, registration/intake; fee uses NUMERIC. Centre membership is many-to-many instead of the current UUID array. |
| Player | `players`, `player_guardians` | `Players.jsx`, `PlayerDetail.jsx`, assessments, attendance, scholarships, league; safeguarding information is kept in a restricted table rather than the default player row. |
| Guardian | `guardians`, `player_guardians` | `Guardians.jsx`; many-to-many with players. Contact data is not included in default-safe projections. |
| GuardianLink | `player_guardians` | Existing relationship/primary/emergency-contact fields become a composite-unique join record. |
| Registration | `registrations`, `registration_documents`, `registration_status_history`, `consent_records` | `Registrations.jsx`, `RegistrationDetail.jsx`, `approveRegistration`, `publicIntake`; amounts become NUMERIC and payment is represented through allocations. |
| AttendanceSession | `attendance_sessions` | `Attendance.jsx`, `AttendanceDialog.jsx`; belongs to centre/programme and has staff coach. |
| AttendanceRecord | `attendance_records` | Session/player join with one attendance state per player per session. |
| Assessment | `assessments` | `Assessments.jsx`, `PlayerDetail.jsx`; criteria scores remain structured JSONB because criteria are configurable. |
| ScholarshipApplication | `scholarship_applications`, `scholarship_documents`, `scholarship_decisions` | `ScholarshipApplications.jsx`, public intake; decision history and documents become related rows. |
| ScholarshipAward | `scholarship_awards`, `scholarship_award_sponsors` | `ActiveScholarships.jsx`; sponsor relation is many-to-many. Amounts use NUMERIC. |
| Payment | `payments`, `payment_allocations`, `payment_events` | `Payments.jsx`, `Transactions.jsx`, receipts, outstanding balances and Paystack functions; external references have unique constraints and allocations may cover multiple registrations. |
| Sponsor | `sponsors` | `Sponsors.jsx`; sponsorship communication history becomes separate event rows (proposed). |
| FundingRecord | `funding_records` | `FundingOverview.jsx`; amount uses NUMERIC and optional sponsor FK. |
| SponsorshipEnquiry | `sponsorship_enquiries` | Used by `SponsorshipEnquiries.jsx` and `publicIntake`; **source file is empty**. Proposed fields are inferred only from those call sites: contact name, organisation, email, phone, category, proposed amount, status, priority, notes, source, assignee. |
| Season | `seasons` | `Seasons.jsx`, teams/fixtures/standings. |
| Team | `teams`, `team_players` | `Teams.jsx`; roster becomes normalized join records. |
| Fixture | `fixtures` | `Fixtures.jsx`, `Results.jsx`, `Standings.jsx`; **source file is empty**. UI fields inspected: optional season, age category, home/away team IDs and name snapshots, match date, venue, status, scores, and match report. These are inferred proposals pending confirmation. |
| Enquiry | `enquiries`, `enquiry_communications` | `Enquiries.jsx`, `Partnerships.jsx`, `publicIntake`; partnership is a category/type, not a separate table. |
| FollowUpTask | `follow_up_tasks` | `Tasks.jsx`, enquiry workflow; optional enquiry and staff assignee FKs. |
| Story | `stories`, `story_media`, `story_approvals` | `Stories.jsx`, `MediaApproval.jsx`; private Cloudinary assets are separate records, and children’s safeguarding approval is persisted. |
| Notification | `notifications` | `Notifications.jsx`, `Topbar.jsx`; proposed staff recipient FK replaces email targeting where possible. |
| AuditLog | `audit_logs` | `AuditLogs.jsx`, sensitive write workflows; append-only application policy is proposed. |
| ConsentRecord | `consent_records` | `Safeguarding.jsx`, registration approval; supports player/guardian and optional private document asset. |
| SystemSettings | `application_settings`, normalized `role_permissions` | `Settings.jsx`, `Roles.jsx`; secrets are excluded. Role permission rows are normalized rather than stored as a JSON blob. |

The frontend `Player` shape has `safeguarding_notes`; the registration flow also has medical-consent flags. Those are existing requirements, but the current code does not define a structured medical-record workflow. This design does not add clinical records. A separate safeguarded note table is proposed for access-control separation. Existing denormalized `*_name` snapshot values are retained only where useful for historical records/reports; foreign keys are the authoritative relationships.

### Existing field inventory

This list records property names present in the non-empty Base44 entity schemas. The two empty definitions have no source fields to list; their observed UI payloads are the explicitly proposed fields in the mapping above.

- `User`: role, phone, active, centres.
- `Centre`: name, code, area, address, map_link, lead_coach, staff_emails, programme_ids, age_groups, schedule, approved_fee, capacity, contact_name, contact_phone, contact_email, operational_notes, registration_available, review_status, status, proposed_area.
- `Programme`: name, code, description, age_group_label, age_min, age_max, approved_fee, currency, schedule, capacity, centre_ids, assessments_required, availability, status, notes.
- `Player`: player_id, full_name, date_of_birth, age_group, centre_id, centre_name, programme_id, programme_name, registration_status, scholarship_status, document_verification, development_notes, match_appearances, match_notes, school, safeguarding_notes, guardian_ids, primary_guardian_name, registration_id, archived, archived_reason.
- `Guardian`: full_name, email, phone, address, preferred_contact, communication_preferences, account_status, consent_status, notes. `GuardianLink`: guardian_id, guardian_name, player_id, player_name, relationship, is_primary, is_emergency_contact, notes.
- `Registration`: reference, guardian_name, guardian_email, guardian_phone, guardian_address, child_name, child_date_of_birth, centre_id, centre_name, programme_id, programme_name, age_group, pathway, documents, document_status, consent_media, consent_data, consent_medical, payment_status, amount_due, amount_paid, payment_reference, assigned_reviewer, internal_notes, submitted_at, reviewed_at, status, status_history, source, linked_player_id.
- `AttendanceSession`: centre_id, centre_name, programme_id, programme_name, session_date, coach_email, status, present_count, absent_count, notes. `AttendanceRecord`: session_id, session_date, centre_id, player_id, player_name, status, notes.
- `Assessment`: player_id, player_name, registration_id, type, scheduled_at, centre_id, centre_name, coach_email, coach_name, status, criteria_scores, overall_rating, feedback, improvement_targets, completed_at.
- `ScholarshipApplication`: reference, applicant_name, guardian_name, guardian_email, guardian_phone, player_id, centre_id, centre_name, programme_id, programme_name, eligibility_checks, documents, assessment_id, assessment_result, reviewers, notes, status, decision_notes, decision_history, award_amount, funding_secured, funding_required, start_date, end_date, renewal_date. `ScholarshipAward`: application_id, player_id, player_name, programme_id, programme_name, centre_id, centre_name, award_amount, benefit_description, funding_secured, funding_required, start_date, end_date, renewal_date, status, sponsor_ids, notes.
- `Payment`: reference, registration_id, player_id, player_name, payer_name, amount, currency, method, purpose, status, paid_at, receipt_number, gateway_reference, refund_amount, refund_reason, notes. `FundingRecord`: sponsor_id, sponsor_name, category, kind, amount, currency, reference, record_date, status, target_label, notes.
- `Sponsor`: name, type, contact_name, email, phone, organisation, address, status, notes, communication_history.
- `Season`: name, code, age_categories, start_date, end_date, status, points_win, points_draw, points_loss, notes. `Team`: name, season_id, season_name, centre_id, centre_name, age_category, coach_email, coach_name, roster, status.
- `Enquiry`: contact_name, email, phone, type, source, status, assigned_to, priority, subject, message, notes, next_follow_up, consent_to_contact, opted_out, communication_history. `FollowUpTask`: title, enquiry_id, contact_name, assigned_to, due_date, status, priority, notes, completed_at.
- `Story`: title, category, description, centre_id, centre_name, media, publication_date, author_email, status, involves_children, safeguarding_approved, safeguarding_notes, approval_history.
- `Notification`: title, body, type, category, link, read, for_email.
- `ConsentRecord`: subject_type, player_id, player_name, guardian_id, guardian_name, consent_type, status, granted_at, expires_at, document_uri, notes.
- `AuditLog`: actor_email, actor_name, action, entity_name, record_id, record_label, details.
- `SystemSettings`: academy_name, contact_email, contact_phone, currency, registration_prefix, player_id_prefix, retention_years, payment_provider, paystack_configured, league_status, school_project_status, scholarship_target, assessment_criteria, role_permissions.

Schema files for `Fixture` and `SponsorshipEnquiry` are both zero bytes. The repository also has a zero-byte `recordPayment` backend function, which affects legacy payment entry but does not provide a custom-backend contract. Their model fields here are inferred from actual frontend/public intake code and remain proposed.

## Relational overview

- Staff accounts ↔ roles ↔ permissions are many-to-many. Refresh sessions and password-reset token hashes belong to one staff account.
- Programme ↔ centre is many-to-many. Players each optionally reference their current centre and programme; registration submissions snapshot their selected centre/programme and can later link to one player.
- Player ↔ guardian is many-to-many through `player_guardians`, including relationship, primary and emergency flags.
- Attendance session ↔ player is many-to-many through attendance records, uniquely constrained per session/player. Assessments belong to a player and can reference a registration.
- Registration ↔ payment is many-to-many through `payment_allocations`, enabling partial payments and one payment covering multiple balances. Paystack events are stored separately for idempotency/audit.
- Player ↔ scholarship applications is one-to-many; award is linked to player/application and sponsors many-to-many.
- Season has teams and fixtures; each fixture references two distinct teams in the same season. Team ↔ player is many-to-many.
- Enquiries have follow-up tasks and communications. Sponsors have funding records. Stories ↔ media assets is many-to-many, with a separate approval history.
- Consent records refer to a player and/or guardian and optionally a private media asset. Audit log actor references a staff account but record IDs remain polymorphic text identifiers.

## Constraints, indexes, and financial integrity

UUID primary keys; created/updated timestamps; FKs with `RESTRICT` for financial/history roots and `CASCADE` only for dependent join/history rows. Unique constraints cover staff email, role/permission keys, external payment/gateway references, receipt numbers, registration references, join pairs and attendance session/player. A partial unique index permits at most one primary guardian per player. Composite fixture/team/season foreign keys prevent a fixture from crossing seasons. Check constraints enforce nonnegative monetary amounts, `refund_amount <= amount`, valid status/method values, `home_team_id <> away_team_id`, score nonnegativity, valid age bounds, and exactly one consent subject where appropriate. Indexes cover common list filters and foreign keys, including status/date, player/date, registration/payment, centre/status, season/team and recipient/read.

All financial columns use `NUMERIC(12,2)` (not floating point); currency is an ISO-style 3-character code. A payment is unique by internal reference and unique by non-null gateway reference. `payment_events` records provider event IDs uniquely. Applying a provider event and its payment allocation must occur in one database transaction and be safe to retry. Registration balances should be derived from allocations or maintained only with a transactionally enforced invariant; the initial schema retains `amount_due` on registration and does not persist a mutable `amount_paid` total.

## Sensitive-data controls

- Passwords are represented only by `password_hash`; session/reset tokens only by one-way hashes. JWT signing secrets and provider credentials stay in environment/secret storage, never these tables.
- Guardian address/contact and player date of birth are sensitive. Safeguarding notes are split into `player_safeguarding_records`; document metadata and private Cloudinary asset identifiers are not public URLs.
- Sequelize default scopes omit password hashes, guardian contact fields, child name/date of birth/school/notes, registration personal data, payment payer/gateway details, safeguarding notes, consent document references, and audit details. An authenticated service must first authorize access and then explicitly select/un-scope the needed sensitive attributes; the future API phase must add response serializers as a second control.
- Audit logs should be insert-only to application roles; updates/deletes should be prohibited by database permissions or triggers and retained according to an approved policy.
- These are schema and application-layer recommendations, not row-level security. No staff/guardian access policy has been implemented yet.

## Assumptions and unresolved decisions

1. The missing Fixture and SponsorshipEnquiry entity definitions mean their fields/statuses above are proposals derived from current UI and `publicIntake`; validate the workflow with the product owner before applying the migration.
2. Whether staff accounts can hold multiple roles is modeled as yes, though the current UI presents a single role. Normalize either path before auth implementation.
3. Centre/programme links are many-to-many based on `Programme.centre_ids` and `Centre.programme_ids`.
4. Payments allocate against registrations; other payment purposes remain possible with nullable allocations. Confirm whether sponsorship contributions and refunds require separate ledger entries.
5. Currency precision, retention periods, audit retention, PII encryption-at-rest/key management, child-record archival/deletion, and consent retention need an operational/legal policy.
6. A registration may relate to multiple guardians, but current registration intake captures one guardian; additional guardian links are added after approval.
7. Team roster and sponsor ID arrays are normalized. Centre/programme and player/guardian label snapshots are not authoritative.
8. `media_assets.secure_url` is restricted to server-side access; private delivery should use short-lived signed links. Confirm Cloudinary product/access mode.

## Migration plan

`migrations/20261029000000-create-initial-schema.cjs` is the proposed reversible initial schema. It creates tables in dependency order and drops them in reverse order. It has not been executed or tested against PostgreSQL. No production Supabase database was contacted. Do not run this migration until the proposed fields and policies are reviewed.
