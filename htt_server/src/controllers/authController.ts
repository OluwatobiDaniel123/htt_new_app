/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { Op, fn, col, where } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "../services/auditService.js";
import { sendPasswordLink } from "../services/emailService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearAuthCookies, setAuthCookies } from "../auth/cookies.js";
import {
  getDummyPasswordHash,
  hashPassword,
  passwordSchema,
  verifyPassword,
} from "../auth/password.js";
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  refreshExpiry,
  resetTokenExpiry,
} from "../auth/tokens.js";

const emailSchema = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
const publicStaff = (staff: any, roles: string[] = []) => ({
  id: staff.id,
  email: staff.email,
  fullName: staff.fullName,
  active: staff.active,
  suspendedAt: staff.suspendedAt,
  lastLoginAt: staff.lastLoginAt,
  roles,
});
const issueSession = async (
  staff: any,
  req: any,
  res: any,
  familyId = randomUUID(),
) => {
  const refreshToken = createRefreshToken();
  const session = (await models.RefreshSession.create({
    staffAccountId: staff.id,
    familyId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiry(),
    createdByIp: req.ip,
  })) as any;
  setAuthCookies(res, createAccessToken(staff.id, session.id), refreshToken);
  return session;
};
const rolesOf = async (staffId: string) =>
  (
    (await models.StaffRole.findAll({
      where: { staffAccountId: staffId },
      include: [{ model: models.Role, as: "role" }],
    })) as any[]
  )
    .map((row) => row.role?.key)
    .filter(Boolean);

export const login: RequestHandler = asyncHandler(async (req, res) => {
  const email = emailSchema(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== "string" || password.length > 128)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Email and password are required.",
    );
  const staff = (await models.StaffAccount.scope("withCredentials").findOne({
    where: where(fn("lower", col("email")), email),
  })) as any;
  const matches = await verifyPassword(
    staff?.passwordHash ?? (await getDummyPasswordHash()),
    password,
  ).catch(() => false);
  if (!staff || !matches || !staff.active || staff.suspendedAt) {
    await writeAudit({
      actorId: staff?.id,
      action: "auth.login",
      entityName: "staff_account",
      outcome: "failure",
      reason: "invalid_credentials_or_inactive",
      ipAddress: req.ip,
    });
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
    );
  }
  await staff.update({ lastLoginAt: new Date() });
  const session = await issueSession(staff, req, res);
  await writeAudit({
    actorId: staff.id,
    action: "auth.login",
    entityName: "staff_account",
    recordId: staff.id,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  res.json({
    success: true,
    data: {
      user: publicStaff(staff, await rolesOf(staff.id)),
      sessionId: session.id,
    },
  });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  const raw = req.cookies?.htt_refresh;
  if (typeof raw !== "string")
    throw new AppError(401, "INVALID_SESSION", "Authentication is required.");
  const result = await sequelize.transaction(async (transaction) => {
    const old = (await models.RefreshSession.findOne({
      where: { tokenHash: hashToken(raw) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!old) return { status: "invalid" as const };
    if (old.rotatedAt) {
      await models.RefreshSession.update(
        { revokedAt: new Date() },
        { where: { familyId: old.familyId, revokedAt: null }, transaction },
      );
      return { status: "reuse" as const, staffId: old.staffAccountId };
    }
    if (old.revokedAt || new Date(old.expiresAt) <= new Date())
      return { status: "invalid" as const };
    const staff = (await models.StaffAccount.findByPk(old.staffAccountId, {
      transaction,
    })) as any;
    if (
      !staff ||
      staff.suspendedAt ||
      !staff.active
    )
      return { status: "invalid" as const };
    const nextToken = createRefreshToken();
    const next = (await models.RefreshSession.create(
      {
        staffAccountId: staff.id,
        familyId: old.familyId,
        tokenHash: hashToken(nextToken),
        expiresAt: refreshExpiry(),
        createdByIp: req.ip,
      },
      { transaction },
    )) as any;
    await old.update(
      { rotatedAt: new Date(), replacedBySessionId: next.id },
      { transaction },
    );
    return { status: "ok" as const, staff, next, nextToken };
  });
  if (result.status !== "ok") {
    clearAuthCookies(res);
    if (result.status === "reuse")
      await writeAudit({
        actorId: result.staffId,
        action: "auth.refresh_reuse",
        entityName: "refresh_session",
        outcome: "failure",
        ipAddress: req.ip,
      });
    throw new AppError(401, "INVALID_SESSION", "Authentication is required.");
  }
  setAuthCookies(
    res,
    createAccessToken(result.staff.id, result.next.id),
    result.nextToken,
  );
  res.json({ success: true, data: { sessionId: result.next.id } });
});

export const logout: RequestHandler = asyncHandler(async (req, res) => {
  if (req.auth)
    await models.RefreshSession.update(
      { revokedAt: new Date() },
      {
        where: {
          familyId: (
            (await models.RefreshSession.findByPk(req.auth.sessionId)) as any
          )?.familyId,
          revokedAt: null,
        },
      },
    );
  else if (req.cookies?.htt_refresh)
    await models.RefreshSession.update(
      { revokedAt: new Date() },
      {
        where: {
          tokenHash: hashToken(req.cookies.htt_refresh),
          revokedAt: null,
        },
      },
    );
  await writeAudit({
    actorId: req.auth?.staffId,
    action: "auth.logout",
    entityName: "refresh_session",
    recordId: req.auth?.sessionId,
    ipAddress: req.ip,
  });
  clearAuthCookies(res);
  res.json({ success: true });
});

export const logoutAll: RequestHandler = asyncHandler(async (req, res) => {
  await models.RefreshSession.update(
    { revokedAt: new Date() },
    { where: { staffAccountId: req.auth!.staffId, revokedAt: null } },
  );
  await writeAudit({
    actorId: req.auth!.staffId,
    action: "auth.logout_all",
    entityName: "staff_account",
    recordId: req.auth!.staffId,
    ipAddress: req.ip,
  });
  clearAuthCookies(res);
  res.json({ success: true });
});

export const me: RequestHandler = asyncHandler(async (req, res) => {
  const staff = await models.StaffAccount.findByPk(req.auth!.staffId);
  res.json({
    success: true,
    data: {
      user: publicStaff(staff, req.auth!.roles),
      permissions: req.auth!.permissions,
    },
  });
});

export const forgotPassword: RequestHandler = asyncHandler(async (req, res) => {
  const email = emailSchema(req.body?.email);
  if (!email || email.length > 320)
    throw new AppError(400, "VALIDATION_ERROR", "A valid email is required.");
  const staff = (await models.StaffAccount.findOne({
    where: {
      [Op.and]: [
        where(fn("lower", col("email")), email),
        { active: true, suspendedAt: null },
      ],
    },
  })) as any;
  if (staff) {
    const token = createRefreshToken();
    await models.PasswordResetToken.update(
      { usedAt: new Date() },
      {
        where: {
          staffAccountId: staff.id,
          usedAt: null,
          expiresAt: { [Op.gt]: new Date() },
        },
      },
    );
    await models.PasswordResetToken.create({
      staffAccountId: staff.id,
      tokenHash: hashToken(token),
      purpose: "password_reset",
      expiresAt: resetTokenExpiry(),
    });
    const delivered = await sendPasswordLink(
      staff.email,
      token,
      "password_reset",
    );
    await writeAudit({
      actorId: staff.id,
      action: "auth.password_reset_requested",
      entityName: "staff_account",
      recordId: staff.id,
      outcome: delivered ? "success" : "failure",
      reason: delivered ? undefined : "email_delivery_unavailable",
      ipAddress: req.ip,
    });
  }
  res.json({
    success: true,
    message:
      "If the account is eligible, password reset instructions will be sent.",
  });
});

export const resetPassword: RequestHandler = asyncHandler(async (req, res) => {
  const token = req.body?.token;
  const passwordResult = passwordSchema.safeParse(req.body?.password);
  if (typeof token !== "string" || !passwordResult.success)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "A valid token and strong password are required.",
    );
  await sequelize.transaction(async (transaction) => {
    const reset = (await models.PasswordResetToken.findOne({
      where: {
        tokenHash: hashToken(token),
        purpose: { [Op.in]: ["password_reset", "staff_invite"] },
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!reset)
      throw new AppError(
        400,
        "INVALID_RESET_TOKEN",
        "This reset link is invalid or expired.",
      );
    const staff = (await models.StaffAccount.findByPk(reset.staffAccountId, {
      transaction,
    })) as any;
    if (!staff || staff.suspendedAt || (reset.purpose !== "staff_invite" && !staff.active))
      throw new AppError(
        400,
        "INVALID_RESET_TOKEN",
        "This reset link is invalid or expired.",
      );
    await staff.update(
      {
        passwordHash: await hashPassword(passwordResult.data),
        ...(reset.purpose === "staff_invite"
          ? { active: true, suspendedAt: null }
          : {}),
      },
      { transaction },
    );
    await reset.update({ usedAt: new Date() }, { transaction });
    await models.PasswordResetToken.update(
      { usedAt: new Date() },
      { where: { staffAccountId: staff.id, usedAt: null }, transaction },
    );
    await models.RefreshSession.update(
      { revokedAt: new Date() },
      { where: { staffAccountId: staff.id, revokedAt: null }, transaction },
    );
    await writeAudit({
      actorId: staff.id,
      action:
        reset.purpose === "staff_invite"
          ? "auth.invitation_accepted"
          : "auth.password_reset",
      entityName: "staff_account",
      recordId: staff.id,
      transaction,
    });
  });
  clearAuthCookies(res);
  res.json({ success: true });
});

export const changePassword: RequestHandler = asyncHandler(async (req, res) => {
  const { currentPassword, password } = req.body ?? {};
  const valid = passwordSchema.safeParse(password);
  if (typeof currentPassword !== "string" || !valid.success)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Current password and a strong new password are required.",
    );
  const staff = (await models.StaffAccount.scope("withCredentials").findByPk(
    req.auth!.staffId,
  )) as any;
  if (
    !(await verifyPassword(staff.passwordHash, currentPassword).catch(
      () => false,
    ))
  )
    throw new AppError(
      400,
      "INVALID_PASSWORD",
      "Current password is incorrect.",
    );
  if (await verifyPassword(staff.passwordHash, valid.data).catch(() => false))
    throw new AppError(
      400,
      "PASSWORD_REUSE",
      "Choose a password different from your current password.",
    );
  await sequelize.transaction(async (transaction) => {
    await staff.update(
      { passwordHash: await hashPassword(valid.data) },
      { transaction },
    );
    await models.RefreshSession.update(
      { revokedAt: new Date() },
      { where: { staffAccountId: staff.id, revokedAt: null }, transaction },
    );
    await writeAudit({
      actorId: staff.id,
      action: "auth.password_changed",
      entityName: "staff_account",
      recordId: staff.id,
      transaction,
    });
  });
  clearAuthCookies(res);
  res.json({ success: true });
});
