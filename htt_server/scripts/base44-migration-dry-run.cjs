'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const mapping = {
  User: ['staff_accounts', ['email', 'full_name']],
  Player: ['players', ['full_name', 'date_of_birth']],
  Guardian: ['guardians', ['full_name', 'phone']],
  GuardianLink: ['player_guardians', ['player_id', 'guardian_id']],
  Registration: ['registrations', ['reference', 'child_name', 'guardian_name', 'guardian_phone']],
  Centre: ['centres', ['name']], Programme: ['programmes', ['name']],
  Payment: ['payments', ['reference', 'amount', 'currency']],
  AttendanceSession: ['attendance_sessions', ['session_date']],
  AttendanceRecord: ['attendance_records', ['session_id', 'player_id', 'status']],
  Assessment: ['assessments', ['player_id', 'type']],
  ScholarshipApplication: ['scholarship_applications', ['reference', 'applicant_name', 'guardian_name']],
  ScholarshipAward: ['scholarship_awards', ['player_id', 'award_amount']],
  Sponsor: ['sponsors', ['name', 'type']], FundingRecord: ['funding_records', ['category', 'kind', 'amount', 'record_date', 'status']],
  Season: ['seasons', ['name']], Team: ['teams', ['name', 'season_id', 'age_category']],
  Fixture: ['fixtures', ['home_team_id', 'away_team_id', 'match_date']],
  Enquiry: ['enquiries', ['contact_name']], FollowUpTask: ['follow_up_tasks', ['title']],
  SponsorshipEnquiry: ['sponsorship_enquiries', ['contact_name', 'category']],
  Story: ['stories', ['title', 'category']], ConsentRecord: ['consent_records', ['consent_type']],
  Notification: ['notifications', ['title', 'body', 'type']], AuditLog: ['audit_logs', ['action', 'entity_name']],
};

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const index = arg.indexOf('=');
  return index < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, index), arg.slice(index + 1)];
}));
if (!args.input) {
  console.error('Usage: node scripts/base44-migration-dry-run.cjs --input=<Base44-export.json> [--report=<report.json>]');
  process.exit(2);
}

const inputPath = path.resolve(args.input);
const raw = fs.readFileSync(inputPath);
const parsed = JSON.parse(raw.toString('utf8'));
const source = parsed.entities && typeof parsed.entities === 'object' ? parsed.entities : parsed;
const entities = {};
const issues = [];
const totals = {};

for (const [entity, [target, required]] of Object.entries(mapping)) {
  const candidate = source[entity] ?? source[`${entity}.json`];
  const records = Array.isArray(candidate) ? candidate : Array.isArray(candidate?.items) ? candidate.items : [];
  const ids = new Map();
  const missing = [];
  const duplicates = [];
  let valid = 0;
  for (let index = 0; index < records.length; index += 1) {
    const row = records[index] || {};
    const sourceId = String(row.id ?? row._id ?? '');
    if (!sourceId) missing.push({ row: index, field: 'id' });
    else if (ids.has(sourceId)) duplicates.push({ sourceId, rows: [ids.get(sourceId), index] });
    else ids.set(sourceId, index);
    for (const field of required) if (row[field] === undefined || row[field] === null || row[field] === '') missing.push({ row: index, field });
    if (sourceId && required.every((field) => row[field] !== undefined && row[field] !== null && row[field] !== '')) valid += 1;
  }
  entities[entity] = { target, sourceCount: records.length, rowsPassingRequiredFieldCheck: valid, sourceIdsMissingOrRepeated: duplicates.length + missing.filter((entry) => entry.field === 'id').length, missingRequiredFields: missing, duplicateSourceIds: duplicates };
  totals[entity] = records.length;
  if (missing.length || duplicates.length) issues.push({ entity, missingRequiredFields: missing.length, duplicateSourceIds: duplicates.length });
}

const report = {
  mode: 'dry-run-only',
  migrationVersion: '20261030-phase7-preflight-1',
  sourceSystem: 'base44',
  sourceFileSha256: crypto.createHash('sha256').update(raw).digest('hex'),
  createdAt: new Date().toISOString(),
  sourceCounts: totals,
  entities,
  unresolvedRelationshipValidation: 'Requires a canonical source-to-target ID map and isolated target database; no writes were attempted.',
  productionDatabaseAccessed: false,
  databaseWrites: false,
  issueCount: issues.length,
  issues,
};
const output = JSON.stringify(report, null, 2);
if (args.report) fs.writeFileSync(path.resolve(args.report), `${output}\n`, { flag: 'wx' });
process.stdout.write(`${output}\n`);
if (issues.length) process.exitCode = 1;
