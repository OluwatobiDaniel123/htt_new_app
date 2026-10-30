import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/notificationService.js";

const staffId = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return req.auth.staffId;
};
export const listMine: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getMyNotifications(
      staffId(req),
      req.validatedQuery ?? {},
    ),
  }),
);
export const unreadCount: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: { unread: await service.getUnreadCount(staffId(req)) },
  }),
);
export const getMine: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getMyNotification(
      staffId(req),
      req.params.id as string,
    ),
  }),
);
export const markRead: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.markRead(staffId(req), req.params.id as string),
  }),
);
export const markAllRead: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: { updated: await service.markAllRead(staffId(req)) },
  }),
);
export const getPreferences: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getStaffPreferences(staffId(req)),
  }),
);
export const updatePreferences: RequestHandler = asyncHandler(
  async (req, res) =>
    res.json({
      success: true,
      data: await service.updateStaffPreferences(staffId(req), req.body),
    }),
);
export const deliveries: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.listDeliveryAttempts(req.validatedQuery ?? {}),
  }),
);
export const retry: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.retryNotification(
      req.params.id as string,
      staffId(req),
      req.ip,
    ),
  }),
);
export const templates: RequestHandler = asyncHandler(async (_req, res) =>
  res.json({ success: true, data: service.listTemplates() }),
);
export const announce: RequestHandler = asyncHandler(async (req, res) =>
  res
    .status(202)
    .json({
      success: true,
      data: await service.createStaffAnnouncement(
        req.body,
        staffId(req),
        req.ip,
      ),
    }),
);
export const guardianSmsConsent: RequestHandler = asyncHandler(
  async (req, res) =>
    res.json({
      success: true,
      data: await service.recordGuardianSmsConsent(
        req.params.id as string,
        req.body.granted,
        req.body.source,
        staffId(req),
        req.ip,
      ),
    }),
);
