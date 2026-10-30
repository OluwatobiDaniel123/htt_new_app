import type { PermissionLevel } from "./auth.types.js";

const levelRank: Record<PermissionLevel, number> = { view: 1, full: 2 };

export const hasPermission = (
  permissions: Record<string, PermissionLevel>,
  key: string,
  required: PermissionLevel = "view",
) => {
  const granted = permissions[key];
  return granted !== undefined && levelRank[granted] >= levelRank[required];
};

export const permissionKeys = {
  staffRead: "staff",
  staffCreate: "staff.create",
  staffUpdate: "staff.update",
  staffDeactivate: "staff.deactivate",
  staffAssignRoles: "staff.assign_roles",
  rolesRead: "roles",
  rolesManage: "roles.manage",
  permissionsRead: "permissions",
  permissionsManage: "permissions.manage",
  playersSensitive: "players.read_sensitive",
  guardiansContact: "guardians.read_contact",
  registrationsApprove: "registrations.approve",
  paymentsRecord: "payments.record",
  paymentsRefund: "payments.refund",
  safeguardingManage: "safeguarding.manage",
  auditSensitive: "audit.read_sensitive",
} as const;
