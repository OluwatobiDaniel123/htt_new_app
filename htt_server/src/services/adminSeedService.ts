import { col, fn, where } from "sequelize";
import { z } from "zod";
import { passwordSchema, hashPassword } from "../auth/password.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";

const requiredAdminPermissions = [
  "dashboard",
  "players",
  "guardians",
  "registrations",
  "assessments",
  "attendance",
  "centres",
  "programmes",
  "scholarships",
  "funding",
  "finance",
  "league",
  "communications",
  "content",
  "staff",
  "roles",
  "permissions",
  "reports",
  "audit",
  "safeguarding",
  "settings",
  "staff.create",
  "staff.update",
  "staff.deactivate",
  "staff.assign_roles",
  "roles.manage",
  "permissions.manage",
];

export class AdminSeedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AdminSeedError";
  }
}

export interface AdminSeedInput {
  name: string;
  email: string;
  password: string;
}

interface AdminRolePermission {
  key: string;
  RolePermission?: { accessLevel?: string };
}

interface AdminRoleRecord {
  id: string;
  key: string;
  permissions?: AdminRolePermission[];
}

interface StaffRecord {
  id: string;
}

export type AdminSeedResult =
  | { created: true; email: string }
  | { created: false; email: string };

export async function seedAdminAccount(
  input: AdminSeedInput,
): Promise<AdminSeedResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const passwordResult = passwordSchema.safeParse(input.password);

  if (!name || name.length > 200)
    throw new AdminSeedError("SEED_ADMIN_NAME must be between 1 and 200 characters.");
  if (!z.string().email().max(320).safeParse(email).success)
    throw new AdminSeedError("SEED_ADMIN_EMAIL must be a valid email address.");
  if (!passwordResult.success)
    throw new AdminSeedError(
      `SEED_ADMIN_PASSWORD does not meet the existing password policy: ${passwordResult.error.issues[0]?.message ?? "invalid password"}`,
    );

  try {
    return await sequelize.transaction(async (transaction) => {
    const role = (await models.Role.findOne({
      where: { key: "admin" },
      include: [
        {
          model: models.Permission,
          as: "permissions",
          through: { attributes: ["accessLevel"] },
        },
      ],
      transaction,
    })) as unknown as AdminRoleRecord | null;

    if (!role)
      throw new AdminSeedError(
        'The existing "admin" role is missing. Run the existing database migrations and RBAC seeders against this development/test database first.',
      );

    const allPermissions = (await models.Permission.findAll({
      attributes: ["key"],
      transaction,
    })) as unknown as Array<{ key: string }>;
    const grants = new Map(
      (role.permissions ?? []).map((permission) => [
        permission.key,
        permission.RolePermission?.accessLevel,
      ]),
    );
    const missing = [
      ...requiredAdminPermissions.filter((key) => grants.get(key) !== "full"),
      ...allPermissions
        .map((permission) => permission.key)
        .filter((key) => grants.get(key) !== "full"),
    ];
    if (allPermissions.length === 0 || missing.length > 0) {
      const missingKeys = [...new Set(missing)].join(", ");
      throw new AdminSeedError(
        `The existing admin role is missing full required permissions${missingKeys ? `: ${missingKeys}` : "."} Run the existing RBAC permission seeders on this development/test database; this script will not alter role permissions.`,
      );
    }

    const existing = (await models.StaffAccount.findOne({
      where: where(fn("lower", col("email")), email),
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as unknown as StaffRecord | null;

    if (existing) {
      const adminAssignment = await models.StaffRole.findOne({
        where: { staffAccountId: existing.id, roleId: role.id },
        transaction,
      });
      if (adminAssignment) return { created: false, email };
      throw new AdminSeedError(
        "An account with SEED_ADMIN_EMAIL already exists without the admin role. It was left unchanged; use a different email or assign access through the authenticated staff-management workflow.",
      );
    }

    const passwordHash = await hashPassword(passwordResult.data);
    const staff = (await models.StaffAccount.create(
      { fullName: name, email, passwordHash, active: true },
      { transaction },
    )) as unknown as StaffRecord;
    await models.StaffRole.create(
      { staffAccountId: staff.id, roleId: role.id },
      { transaction },
    );
    await writeAudit({
      action: "auth.seed_admin",
      entityName: "staff_account",
      recordId: staff.id,
      details: "Initial administrator account created by explicit seed command.",
      transaction,
    });

      return { created: true, email };
    });
  } catch (cause) {
    if (cause instanceof AdminSeedError) throw cause;
    throw new AdminSeedError(
      "The administrator seed database transaction failed.",
      { cause },
    );
  }
}
