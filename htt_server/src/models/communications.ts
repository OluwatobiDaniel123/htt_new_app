import { DataTypes, type Sequelize } from "sequelize";
import type { Model } from "sequelize";
import { defineModel, optionalUuid, timestamp } from "./defineModel.js";

export interface EnquiryAttributes {
  id: string; contactName: string; email: string | null; phone: string | null; type: string; source: string | null;
  status: string; assignedToId: string | null; priority: string | null; subject: string | null; message: string | null;
  notes: string | null; nextFollowUp: Date | null; consentToContact: boolean | null; optedOut: boolean | null;
}
export type EnquiryInstance = Model<EnquiryAttributes, Partial<EnquiryAttributes>>;
export interface SponsorshipEnquiryAttributes {
  id: string; contactName: string; organisation: string | null; email: string | null; phone: string | null;
  category: string; proposedAmount: string | number | null; status: string; priority: string | null; notes: string | null;
  source: string | null; assignedToId: string | null;
}
export type SponsorshipEnquiryInstance = Model<SponsorshipEnquiryAttributes, Partial<SponsorshipEnquiryAttributes>>;

export const defineCommunicationModels = (sequelize: Sequelize) => ({
  Enquiry: defineModel<EnquiryAttributes>(sequelize, "Enquiry", "enquiries", {
    contactName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "contact_name",
    },
    email: { type: DataTypes.STRING(320), validate: { isEmail: true } },
    phone: DataTypes.STRING(40),
    type: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "general",
    },
    source: { type: DataTypes.STRING(40), defaultValue: "admin" },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "new",
    },
    assignedToId: { ...optionalUuid(), field: "assigned_to_id" },
    priority: { type: DataTypes.STRING(20), defaultValue: "medium" },
    subject: DataTypes.STRING(200),
    message: DataTypes.TEXT,
    notes: DataTypes.TEXT,
    nextFollowUp: { type: DataTypes.DATE, field: "next_follow_up" },
    consentToContact: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "consent_to_contact",
    },
    optedOut: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "opted_out",
    },
  }),
  EnquiryCommunication: defineModel(
    sequelize,
    "EnquiryCommunication",
    "enquiry_communications",
    {
      enquiryId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "enquiry_id",
      },
      staffAccountId: { ...optionalUuid(), field: "staff_account_id" },
      channel: { type: DataTypes.STRING(24), allowNull: false },
      direction: { type: DataTypes.STRING(16), allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: false },
      occurredAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "occurred_at",
      },
    },
  ),
  FollowUpTask: defineModel(sequelize, "FollowUpTask", "follow_up_tasks", {
    title: { type: DataTypes.STRING(200), allowNull: false },
    enquiryId: { ...optionalUuid(), field: "enquiry_id" },
    contactName: { type: DataTypes.STRING(200), field: "contact_name" },
    assignedToId: { ...optionalUuid(), field: "assigned_to_id" },
    dueDate: { type: DataTypes.DATEONLY, field: "due_date" },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "open",
    },
    priority: { type: DataTypes.STRING(20), defaultValue: "medium" },
    notes: DataTypes.TEXT,
    completedAt: { type: DataTypes.DATE, field: "completed_at" },
  }),
  SponsorshipEnquiry: defineModel<SponsorshipEnquiryAttributes>(
    sequelize,
    "SponsorshipEnquiry",
    "sponsorship_enquiries",
    {
      contactName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "contact_name",
      },
      organisation: DataTypes.STRING(200),
      email: { type: DataTypes.STRING(320), validate: { isEmail: true } },
      phone: DataTypes.STRING(40),
      category: { type: DataTypes.STRING(40), allowNull: false },
      proposedAmount: {
        type: DataTypes.DECIMAL(12, 2),
        field: "proposed_amount",
      },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "new",
      },
      priority: { type: DataTypes.STRING(20), defaultValue: "medium" },
      notes: DataTypes.TEXT,
      source: { type: DataTypes.STRING(40), defaultValue: "admin" },
      assignedToId: { ...optionalUuid(), field: "assigned_to_id" },
    },
  ),
  Notification: defineModel(sequelize, "Notification", "notifications", {
    title: { type: DataTypes.STRING(200), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.STRING(40), allowNull: false },
    category: DataTypes.STRING(40),
    link: DataTypes.TEXT,
    read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    forStaffId: { ...optionalUuid(), field: "for_staff_id" },
    deliveredAt: { ...timestamp(), field: "delivered_at" },
    eventKey: { type: DataTypes.STRING(180), unique: true, field: "event_key" },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  }),
  NotificationOutbox: defineModel(
    sequelize,
    "NotificationOutbox",
    "notification_outbox",
    {
      eventKey: {
        type: DataTypes.STRING(180),
        allowNull: false,
        unique: true,
        field: "event_key",
      },
      eventType: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: "event_type",
      },
      aggregateType: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "aggregate_type",
      },
      aggregateId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "aggregate_id",
      },
      recipientStaffId: { ...optionalUuid(), field: "recipient_staff_id" },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      channels: {
        type: DataTypes.ARRAY(DataTypes.STRING(16)),
        allowNull: false,
        defaultValue: [],
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "pending",
      },
      availableAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "available_at",
      },
      lockedAt: { ...timestamp(), field: "locked_at" },
      attemptCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "attempt_count",
      },
      lastErrorCode: { type: DataTypes.STRING(80), field: "last_error_code" },
      processedAt: { ...timestamp(), field: "processed_at" },
    },
  ),
  NotificationAttempt: defineModel(
    sequelize,
    "NotificationAttempt",
    "notification_attempts",
    {
      outboxId: { type: DataTypes.UUID, allowNull: false, field: "outbox_id" },
      channel: { type: DataTypes.STRING(16), allowNull: false },
      recipientHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "recipient_hash",
      },
      status: { type: DataTypes.STRING(16), allowNull: false },
      providerMessageId: {
        type: DataTypes.STRING(200),
        field: "provider_message_id",
      },
      errorCode: { type: DataTypes.STRING(80), field: "error_code" },
      attemptedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: "attempted_at",
      },
    },
  ),
  NotificationPreference: defineModel(
    sequelize,
    "NotificationPreference",
    "notification_preferences",
    {
      staffAccountId: {
        ...optionalUuid(),
        unique: true,
        field: "staff_account_id",
      },
      guardianId: { ...optionalUuid(), unique: true, field: "guardian_id" },
      emailEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "email_enabled",
      },
      smsEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "sms_enabled",
      },
      inAppEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "in_app_enabled",
      },
      categoryPreferences: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        field: "category_preferences",
      },
      smsConsentAt: { ...timestamp(), field: "sms_consent_at" },
      smsRevokedAt: { ...timestamp(), field: "sms_revoked_at" },
      consentSource: { type: DataTypes.STRING(40), field: "consent_source" },
    },
  ),
});
