import { z } from "zod";

const uuid = z.string().uuid();
const text = (max = 5000) => z.string().max(max).nullable().optional();
const short = (max = 200) => z.string().min(1).max(max);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dateTime = z.string().datetime({ offset: true });
const money = z.number().finite().min(0).max(1_000_000_000);
const nonnegativeInt = z.number().int().min(0).max(1_000_000);
const stringArray = z.array(z.string().max(500)).max(100);
const jsonObject = z.record(z.string(), z.unknown());

export const adminResourceDefinitions = {
  AttendanceSession: {
    path: "attendance-sessions", permission: "attendance", search: ["notes"], filters: ["centreId", "programmeId", "status"],
    fields: { centreId: uuid.nullable().optional(), programmeId: uuid.nullable().optional(), sessionDate: dateOnly, coachId: uuid.nullable().optional(), status: z.enum(["scheduled", "completed", "cancelled"]).optional(), notes: text() },
    required: ["sessionDate"],
  },
  Assessment: {
    path: "assessments", permission: "assessments", search: [], filters: ["playerId", "centreId", "status", "type"],
    fields: { playerId: uuid, registrationId: uuid.nullable().optional(), type: z.enum(["trial", "periodic", "scholarship"]), scheduledAt: dateTime.nullable().optional(), centreId: uuid.nullable().optional(), coachId: uuid.nullable().optional(), coachEmail: z.string().email().max(320).nullable().optional(), status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(), criteriaScores: jsonObject.optional(), overallRating: z.number().min(0).max(10).nullable().optional(), feedback: text(), improvementTargets: stringArray.optional(), completedAt: dateTime.nullable().optional() },
    required: ["playerId", "type"],
  },
  ScholarshipApplication: {
    path: "scholarship-applications", permission: "scholarships", search: ["reference", "applicantName", "guardianName"], filters: ["status", "playerId", "centreId", "programmeId"],
    fields: { reference: short(60), applicantName: short(200), guardianName: short(200), guardianEmail: z.string().email().max(320).nullable().optional(), guardianPhone: text(40), playerId: uuid.nullable().optional(), centreId: uuid.nullable().optional(), programmeId: uuid.nullable().optional(), eligibilityChecks: z.unknown().optional(), assessmentId: uuid.nullable().optional(), assessmentResult: text(40), notes: text(), status: z.enum(["received", "eligibility_review", "assessment_scheduled", "assessed", "selection_panel", "approved", "waitlisted", "declined"]).optional(), decisionNotes: text(), awardAmount: money.nullable().optional(), fundingSecured: money.nullable().optional(), fundingRequired: money.nullable().optional(), startDate: dateOnly.nullable().optional(), endDate: dateOnly.nullable().optional(), renewalDate: dateOnly.nullable().optional() },
    required: ["reference", "applicantName", "guardianName"],
  },
  ScholarshipAward: {
    path: "scholarship-awards", permission: "scholarships", search: ["notes", "benefitDescription"], filters: ["status", "playerId", "centreId", "programmeId"],
    fields: { applicationId: uuid.nullable().optional(), playerId: uuid, programmeId: uuid.nullable().optional(), centreId: uuid.nullable().optional(), awardAmount: money, benefitDescription: text(), fundingSecured: money.optional(), fundingRequired: money.optional(), startDate: dateOnly.nullable().optional(), endDate: dateOnly.nullable().optional(), renewalDate: dateOnly.nullable().optional(), status: z.enum(["active", "paused", "completed", "withdrawn"]).optional(), notes: text() },
    required: ["playerId", "awardAmount"],
  },
  Sponsor: {
    path: "sponsors", permission: "funding", search: ["name", "contactName", "organisation", "email"], filters: ["status", "type"],
    fields: { name: short(200), type: z.enum(["individual_player", "scholarship_fund", "school_project", "corporate_partnership"]), contactName: text(200), email: z.string().email().max(320).nullable().optional(), phone: text(40), organisation: text(200), address: text(), status: z.enum(["prospect", "active", "paused", "closed"]).optional(), notes: text() },
    required: ["name", "type"],
  },
  FundingRecord: {
    path: "funding-records", permission: "funding", search: ["reference", "targetLabel", "notes"], filters: ["sponsorId", "category", "kind", "status", "currency"],
    fields: { sponsorId: uuid.nullable().optional(), category: z.enum(["individual_player", "scholarship_fund", "school_project", "corporate_partnership"]), kind: z.enum(["pledge", "payment", "refund"]), amount: money, currency: z.string().length(3).default("NGN"), reference: text(100), recordDate: dateOnly, status: z.enum(["pledged", "confirmed", "received", "cancelled"]), targetLabel: text(200), notes: text() },
    required: ["category", "kind", "amount", "recordDate", "status"],
  },
  Season: {
    path: "seasons", permission: "league", search: ["name", "code"], filters: ["status"],
    fields: { name: short(160), code: text(40), ageCategories: stringArray.optional(), startDate: dateOnly.nullable().optional(), endDate: dateOnly.nullable().optional(), status: z.enum(["planned", "active", "completed", "archived"]).optional(), pointsWin: nonnegativeInt.optional(), pointsDraw: nonnegativeInt.optional(), pointsLoss: nonnegativeInt.optional(), notes: text() },
    required: ["name"],
  },
  Team: {
    path: "teams", permission: "league", search: ["name", "ageCategory"], filters: ["seasonId", "centreId", "status", "ageCategory"],
    fields: { name: short(160), seasonId: uuid, centreId: uuid.nullable().optional(), ageCategory: short(40), coachId: uuid.nullable().optional(), coachEmail: z.string().email().max(320).nullable().optional(), status: z.enum(["planned", "active", "withdrawn"]).optional(), playerIds: z.array(uuid).max(100).optional() },
    required: ["name", "seasonId", "ageCategory"],
  },
  Fixture: {
    path: "fixtures", permission: "league", search: ["venue", "matchReport"], filters: ["seasonId", "status", "ageCategory", "homeTeamId", "awayTeamId"],
    fields: { seasonId: uuid.nullable().optional(), ageCategory: text(40), homeTeamId: uuid, awayTeamId: uuid, matchDate: dateTime, venue: text(200), status: z.enum(["scheduled", "completed", "cancelled", "postponed"]).optional(), homeScore: nonnegativeInt.nullable().optional(), awayScore: nonnegativeInt.nullable().optional(), matchReport: text() },
    required: ["homeTeamId", "awayTeamId", "matchDate"],
  },
  Enquiry: {
    path: "enquiries", permission: "communications", search: ["contactName", "email", "phone", "subject", "message"], filters: ["status", "type", "assignedToId", "priority"],
    fields: { contactName: short(200), email: z.string().email().max(320).nullable().optional(), phone: text(40), type: z.enum(["general", "registration", "assessment", "callback", "partnership", "sponsorship", "school_project"]).optional(), source: z.enum(["website", "phone", "walk_in", "referral", "social", "event", "admin"]).optional(), status: z.enum(["new", "contacted", "in_progress", "resolved", "closed"]).optional(), assignedToId: uuid.nullable().optional(), assignedEmail: z.string().email().max(320).nullable().optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional(), subject: text(200), message: text(), notes: text(), nextFollowUp: dateOnly.nullable().optional(), consentToContact: z.boolean().optional(), optedOut: z.boolean().optional() },
    required: ["contactName"],
  },
  FollowUpTask: {
    path: "follow-up-tasks", permission: "communications", search: ["title", "contactName", "notes"], filters: ["enquiryId", "assignedToId", "status", "priority"],
    fields: { title: short(200), enquiryId: uuid.nullable().optional(), contactName: text(200), assignedToId: uuid.nullable().optional(), assignedEmail: z.string().email().max(320).nullable().optional(), dueDate: dateOnly, status: z.enum(["open", "in_progress", "done", "cancelled"]).optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional(), notes: text(), completedAt: dateTime.nullable().optional() },
    required: ["title", "dueDate"],
  },
  SponsorshipEnquiry: {
    path: "sponsorship-enquiries", permission: "communications", search: ["contactName", "organisation", "email"], filters: ["status", "category", "assignedToId", "priority"],
    fields: { contactName: short(200), organisation: text(200), email: z.string().email().max(320).nullable().optional(), phone: text(40), category: z.enum(["individual_player", "scholarship_fund", "school_project", "corporate_partnership"]), proposedAmount: money.nullable().optional(), status: z.enum(["new", "contacted", "under_discussion", "proposal_sent", "awaiting_payment", "confirmed", "declined", "closed"]).optional(), priority: z.enum(["low", "medium", "high", "urgent"]).optional(), notes: text(), source: text(40), assignedToId: uuid.nullable().optional() },
    required: ["contactName", "category"],
  },
  Story: {
    path: "stories", permission: "content", search: ["title", "description"], filters: ["category", "status", "centreId"],
    fields: { title: short(220), category: short(50), description: text(), centreId: uuid.nullable().optional(), publicationDate: dateOnly.nullable().optional(), status: z.enum(["draft", "in_review", "approved", "published", "archived"]).optional(), involvesChildren: z.boolean().optional(), safeguardingApproved: z.boolean().optional(), safeguardingNotes: text() },
    required: ["title", "category"],
  },
  ConsentRecord: {
    path: "consent-records", permission: "safeguarding", search: [], filters: ["status", "consentType", "playerId", "guardianId"],
    fields: { subjectType: z.enum(["player", "guardian"]).optional(), playerId: uuid, guardianId: uuid.nullable().optional(), consentType: z.enum(["media_photography", "media_video", "data_processing", "medical", "travel"]), status: z.enum(["granted", "pending", "withdrawn"]).optional(), grantedAt: dateOnly.nullable().optional(), expiresAt: dateOnly.nullable().optional(), notes: text() },
    required: ["consentType", "playerId"],
  },
  ApplicationSettings: {
    path: "settings", permission: "settings", search: [], filters: [], singleton: true,
    fields: { academyName: short(200), contactEmail: z.string().email().max(320).nullable().optional(), contactPhone: text(40), currency: z.string().length(3), registrationPrefix: short(40), playerIdPrefix: short(40), retentionYears: z.number().int().min(1).max(100), paymentProvider: z.enum(["paystack", "manual"]), leagueStatus: z.enum(["planned", "in_preparation", "active"]), schoolProjectStatus: z.enum(["proposed", "planned", "confirmed"]), scholarshipTarget: nonnegativeInt, assessmentCriteria: z.array(z.unknown()).max(100) },
    required: ["academyName", "currency", "registrationPrefix", "playerIdPrefix", "retentionYears", "paymentProvider", "leagueStatus", "schoolProjectStatus", "scholarshipTarget", "assessmentCriteria"],
  },
} as const;

export const resourceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().max(120).optional(),
  sort: z.string().max(80).optional(),
}).catchall(z.string().max(200));

export const resourceParamsSchema = z.object({ id: z.string().uuid() });

export const attendanceMarksBody = z.object({
  records: z.array(z.object({ playerId: uuid, status: z.enum(["present", "absent", "late", "excused"]), notes: text() }).strict()).min(1).max(300),
}).strict();

export const scholarshipApprovalBody = z.object({
  playerId: uuid,
  benefitDescription: z.string().max(5000).optional(),
}).strict();

export const resourceBodySchema = (definition: (typeof adminResourceDefinitions)[keyof typeof adminResourceDefinitions], partial = false) => {
  const shape = definition.fields as Record<string, z.ZodType>;
  const body = z.object(shape).strict();
  return partial ? body.partial().strict() : body;
};
