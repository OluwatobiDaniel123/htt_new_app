import { DataTypes, type Sequelize } from "sequelize";
import { defineModel, string, timestamp } from "./defineModel.js";

export const defineIdentityModels = (sequelize: Sequelize) => ({
  StaffAccount: defineModel(
    sequelize,
    "StaffAccount",
    "staff_accounts",
    {
      email: {
        ...string(320, false),
        unique: true,
        validate: { isEmail: true },
      },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "password_hash",
      },
      fullName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: "full_name",
      },
      phone: string(40),
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      suspendedAt: timestamp(),
      lastLoginAt: timestamp(),
    },
    {
      defaultScope: { attributes: { exclude: ["passwordHash", "phone"] } },
      scopes: {
        withCredentials: { attributes: { include: ["passwordHash"] } },
      },
    },
  ),
  Role: defineModel(sequelize, "Role", "roles", {
    key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    description: DataTypes.TEXT,
    systemRole: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "system_role",
    },
  }),
  Permission: defineModel(sequelize, "Permission", "permissions", {
    key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    description: DataTypes.TEXT,
  }),
  StaffRole: defineModel(sequelize, "StaffRole", "staff_roles", {
    staffAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "staff_account_id",
    },
    roleId: { type: DataTypes.UUID, allowNull: false, field: "role_id" },
  }),
  StaffCentre: defineModel(sequelize, "StaffCentre", "staff_centres", {
    staffAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "staff_account_id",
    },
    centreId: { type: DataTypes.UUID, allowNull: false, field: "centre_id" },
  }),
  RolePermission: defineModel(sequelize, "RolePermission", "role_permissions", {
    roleId: { type: DataTypes.UUID, allowNull: false, field: "role_id" },
    permissionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "permission_id",
    },
    accessLevel: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "full",
      field: "access_level",
    },
  }),
  RefreshSession: defineModel(
    sequelize,
    "RefreshSession",
    "refresh_sessions",
    {
      staffAccountId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "staff_account_id",
      },
      familyId: { type: DataTypes.UUID, allowNull: false, field: "family_id" },
      tokenHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: "token_hash",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
      revokedAt: { type: DataTypes.DATE, field: "revoked_at" },
      rotatedAt: { type: DataTypes.DATE, field: "rotated_at" },
      replacedBySessionId: {
        type: DataTypes.UUID,
        field: "replaced_by_session_id",
      },
      createdByIp: { type: DataTypes.STRING(64), field: "created_by_ip" },
    },
    { defaultScope: { attributes: { exclude: ["tokenHash"] } } },
  ),
  PasswordResetToken: defineModel(
    sequelize,
    "PasswordResetToken",
    "password_reset_tokens",
    {
      staffAccountId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "staff_account_id",
      },
      tokenHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        field: "token_hash",
      },
      purpose: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "password_reset",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
      usedAt: { type: DataTypes.DATE, field: "used_at" },
    },
    { defaultScope: { attributes: { exclude: ["tokenHash"] } } },
  ),
});
