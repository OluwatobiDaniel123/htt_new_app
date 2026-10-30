/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { Op } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "../services/auditService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const includePermissions = [
  {
    model: models.Permission,
    as: "permissions",
    through: { attributes: ["accessLevel"] },
  },
];
export const listRoles: RequestHandler = asyncHandler(async (_req, res) =>
  res.json({
    success: true,
    data: await models.Role.findAll({
      include: includePermissions,
      order: [["name", "ASC"]],
    }),
  }),
);
export const getRole: RequestHandler = asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const role = await models.Role.findByPk(id, { include: includePermissions });
  if (!role) throw new AppError(404, "NOT_FOUND", "Role not found.");
  res.json({ success: true, data: role });
});
export const createRole: RequestHandler = asyncHandler(async (req, res) => {
  const key =
    typeof req.body.key === "string" ? req.body.key.trim().toLowerCase() : "";
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!/^[a-z][a-z0-9_-]{1,63}$/.test(key) || !name || name.length > 120)
    throw new AppError(400, "VALIDATION_ERROR", "Role key or name is invalid.");
  const role = (await models.Role.create({
    key,
    name,
    description: req.body.description ?? null,
    systemRole: false,
  })) as any;
  await writeAudit({
    actorId: req.auth!.staffId,
    action: "role.created",
    entityName: "role",
    recordId: role.id,
    ipAddress: req.ip,
  });
  res.status(201).json({ success: true, data: role });
});
export const updateRole: RequestHandler = asyncHandler(async (req, res) => {
  const role = (await models.Role.findByPk(req.params.id as string)) as any;
  if (!role) throw new AppError(404, "NOT_FOUND", "Role not found.");
  if (role.systemRole && req.body.key !== undefined)
    throw new AppError(
      403,
      "SYSTEM_ROLE_KEY_LOCKED",
      "System role keys cannot be changed.",
    );
  const values: any = {};
  if (req.body.name !== undefined) {
    if (
      typeof req.body.name !== "string" ||
      !req.body.name.trim() ||
      req.body.name.length > 120
    )
      throw new AppError(400, "VALIDATION_ERROR", "Role name is invalid.");
    values.name = req.body.name.trim();
  }
  if (req.body.description !== undefined)
    values.description = req.body.description;
  if (req.body.key !== undefined) {
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(req.body.key))
      throw new AppError(400, "VALIDATION_ERROR", "Role key is invalid.");
    values.key = req.body.key;
  }
  await role.update(values);
  await writeAudit({
    actorId: req.auth!.staffId,
    action: "role.updated",
    entityName: "role",
    recordId: role.id,
    ipAddress: req.ip,
  });
  res.json({ success: true, data: role });
});
export const listPermissions: RequestHandler = asyncHandler(async (_req, res) =>
  res.json({
    success: true,
    data: await models.Permission.findAll({ order: [["key", "ASC"]] }),
  }),
);
export const getRolePermissions: RequestHandler = asyncHandler(
  async (req, res) => {
    const role = await models.Role.findByPk(req.params.id as string, {
      include: includePermissions,
    });
    if (!role) throw new AppError(404, "NOT_FOUND", "Role not found.");
    res.json({ success: true, data: (role as any).permissions ?? [] });
  },
);
export const putRolePermissions: RequestHandler = asyncHandler(
  async (req, res) => {
    if (
      !Array.isArray(req.body.permissions) ||
      req.body.permissions.length > 200
    )
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "permissions must be an array.",
      );
    const role = (await models.Role.findByPk(req.params.id as string)) as any;
    if (!role) throw new AppError(404, "NOT_FOUND", "Role not found.");
    const requested = req.body.permissions as Array<{
      permissionId: string;
      accessLevel: string;
    }>;
    if (
      requested.some(
        (item) =>
          !item ||
          typeof item.permissionId !== "string" ||
          !["view", "full"].includes(item.accessLevel),
      ) ||
      new Set(requested.map((x) => x.permissionId)).size !== requested.length
    )
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Permission assignments are invalid.",
      );
    const permissions = requested.length
      ? await models.Permission.findAll({
          where: { id: { [Op.in]: requested.map((x) => x.permissionId) } },
        })
      : [];
    if (permissions.length !== requested.length)
      throw new AppError(
        400,
        "INVALID_PERMISSIONS",
        "One or more permissions do not exist.",
      );
    if (role.key === "admin") {
      const keys = new Set(permissions.map((item: any) => item.key));
      const required = [
        "staff",
        "staff.create",
        "staff.update",
        "staff.deactivate",
        "staff.assign_roles",
        "roles",
        "roles.manage",
        "permissions",
        "permissions.manage",
      ];
      if (required.some((key) => !keys.has(key)))
        throw new AppError(
          409,
          "ESSENTIAL_PERMISSION_REQUIRED",
          "The admin role must retain essential staff and access-management permissions.",
        );
    }
    await sequelize.transaction(async (transaction) => {
      await models.RolePermission.destroy({
        where: { roleId: role.id },
        transaction,
      });
      if (requested.length)
        await models.RolePermission.bulkCreate(
          requested.map((item) => ({
            roleId: role.id,
            permissionId: item.permissionId,
            accessLevel: item.accessLevel,
          })),
          { transaction },
        );
      await writeAudit({
        actorId: req.auth!.staffId,
        action: "role.permissions_changed",
        entityName: "role",
        recordId: role.id,
        transaction,
        ipAddress: req.ip,
      });
    });
    res.json({
      success: true,
      data: await models.Role.findByPk(role.id, {
        include: includePermissions,
      }),
    });
  },
);
