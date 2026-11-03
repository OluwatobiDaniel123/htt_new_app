import { DataTypes, type Sequelize } from "sequelize";
import type { Model } from "sequelize";
import {
  defineModel,
  date,
  optionalUuid,
  string,
  text,
  timestamp,
} from "./defineModel.js";

export interface CentreAttributes {
  id: string; slug: string | null; name: string; code: string | null; area: string | null;
  address: string | null; city: string | null; region: string | null; mapEmbed: string | null;
  mapLink: string | null; leadCoach: string | null; staffEmails: string[]; ageGroups: string[];
  schedule: string | null; image: string | null; comingSoon: boolean; approvedFee: string | null;
  capacity: number | null; contactName: string | null; contactPhone: string | null; contactEmail: string | null;
  operationalNotes: string | null; registrationAvailable: boolean; reviewStatus: string | null;
  status: string; proposedArea: boolean;
}
export type CentreInstance = Model<CentreAttributes, Partial<CentreAttributes>>;
export interface ProgrammeAttributes {
  id: string; slug: string | null; name: string; tagline: string | null; code: string | null;
  description: string | null; ageGroup: string | null; trainingDays: string[]; duration: string | null;
  price: string | null; benefits: string[]; requirements: string[]; equipment: string[]; icon: string | null;
  featured: boolean; ageGroupLabel: string | null; ageMin: number | null; ageMax: number | null;
  approvedFee: string | null; currency: string; schedule: string | null; capacity: number | null;
  assessmentsRequired: boolean; availability: string | null; status: string; notes: string | null;
}
export type ProgrammeInstance = Model<ProgrammeAttributes, Partial<ProgrammeAttributes>>;

export const defineAcademyModels = (sequelize: Sequelize) => ({
  Centre: defineModel<CentreAttributes>(sequelize, "Centre", "centres", {
    slug: string(180),
    name: { type: DataTypes.STRING(180), allowNull: false },
    code: string(40),
    area: string(160),
    address: text(),
    city: string(160),
    region: string(160),
    mapEmbed: { type: DataTypes.TEXT, field: "map_embed" },
    mapLink: { type: DataTypes.TEXT, field: "map_link" },
    leadCoach: string(200),
    staffEmails: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      field: "staff_emails",
    },
    ageGroups: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      defaultValue: [],
      field: "age_groups",
    },
    schedule: text(),
    image: text(),
    comingSoon: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "coming_soon" },
    approvedFee: { type: DataTypes.DECIMAL(12, 2), field: "approved_fee" },
    capacity: DataTypes.INTEGER,
    contactName: { type: DataTypes.STRING(200), field: "contact_name" },
    contactPhone: { type: DataTypes.STRING(40), field: "contact_phone" },
    contactEmail: { type: DataTypes.STRING(320), field: "contact_email" },
    operationalNotes: { type: DataTypes.TEXT, field: "operational_notes" },
    registrationAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "registration_available",
    },
    reviewStatus: { type: DataTypes.STRING(32), field: "review_status" },
    status: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "pending_verification",
    },
    proposedArea: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "proposed_area",
    },
  }),
  Programme: defineModel<ProgrammeAttributes>(sequelize, "Programme", "programmes", {
    slug: string(180),
    name: { type: DataTypes.STRING(180), allowNull: false },
    tagline: text(),
    code: { type: DataTypes.STRING(40), unique: true },
    description: text(),
    ageGroup: { type: DataTypes.STRING(80), field: "age_group" },
    trainingDays: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [], field: "training_days" },
    duration: string(160),
    price: text(),
    benefits: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    requirements: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    equipment: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    icon: string(120),
    featured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    ageGroupLabel: { type: DataTypes.STRING(80), field: "age_group_label" },
    ageMin: { type: DataTypes.INTEGER, field: "age_min" },
    ageMax: { type: DataTypes.INTEGER, field: "age_max" },
    approvedFee: { type: DataTypes.DECIMAL(12, 2), field: "approved_fee" },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "NGN",
    },
    schedule: text(),
    capacity: DataTypes.INTEGER,
    assessmentsRequired: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "assessments_required",
    },
    availability: string(40),
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "active",
    },
    notes: text(),
  }),
  CentreProgramme: defineModel(
    sequelize,
    "CentreProgramme",
    "centre_programmes",
    {
      centreId: { type: DataTypes.UUID, allowNull: false, field: "centre_id" },
      programmeId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "programme_id",
      },
    },
  ),
  Player: defineModel(
    sequelize,
    "Player",
    "players",
    {
      playerCode: {
        type: DataTypes.STRING(40),
        unique: true,
        field: "player_code",
      },
      fullName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "full_name",
      },
      dateOfBirth: { ...date(false), field: "date_of_birth" },
      ageGroup: { type: DataTypes.STRING(20), field: "age_group" },
      centreId: { ...optionalUuid(), field: "centre_id" },
      programmeId: { ...optionalUuid(), field: "programme_id" },
      registrationStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "registered",
        field: "registration_status",
      },
      scholarshipStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "none",
        field: "scholarship_status",
      },
      documentVerification: {
        type: DataTypes.STRING(24),
        defaultValue: "pending",
        field: "document_verification",
      },
      developmentNotes: { type: DataTypes.TEXT, field: "development_notes" },
      matchAppearances: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "match_appearances",
      },
      matchNotes: { type: DataTypes.TEXT, field: "match_notes" },
      school: DataTypes.STRING(180),
      archived: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      archivedReason: { type: DataTypes.TEXT, field: "archived_reason" },
      registrationId: { ...optionalUuid(), field: "registration_id" },
    },
    {
      defaultScope: {
        attributes: {
          exclude: [
            "fullName",
            "dateOfBirth",
            "school",
            "developmentNotes",
            "matchNotes",
          ],
        },
      },
      scopes: {
        withPersonalData: {
          attributes: [
            "id",
            "playerCode",
            "fullName",
            "dateOfBirth",
            "ageGroup",
            "centreId",
            "programmeId",
            "registrationStatus",
            "scholarshipStatus",
            "documentVerification",
            "school",
            "archived",
            "archivedReason",
            "registrationId",
            "createdAt",
            "updatedAt",
          ],
        },
      },
    },
  ),
  Guardian: defineModel(
    sequelize,
    "Guardian",
    "guardians",
    {
      fullName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "full_name",
      },
      email: { type: DataTypes.STRING(320), validate: { isEmail: true } },
      phone: { type: DataTypes.STRING(40), allowNull: false },
      address: DataTypes.TEXT,
      preferredContact: {
        type: DataTypes.STRING(24),
        field: "preferred_contact",
      },
      communicationPreferences: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        field: "communication_preferences",
      },
      accountStatus: {
        type: DataTypes.STRING(24),
        defaultValue: "active",
        field: "account_status",
      },
      consentStatus: {
        type: DataTypes.STRING(24),
        defaultValue: "pending",
        field: "consent_status",
      },
      notes: DataTypes.TEXT,
    },
    {
      defaultScope: {
        attributes: {
          exclude: ["fullName", "email", "phone", "address", "notes"],
        },
      },
      scopes: { withContactData: { attributes: { exclude: [] } } },
    },
  ),
  PlayerGuardian: defineModel(sequelize, "PlayerGuardian", "player_guardians", {
    playerId: { type: DataTypes.UUID, allowNull: false, field: "player_id" },
    guardianId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "guardian_id",
    },
    relationship: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "guardian",
    },
    isPrimary: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_primary",
    },
    isEmergencyContact: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "is_emergency_contact",
    },
    notes: DataTypes.TEXT,
  }),
  Registration: defineModel(
    sequelize,
    "Registration",
    "registrations",
    {
      reference: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      guardianName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "guardian_name",
      },
      guardianEmail: { type: DataTypes.STRING(320), field: "guardian_email" },
      guardianPhone: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "guardian_phone",
      },
      guardianAddress: { type: DataTypes.TEXT, field: "guardian_address" },
      childName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "child_name",
      },
      childDateOfBirth: { ...date(), field: "child_date_of_birth" },
      centreId: { ...optionalUuid(), field: "centre_id" },
      programmeId: { ...optionalUuid(), field: "programme_id" },
      ageGroup: { type: DataTypes.STRING(20), field: "age_group" },
      pathway: { type: DataTypes.STRING(32), defaultValue: "paid_academy" },
      documentStatus: {
        type: DataTypes.STRING(24),
        defaultValue: "pending",
        field: "document_status",
      },
      consentMedia: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "consent_media",
      },
      consentData: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "consent_data",
      },
      consentMedical: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "consent_medical",
      },
      paymentStatus: {
        type: DataTypes.STRING(24),
        defaultValue: "unpaid",
        field: "payment_status",
      },
      amountDue: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
        field: "amount_due",
      },
      paymentReference: {
        type: DataTypes.STRING(120),
        field: "payment_reference",
      },
      guardianId: { ...optionalUuid(), field: "guardian_id" },
      assignedReviewerId: { ...optionalUuid(), field: "assigned_reviewer_id" },
      internalNotes: { type: DataTypes.TEXT, field: "internal_notes" },
      submittedAt: { type: DataTypes.DATE, field: "submitted_at" },
      reviewedAt: { type: DataTypes.DATE, field: "reviewed_at" },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "submitted",
      },
      source: { type: DataTypes.STRING(32), defaultValue: "admin" },
      linkedPlayerId: { ...optionalUuid(), field: "linked_player_id" },
    },
    {
      defaultScope: {
        attributes: {
          exclude: [
            "guardianName",
            "guardianEmail",
            "guardianPhone",
            "guardianAddress",
            "childName",
            "childDateOfBirth",
            "internalNotes",
          ],
        },
      },
      scopes: { withPersonalData: { attributes: { exclude: [] } } },
    },
  ),
  RegistrationDocument: defineModel(
    sequelize,
    "RegistrationDocument",
    "registration_documents",
    {
      registrationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "registration_id",
      },
      mediaAssetId: { ...optionalUuid(), field: "media_asset_id" },
      name: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "pending",
      },
      verifiedById: { ...optionalUuid(), field: "verified_by_id" },
      verifiedAt: { ...timestamp(), field: "verified_at" },
    },
  ),
  RegistrationStatusHistory: defineModel(
    sequelize,
    "RegistrationStatusHistory",
    "registration_status_history",
    {
      registrationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "registration_id",
      },
      status: { type: DataTypes.STRING(32), allowNull: false },
      note: DataTypes.TEXT,
      actorId: { ...optionalUuid(), field: "actor_id" },
    },
  ),
  AttendanceSession: defineModel(
    sequelize,
    "AttendanceSession",
    "attendance_sessions",
    {
      centreId: { ...optionalUuid(), field: "centre_id" },
      programmeId: { ...optionalUuid(), field: "programme_id" },
      sessionDate: { ...date(false), field: "session_date" },
      coachId: { ...optionalUuid(), field: "coach_id" },
      status: { type: DataTypes.STRING(24), defaultValue: "scheduled" },
      presentCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "present_count",
      },
      absentCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: "absent_count",
      },
      notes: DataTypes.TEXT,
    },
  ),
  AttendanceRecord: defineModel(
    sequelize,
    "AttendanceRecord",
    "attendance_records",
    {
      sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "session_id",
      },
      playerId: { type: DataTypes.UUID, allowNull: false, field: "player_id" },
      status: { type: DataTypes.STRING(24), allowNull: false },
      notes: DataTypes.TEXT,
    },
  ),
  Assessment: defineModel(sequelize, "Assessment", "assessments", {
    playerId: { type: DataTypes.UUID, allowNull: false, field: "player_id" },
    registrationId: { ...optionalUuid(), field: "registration_id" },
    type: { type: DataTypes.STRING(40), allowNull: false },
    scheduledAt: { type: DataTypes.DATE, field: "scheduled_at" },
    centreId: { ...optionalUuid(), field: "centre_id" },
    coachId: { ...optionalUuid(), field: "coach_id" },
    status: { type: DataTypes.STRING(24), defaultValue: "scheduled" },
    criteriaScores: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      field: "criteria_scores",
    },
    overallRating: { type: DataTypes.DECIMAL(5, 2), field: "overall_rating" },
    feedback: DataTypes.TEXT,
    improvementTargets: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      field: "improvement_targets",
    },
    completedAt: { type: DataTypes.DATE, field: "completed_at" },
  }),
  ConsentRecord: defineModel(
    sequelize,
    "ConsentRecord",
    "consent_records",
    {
      subjectType: {
        type: DataTypes.STRING(16),
        defaultValue: "player",
        field: "subject_type",
      },
      playerId: { ...optionalUuid(), field: "player_id" },
      guardianId: { ...optionalUuid(), field: "guardian_id" },
      consentType: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "consent_type",
      },
      status: { type: DataTypes.STRING(24), defaultValue: "pending" },
      grantedAt: { ...date(), field: "granted_at" },
      expiresAt: { ...date(), field: "expires_at" },
      documentAssetId: { ...optionalUuid(), field: "document_asset_id" },
      notes: DataTypes.TEXT,
    },
    { defaultScope: { attributes: { exclude: ["documentAssetId", "notes"] } } },
  ),
  PlayerSafeguardingRecord: defineModel(
    sequelize,
    "PlayerSafeguardingRecord",
    "player_safeguarding_records",
    {
      playerId: { type: DataTypes.UUID, allowNull: false, field: "player_id" },
      createdById: { ...optionalUuid(), field: "created_by_id" },
      note: { type: DataTypes.TEXT, allowNull: false },
      classification: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "restricted",
      },
    },
    {
      defaultScope: { attributes: { exclude: ["note"] } },
      scopes: { withRestrictedNote: { attributes: { exclude: [] } } },
    },
  ),
});
