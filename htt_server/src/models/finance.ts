import { DataTypes, type Sequelize } from "sequelize";
import type { Model } from "sequelize";
import { defineModel, optionalUuid, timestamp } from "./defineModel.js";

export interface ScholarshipApplicationAttributes {
  id: string; reference: string; applicantName: string; guardianName: string; guardianEmail: string | null;
  guardianPhone: string | null; playerId: string | null; centreId: string | null; programmeId: string | null;
  eligibilityChecks: unknown[]; assessmentId: string | null; assessmentResult: string | null; notes: string | null;
  status: string; decisionNotes: string | null; awardAmount: string | null; fundingSecured: string | null;
  fundingRequired: string | null; startDate: string | null; endDate: string | null; renewalDate: string | null;
}
export type ScholarshipApplicationInstance = Model<ScholarshipApplicationAttributes, Partial<ScholarshipApplicationAttributes>>;

export const defineFinanceModels = (sequelize: Sequelize) => ({
  Payment: defineModel(
    sequelize,
    "Payment",
    "payments",
    {
      reference: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      registrationId: { ...optionalUuid(), field: "registration_id" },
      playerId: { ...optionalUuid(), field: "player_id" },
      playerName: { type: DataTypes.STRING(200), field: "player_name" },
      payerName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "payer_name",
      },
      payerEmail: { type: DataTypes.STRING(320), field: "payer_email" },
      guardianId: { ...optionalUuid(), field: "guardian_id" },
      programmeId: { ...optionalUuid(), field: "programme_id" },
      centreId: { ...optionalUuid(), field: "centre_id" },
      idempotencyKey: {
        type: DataTypes.STRING(120),
        field: "idempotency_key",
        unique: true,
      },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      providerStatus: { type: DataTypes.STRING(40), field: "provider_status" },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: "NGN",
      },
      method: { type: DataTypes.STRING(32), allowNull: false },
      purpose: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "registration",
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "pending",
      },
      paidAt: { type: DataTypes.DATE, field: "paid_at" },
      receiptNumber: {
        type: DataTypes.STRING(100),
        unique: true,
        field: "receipt_number",
      },
      gatewayReference: {
        type: DataTypes.STRING(160),
        unique: true,
        field: "gateway_reference",
      },
      refundAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
        field: "refund_amount",
      },
      refundReason: { type: DataTypes.TEXT, field: "refund_reason" },
      notes: DataTypes.TEXT,
      recordedById: { ...optionalUuid(), field: "recorded_by_id" },
    },
    {
      defaultScope: {
        attributes: {
          exclude: ["payerName", "playerName", "gatewayReference", "notes"],
        },
      },
      scopes: { withFinancialDetails: { attributes: { exclude: [] } } },
    },
  ),
  PaymentAllocation: defineModel(
    sequelize,
    "PaymentAllocation",
    "payment_allocations",
    {
      paymentId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "payment_id",
      },
      registrationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "registration_id",
      },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    },
  ),
  PaymentEvent: defineModel(sequelize, "PaymentEvent", "payment_events", {
    paymentId: { ...optionalUuid(), field: "payment_id" },
    provider: { type: DataTypes.STRING(32), allowNull: false },
    providerEventId: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "provider_event_id",
    },
    eventType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "event_type",
    },
    receivedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "received_at",
    },
    processedAt: { ...timestamp(), field: "processed_at" },
    processingStatus: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "received",
      field: "processing_status",
    },
    payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  }),
  Refund: defineModel(sequelize, "Refund", "refunds", {
    paymentId: { type: DataTypes.UUID, allowNull: false, field: "payment_id" },
    reference: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    gatewayReference: {
      type: DataTypes.STRING(160),
      unique: true,
      field: "gateway_reference",
    },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "NGN",
    },
    reason: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "requested",
    },
    requestedById: { ...optionalUuid(), field: "requested_by_id" },
    approvedById: { ...optionalUuid(), field: "approved_by_id" },
    processedAt: { type: DataTypes.DATE, field: "processed_at" },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  }),
  Sponsor: defineModel(sequelize, "Sponsor", "sponsors", {
    name: { type: DataTypes.STRING(200), allowNull: false },
    type: { type: DataTypes.STRING(40), allowNull: false },
    contactName: { type: DataTypes.STRING(200), field: "contact_name" },
    email: { type: DataTypes.STRING(320), validate: { isEmail: true } },
    phone: DataTypes.STRING(40),
    organisation: DataTypes.STRING(200),
    address: DataTypes.TEXT,
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "active",
    },
    notes: DataTypes.TEXT,
  }),
  SponsorCommunication: defineModel(
    sequelize,
    "SponsorCommunication",
    "sponsor_communications",
    {
      sponsorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "sponsor_id",
      },
      staffAccountId: { ...optionalUuid(), field: "staff_account_id" },
      channel: { type: DataTypes.STRING(24), allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: false },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "occurred_at",
      },
    },
  ),
  FundingRecord: defineModel(sequelize, "FundingRecord", "funding_records", {
    sponsorId: { ...optionalUuid(), field: "sponsor_id" },
    category: { type: DataTypes.STRING(40), allowNull: false },
    kind: { type: DataTypes.STRING(24), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: "NGN",
    },
    reference: { type: DataTypes.STRING(100), unique: true },
    recordDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "record_date",
    },
    status: { type: DataTypes.STRING(24), allowNull: false },
    targetLabel: { type: DataTypes.STRING(200), field: "target_label" },
    notes: DataTypes.TEXT,
  }),
  ScholarshipApplication: defineModel<ScholarshipApplicationAttributes>(
    sequelize,
    "ScholarshipApplication",
    "scholarship_applications",
    {
      reference: { type: DataTypes.STRING(60), allowNull: false, unique: true },
      applicantName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "applicant_name",
      },
      guardianName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "guardian_name",
      },
      guardianEmail: { type: DataTypes.STRING(320), field: "guardian_email" },
      guardianPhone: { type: DataTypes.STRING(40), field: "guardian_phone" },
      playerId: { ...optionalUuid(), field: "player_id" },
      centreId: { ...optionalUuid(), field: "centre_id" },
      programmeId: { ...optionalUuid(), field: "programme_id" },
      eligibilityChecks: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: "eligibility_checks",
      },
      assessmentId: { ...optionalUuid(), field: "assessment_id" },
      assessmentResult: {
        type: DataTypes.STRING(40),
        field: "assessment_result",
      },
      notes: DataTypes.TEXT,
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "received",
      },
      decisionNotes: { type: DataTypes.TEXT, field: "decision_notes" },
      awardAmount: { type: DataTypes.DECIMAL(12, 2), field: "award_amount" },
      fundingSecured: {
        type: DataTypes.DECIMAL(12, 2),
        field: "funding_secured",
      },
      fundingRequired: {
        type: DataTypes.DECIMAL(12, 2),
        field: "funding_required",
      },
      startDate: { type: DataTypes.DATEONLY, field: "start_date" },
      endDate: { type: DataTypes.DATEONLY, field: "end_date" },
      renewalDate: { type: DataTypes.DATEONLY, field: "renewal_date" },
    },
  ),
  ScholarshipDocument: defineModel(
    sequelize,
    "ScholarshipDocument",
    "scholarship_documents",
    {
      applicationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "application_id",
      },
      mediaAssetId: { ...optionalUuid(), field: "media_asset_id" },
      name: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "pending",
      },
    },
  ),
  ScholarshipDecision: defineModel(
    sequelize,
    "ScholarshipDecision",
    "scholarship_decisions",
    {
      applicationId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "application_id",
      },
      reviewerId: { ...optionalUuid(), field: "reviewer_id" },
      status: { type: DataTypes.STRING(32), allowNull: false },
      note: DataTypes.TEXT,
    },
  ),
  ScholarshipAward: defineModel(
    sequelize,
    "ScholarshipAward",
    "scholarship_awards",
    {
      applicationId: { ...optionalUuid(), field: "application_id" },
      playerId: { type: DataTypes.UUID, allowNull: false, field: "player_id" },
      programmeId: { ...optionalUuid(), field: "programme_id" },
      centreId: { ...optionalUuid(), field: "centre_id" },
      awardAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        field: "award_amount",
      },
      benefitDescription: {
        type: DataTypes.TEXT,
        field: "benefit_description",
      },
      fundingSecured: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
        field: "funding_secured",
      },
      fundingRequired: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0,
        field: "funding_required",
      },
      startDate: { type: DataTypes.DATEONLY, field: "start_date" },
      endDate: { type: DataTypes.DATEONLY, field: "end_date" },
      renewalDate: { type: DataTypes.DATEONLY, field: "renewal_date" },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "active",
      },
      notes: DataTypes.TEXT,
    },
  ),
  ScholarshipAwardSponsor: defineModel(
    sequelize,
    "ScholarshipAwardSponsor",
    "scholarship_award_sponsors",
    {
      scholarshipAwardId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "scholarship_award_id",
      },
      sponsorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "sponsor_id",
      },
    },
  ),
});
