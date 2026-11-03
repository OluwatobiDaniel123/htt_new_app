import { z } from "zod";

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().max(max).nullable().optional();
const phoneNumber = z
  .string()
  .min(5)
  .max(40)
  .regex(/^[+0-9() .-]+$/)
  .refine(
    (value) => value.replace(/\D/g, "").length >= 5,
    "Phone number must contain at least five digits.",
  );
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    "Must be a real calendar date.",
  );
const page = z.coerce.number().int().min(1).max(10000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);

export const playerListQuery = z
  .object({
    page,
    limit,
    search: z.string().max(100).optional(),
    archived: z.enum(["true", "false"]).optional(),
    registrationStatus: z
      .enum(["prospective", "registered", "waitlisted", "archived"])
      .optional(),
    scholarshipStatus: z
      .enum(["none", "applicant", "active", "declined"])
      .optional(),
    documentVerification: z
      .enum(["pending", "verified", "rejected"])
      .optional(),
    ageGroup: z.enum(["8-10", "11-12", "13-14", "other"]).optional(),
    centreId: uuid.optional(),
  })
  .strict();
export const playerBody = z
  .object({
    fullName: z.string().min(1).max(200),
    dateOfBirth: dateOnly,
    ageGroup: z.enum(["8-10", "11-12", "13-14", "other"]).optional(),
    centreId: uuid.nullable().optional(),
    programmeId: uuid.nullable().optional(),
    registrationStatus: z
      .enum(["prospective", "registered", "waitlisted"])
      .optional(),
    scholarshipStatus: z
      .enum(["none", "applicant", "active", "declined"])
      .optional(),
    documentVerification: z
      .enum(["pending", "verified", "rejected"])
      .optional(),
    developmentNotes: optionalText(5000),
    matchAppearances: z.number().int().min(0).max(100000).optional(),
    matchNotes: optionalText(5000),
    school: optionalText(180),
  })
  .strict();
export const playerPatch = playerBody.partial().strict();
export const playerStatusBody = z
  .object({
    registrationStatus: z.enum([
      "prospective",
      "registered",
      "waitlisted",
      "archived",
    ]),
    archivedReason: z.string().max(1000).optional(),
  })
  .strict();

export const guardianListQuery = z
  .object({
    page,
    limit,
    search: z.string().max(100).optional(),
    accountStatus: z.enum(["active", "inactive"]).optional(),
    consentStatus: z
      .enum(["pending", "partial", "granted", "withdrawn"])
      .optional(),
  })
  .strict();
export const guardianBody = z
  .object({
    fullName: z.string().min(1).max(200),
    phone: phoneNumber,
    email: z.string().email().max(320).nullable().optional(),
    address: optionalText(1000),
    preferredContact: z
      .enum(["phone", "whatsapp", "email", "sms"])
      .nullable()
      .optional(),
    communicationPreferences: z
      .array(z.enum(["email", "sms", "whatsapp", "phone"]))
      .max(4)
      .optional(),
    accountStatus: z.enum(["active", "inactive"]).optional(),
    consentStatus: z
      .enum(["pending", "partial", "granted", "withdrawn"])
      .optional(),
    notes: optionalText(5000),
  })
  .strict();
export const guardianPatch = guardianBody.partial().strict();
export const guardianDeleteBody = z.object({}).strict().default({});
export const playerDeleteBody = z
  .object({ reason: z.string().max(1000).optional() })
  .strict()
  .default({});
export const guardianLinkBody = z
  .object({
    guardianId: uuid,
    relationship: z.enum(["mother", "father", "guardian", "other"]),
    isPrimary: z.boolean().optional(),
    isEmergencyContact: z.boolean().optional(),
    notes: optionalText(1000),
  })
  .strict();

export const registrationListQuery = z
  .object({
    page,
    limit,
    search: z.string().max(100).optional(),
    status: z
      .enum([
        "submitted",
        "under_review",
        "assessment_required",
        "information_required",
        "approved",
        "rejected",
      ])
      .optional(),
    centreId: uuid.optional(),
    programmeId: uuid.optional(),
  })
  .strict();
export const registrationBody = z
  .object({
    guardianName: z.string().min(1).max(200),
    guardianEmail: z.string().email().max(320).nullable().optional(),
    guardianPhone: phoneNumber,
    guardianAddress: optionalText(1000),
    childName: z.string().min(1).max(200),
    childDateOfBirth: dateOnly.nullable().optional(),
    centreId: uuid.nullable().optional(),
    programmeId: uuid.nullable().optional(),
    ageGroup: z.enum(["8-10", "11-12", "13-14", "other"]).optional(),
    pathway: z.enum(["paid_academy", "scholarship_assessment"]).optional(),
    consentMedia: z.boolean().optional(),
    consentData: z.boolean().optional(),
    consentMedical: z.boolean().optional(),
    assignedReviewerId: uuid.nullable().optional(),
    internalNotes: optionalText(5000),
    initialNote: z.string().max(1000).optional(),
  })
  .strict();
export const registrationPatch = registrationBody
  .partial()
  .omit({ initialNote: true })
  .strict();
export const registrationDecisionBody = z
  .object({ note: z.string().max(1000).optional() })
  .strict();
export const approveRegistrationBody = z
  .object({
    note: z.string().max(1000).optional(),
    existingPlayerId: uuid.optional(),
    confirmNewPlayer: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => !(value.existingPlayerId && value.confirmNewPlayer),
    "Choose either an existing player or confirm creating a new one.",
  );
export const registrationDocumentsBody = z
  .object({
    documents: z
      .array(
        z
          .object({
            id: uuid.optional(),
            mediaAssetId: uuid.nullable().optional(),
            name: z.string().min(1).max(255),
            status: z.enum(["pending", "verified", "rejected"]).optional(),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();

export const centreListQuery = z
  .object({
    page,
    limit,
    search: z.string().max(100).optional(),
    status: z
      .enum([
        "pending_verification",
        "open_for_registration",
        "assessments_open",
        "coming_soon",
        "temporarily_unavailable",
      ])
      .optional(),
    reviewStatus: z.enum(["pending_verification", "approved"]).optional(),
    operational: z.enum(["true", "false"]).optional(),
  })
  .strict();
const centreFields = {
  slug: optionalText(180),
  name: z.string().min(1).max(180),
  code: z.string().min(1).max(40),
  area: z.string().min(1).max(160),
  address: optionalText(2000),
  city: optionalText(160),
  region: optionalText(160),
  mapEmbed: optionalText(5000),
  mapLink: z.string().url().nullable().optional(),
  leadCoach: optionalText(200),
  staffEmails: z.array(z.string().email()).max(30).optional(),
  ageGroups: z.array(z.string().max(80)).max(20).optional(),
  schedule: optionalText(1000),
  image: optionalText(5000),
  comingSoon: z.boolean().optional(),
  approvedFee: z.number().min(0).max(1000000000).nullable().optional(),
  capacity: z.number().int().min(0).max(100000).nullable().optional(),
  contactName: optionalText(200),
  contactPhone: optionalText(40),
  contactEmail: z.string().email().max(320).nullable().optional(),
  operationalNotes: optionalText(5000),
  registrationAvailable: z.boolean().optional(),
  reviewStatus: z.enum(["pending_verification", "approved"]).optional(),
  status: z
    .enum([
      "pending_verification",
      "open_for_registration",
      "assessments_open",
      "coming_soon",
      "temporarily_unavailable",
    ])
    .optional(),
  proposedArea: z.boolean().optional(),
  programmeIds: z.array(uuid).max(100).optional(),
};
export const centreBody = z
  .object(centreFields)
  .strict()
  .refine(
    (value) =>
      !value.registrationAvailable ||
      (value.reviewStatus === "approved" &&
        value.proposedArea === false &&
        ["open_for_registration", "assessments_open"].includes(
          value.status ?? "",
        )),
    "Registration availability requires an approved operational centre.",
  );
export const centrePatch = z.object(centreFields).partial().strict();
export const centreStatusBody = z
  .object({
    status: z.enum([
      "pending_verification",
      "open_for_registration",
      "assessments_open",
      "coming_soon",
      "temporarily_unavailable",
    ]),
    reviewStatus: z.enum(["pending_verification", "approved"]).optional(),
    proposedArea: z.boolean().optional(),
    registrationAvailable: z.boolean().optional(),
  })
  .strict();

export const programmeListQuery = z
  .object({
    page,
    limit,
    search: z.string().max(100).optional(),
    status: z.enum(["active", "planned", "archived"]).optional(),
    availability: z.enum(["open", "waitlist", "closed"]).optional(),
  })
  .strict();
const programmeFields = {
  slug: optionalText(180),
  name: z.string().min(1).max(180),
  tagline: optionalText(1000),
  code: z.string().max(40).nullable().optional(),
  description: optionalText(5000),
  ageGroup: optionalText(80),
  trainingDays: z.array(z.string().max(80)).max(30).optional(),
  duration: optionalText(160),
  price: optionalText(500),
  benefits: z.array(z.string().max(1000)).max(100).optional(),
  requirements: z.array(z.string().max(1000)).max(100).optional(),
  equipment: z.array(z.string().max(1000)).max(100).optional(),
  icon: optionalText(120),
  featured: z.boolean().optional(),
  ageGroupLabel: z.string().min(1).max(80),
  ageMin: z.number().int().min(0).max(100).nullable().optional(),
  ageMax: z.number().int().min(0).max(100).nullable().optional(),
  approvedFee: z.number().min(0).max(1000000000).nullable().optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  schedule: optionalText(1000),
  capacity: z.number().int().min(0).max(100000).nullable().optional(),
  assessmentsRequired: z.boolean().optional(),
  availability: z.enum(["open", "waitlist", "closed"]).optional(),
  status: z.enum(["active", "planned", "archived"]).optional(),
  notes: optionalText(5000),
  centreIds: z.array(uuid).max(100).optional(),
};
export const programmeBody = z
  .object(programmeFields)
  .strict()
  .refine(
    (value) =>
      value.ageMin == null ||
      value.ageMax == null ||
      value.ageMax >= value.ageMin,
    "ageMax cannot be lower than ageMin.",
  );
export const programmePatch = z.object(programmeFields).partial().strict();
export const programmeStatusBody = z
  .object({
    status: z.enum(["active", "planned", "archived"]),
    availability: z.enum(["open", "waitlist", "closed"]).optional(),
  })
  .strict();
