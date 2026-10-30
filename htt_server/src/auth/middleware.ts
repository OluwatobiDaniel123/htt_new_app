/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { models } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAccessToken } from "./tokens.js";
import { hasPermission } from "./permissionAccess.js";

export const authenticate: RequestHandler = asyncHandler(
  async (req, _res, next) => {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = req.cookies?.htt_access || bearer;
    if (!token)
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch {
      throw new AppError(401, "INVALID_TOKEN", "Authentication is required.");
    }
    const session = (await models.RefreshSession.findByPk(claims.sid, {
      include: [{ model: models.StaffAccount, as: "staffAccount" }],
    })) as any;
    const staff = session?.staffAccount;
    if (
      !session ||
      session.staffAccountId !== claims.sub ||
      session.revokedAt ||
      session.rotatedAt ||
      new Date(session.expiresAt) <= new Date() ||
      !staff?.active ||
      staff.suspendedAt
    ) {
      throw new AppError(401, "INVALID_SESSION", "Authentication is required.");
    }
    const roleRows = (await models.StaffRole.findAll({
      where: { staffAccountId: staff.id },
      include: [
        {
          model: models.Role,
          as: "role",
          include: [
            {
              model: models.Permission,
              as: "permissions",
              through: { attributes: ["accessLevel"] },
            },
          ],
        },
      ],
    })) as any[];
    const permissions: Record<string, "view" | "full"> = {};
    const roles: string[] = [];
    for (const assignment of roleRows) {
      const role = assignment.role;
      if (!role) continue;
      roles.push(role.key);
      for (const permission of role.permissions ?? []) {
        const level = permission.RolePermission?.accessLevel;
        if (level === "view" || level === "full") {
          if (level === "full" || permissions[permission.key] !== "full")
            permissions[permission.key] = level;
        }
      }
    }
    req.auth = {
      staffId: staff.id,
      email: staff.email,
      fullName: staff.fullName,
      sessionId: session.id,
      roles,
      permissions,
    };
    next();
  },
);

export const requireRole =
  (...keys: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !req.auth.roles.some((role) => keys.includes(role)))
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have access to this resource.",
        ),
      );
    next();
  };

export const requirePermission =
  (key: string, level: "view" | "full" = "view"): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth || !hasPermission(req.auth.permissions, key, level))
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have access to this resource.",
        ),
      );
    next();
  };

export const uuidParam =
  (name = "id"): RequestHandler =>
  (req, _res, next) => {
    const value = req.params[name];
    if (
      typeof value !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    )
      return next(
        new AppError(400, "VALIDATION_ERROR", "A valid UUID is required."),
      );
    next();
  };
