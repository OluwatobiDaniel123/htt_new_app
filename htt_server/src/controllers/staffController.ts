/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { Op } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "../services/auditService.js";
import { sendPasswordLink } from "../services/emailService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createRefreshToken,
  hashToken,
  resetTokenExpiry,
} from "../auth/tokens.js";
import { hashPassword } from "../auth/password.js";

const roleIncludes = [
  { model: models.Role, as: "roles", through: { attributes: [] } },
];
const staffJson = (staff: any) => ({
  id: staff.id,
  email: staff.email,
  fullName: staff.fullName,
  phone: staff.phone,
  active: staff.active,
  suspendedAt: staff.suspendedAt,
  lastLoginAt: staff.lastLoginAt,
  createdAt: staff.createdAt,
  roles: (staff.roles ?? []).map((r: any) => ({
    id: r.id,
    key: r.key,
    name: r.name,
  })),
});
const roleIds = async (ids: unknown) => {
  if (
    !Array.isArray(ids) ||
    ids.length > 20 ||
    ids.some((id) => typeof id !== "string")
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Role IDs must be an array of UUIDs.",
    );
  if (!ids.length) return [];
  const rows = await models.Role.findAll({ where: { id: { [Op.in]: ids } } });
  if (rows.length !== new Set(ids).size)
    throw new AppError(400, "INVALID_ROLES", "One or more roles do not exist.");
  return rows;
};
const ensureNotFinalAdmin = async (staffId: string, transaction: any) => {
  const admin = (await models.Role.findOne({
    where: { key: "admin" },
    transaction,
    lock: transaction.LOCK.UPDATE,
  })) as any;
  if (!admin) return;
  const current = await models.StaffRole.findOne({
    where: { staffAccountId: staffId, roleId: admin.id },
    transaction,
  });
  if (!current) return;
  const admins = await models.StaffRole.findAll({
    where: { roleId: admin.id },
    include: [
      {
        model: models.StaffAccount,
        as: "staffAccount",
        where: { active: true, suspendedAt: null },
        attributes: ["id"],
      },
    ],
    transaction,
  });
  if (admins.length <= 1)
    throw new AppError(
      409,
      "FINAL_ADMIN_REQUIRED",
      "The final active administrator cannot be deactivated or demoted.",
    );
};

export const listStaff: RequestHandler = asyncHandler(async (req, res) => {
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25));
  const where: any = {};
  if (req.query.active === "true") where.active = true;
  if (req.query.active === "false") where.active = false;
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const term = `%${req.query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.or] = [
      { fullName: { [Op.iLike]: term } },
      { email: { [Op.iLike]: term } },
    ];
  }
  const result = await models.StaffAccount.findAndCountAll({
    where,
    include: roleIncludes,
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  res.json({
    success: true,
    data: {
      items: result.rows.map(staffJson),
      page,
      limit,
      total: result.count,
    },
  });
});

export const getStaff: RequestHandler = asyncHandler(async (req, res) => {
  const staff = (await models.StaffAccount.findByPk(req.params.id as string, {
    include: roleIncludes,
  })) as any;
  if (!staff) throw new AppError(404, "NOT_FOUND", "Staff account not found.");
  const roleIdsList = (staff.roles ?? []).map((role: any) => role.id);
  const links = roleIdsList.length
    ? ((await models.RolePermission.findAll({
        where: { roleId: { [Op.in]: roleIdsList } },
        include: [{ model: models.Permission, as: "permission" }],
      })) as any[])
    : [];
  const permissions: Record<string, "view" | "full"> = {};
  for (const link of links)
    if (link.permission)
      permissions[link.permission.key] =
        link.accessLevel === "full"
          ? "full"
          : (permissions[link.permission.key] ?? "view");
  res.json({ success: true, data: { staff: staffJson(staff), permissions } });
});

export const createStaff: RequestHandler = asyncHandler(async (req, res) => {
  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const fullName =
    typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !fullName ||
    fullName.length > 200
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "A valid email and full name are required.",
    );
  const roles = await roleIds(req.body.roleIds ?? []);
  if (await models.StaffAccount.findOne({ where: { email } }))
    throw new AppError(
      409,
      "EMAIL_EXISTS",
      "A staff account with this email already exists.",
    );
  const staff = await sequelize.transaction(async (transaction) => {
    const created = (await models.StaffAccount.create(
      {
        email,
        fullName,
        phone: req.body.phone ?? null,
        active: false,
        passwordHash: await hashPassword(createRefreshToken()),
      },
      { transaction },
    )) as any;
    if (roles.length) await (created as any).setRoles(roles, { transaction });
    const inviteToken = createRefreshToken();
    await models.PasswordResetToken.create(
      {
        staffAccountId: created.id,
        tokenHash: hashToken(inviteToken),
        purpose: "staff_invite",
        expiresAt: resetTokenExpiry(),
      },
      { transaction },
    );
    await writeAudit({
      actorId: req.auth!.staffId,
      action: "staff.created",
      entityName: "staff_account",
      recordId: created.id,
      transaction,
      ipAddress: req.ip,
    });
    return { created, inviteToken };
  });
  const delivered = await sendPasswordLink(
    email,
    staff.inviteToken,
    "staff_invite",
  );
  res
    .status(201)
    .json({
      success: true,
      data: {
        staff: staffJson(
          await models.StaffAccount.findByPk(staff.created.id, {
            include: roleIncludes,
          }),
        ),
        invitation: delivered ? "sent" : "pending_email_configuration",
      },
    });
});

export const updateStaff: RequestHandler = asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (req.body.roleIds !== undefined && id === req.auth!.staffId)
    throw new AppError(
      403,
      "SELF_ROLE_CHANGE",
      "You cannot change your own role assignments.",
    );
  const staff = (await models.StaffAccount.findByPk(id)) as any;
  if (!staff) throw new AppError(404, "NOT_FOUND", "Staff account not found.");
  const updates: any = {};
  if (req.body.fullName !== undefined) {
    if (
      typeof req.body.fullName !== "string" ||
      !req.body.fullName.trim() ||
      req.body.fullName.length > 200
    )
      throw new AppError(400, "VALIDATION_ERROR", "Full name is invalid.");
    updates.fullName = req.body.fullName.trim();
  }
  if (req.body.phone !== undefined) {
    if (
      req.body.phone !== null &&
      (typeof req.body.phone !== "string" || req.body.phone.length > 40)
    )
      throw new AppError(400, "VALIDATION_ERROR", "Phone is invalid.");
    updates.phone = req.body.phone;
  }
  if (req.body.email !== undefined) {
    if (
      typeof req.body.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email.trim())
    )
      throw new AppError(400, "VALIDATION_ERROR", "Email is invalid.");
    updates.email = req.body.email.trim().toLowerCase();
  }
  if (req.body.password !== undefined)
    throw new AppError(
      400,
      "CREDENTIAL_CHANGE_NOT_ALLOWED",
      "Use the authenticated password-change or reset flow.",
    );
  const roles =
    req.body.roleIds === undefined ? null : await roleIds(req.body.roleIds);
  await sequelize.transaction(async (transaction) => {
    if (roles && staff.active) await ensureNotFinalAdmin(id, transaction);
    await staff.update(updates, { transaction });
    if (roles) await (staff as any).setRoles(roles, { transaction });
    await writeAudit({
      actorId: req.auth!.staffId,
      action: roles ? "staff.roles_assigned" : "staff.updated",
      entityName: "staff_account",
      recordId: id,
      transaction,
      ipAddress: req.ip,
    });
  });
  res.json({
    success: true,
    data: {
      staff: staffJson(
        await models.StaffAccount.findByPk(id, { include: roleIncludes }),
      ),
    },
  });
});

export const setStaffStatus: RequestHandler = asyncHandler(async (req, res) => {
  if (req.params.id === req.auth!.staffId && req.body.active === false)
    throw new AppError(
      403,
      "SELF_DEACTIVATION",
      "You cannot deactivate your own account.",
    );
  if (typeof req.body.active !== "boolean")
    throw new AppError(400, "VALIDATION_ERROR", "active must be a boolean.");
  const id = req.params.id as string;
  const staff = (await models.StaffAccount.findByPk(id)) as any;
  if (!staff) throw new AppError(404, "NOT_FOUND", "Staff account not found.");
  await sequelize.transaction(async (transaction) => {
    if (!req.body.active) await ensureNotFinalAdmin(staff.id, transaction);
    await staff.update(
      {
        active: req.body.active,
        suspendedAt: req.body.active ? null : new Date(),
      },
      { transaction },
    );
    if (!req.body.active)
      await models.RefreshSession.update(
        { revokedAt: new Date() },
        { where: { staffAccountId: staff.id, revokedAt: null }, transaction },
      );
    await writeAudit({
      actorId: req.auth!.staffId,
      action: req.body.active ? "staff.activated" : "staff.suspended",
      entityName: "staff_account",
      recordId: staff.id,
      transaction,
      ipAddress: req.ip,
    });
  });
  res.json({ success: true });
});

export const deactivateStaff: RequestHandler = asyncHandler(
  async (req, res, next) => {
    req.body = { active: false };
    return setStaffStatus(req, res, next);
  },
);
