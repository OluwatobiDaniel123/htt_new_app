import { DataTypes, type Sequelize } from "sequelize";
import { defineModel, optionalUuid } from "./defineModel.js";

export const defineSystemModels = (sequelize: Sequelize) => ({
  AuditLog: defineModel(
    sequelize,
    "AuditLog",
    "audit_logs",
    {
      actorId: { ...optionalUuid(), field: "actor_id" },
      actorEmail: { type: DataTypes.STRING(320), field: "actor_email" },
      actorName: { type: DataTypes.STRING(200), field: "actor_name" },
      action: { type: DataTypes.STRING(80), allowNull: false },
      entityName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "entity_name",
      },
      recordId: { type: DataTypes.STRING(100), field: "record_id" },
      recordLabel: { type: DataTypes.STRING(255), field: "record_label" },
      details: DataTypes.TEXT,
      beforeData: { type: DataTypes.JSONB, field: "before_data" },
      afterData: { type: DataTypes.JSONB, field: "after_data" },
      ipAddress: { type: DataTypes.STRING(64), field: "ip_address" },
      userAgent: { type: DataTypes.TEXT, field: "user_agent" },
    },
    {
      defaultScope: {
        attributes: {
          exclude: [
            "actorEmail",
            "actorName",
            "details",
            "beforeData",
            "afterData",
            "ipAddress",
            "userAgent",
          ],
        },
      },
    },
  ),
  ApplicationSettings: defineModel(
    sequelize,
    "ApplicationSettings",
    "application_settings",
    {
      academyName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        defaultValue: "HTT Academy Nigeria",
        field: "academy_name",
      },
      contactEmail: { type: DataTypes.STRING(320), field: "contact_email" },
      contactPhone: { type: DataTypes.STRING(40), field: "contact_phone" },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: "NGN",
      },
      registrationPrefix: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "HTT-REG",
        field: "registration_prefix",
      },
      playerIdPrefix: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "HTT-P",
        field: "player_id_prefix",
      },
      retentionYears: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 7,
        field: "retention_years",
      },
      paymentProvider: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "paystack",
        field: "payment_provider",
      },
      leagueStatus: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "planned",
        field: "league_status",
      },
      schoolProjectStatus: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "proposed",
        field: "school_project_status",
      },
      scholarshipTarget: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
        field: "scholarship_target",
      },
      assessmentCriteria: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
        field: "assessment_criteria",
      },
    },
  ),
});
