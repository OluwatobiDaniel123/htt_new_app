import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as notifications from "../controllers/notificationController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  announcementBody,
  deliveryQuery,
  guardianSmsConsentBody,
} from "../validation/notificationSchemas.js";

export const notificationAdminRoutes = Router();
notificationAdminRoutes.use(authenticate);
notificationAdminRoutes.get(
  "/deliveries",
  requirePermission("notifications.admin.read"),
  validateQuery(deliveryQuery),
  notifications.deliveries,
);

notificationAdminRoutes.get(
  "/templates",
  requirePermission("notifications.templates.read"),
  notifications.templates,
);

notificationAdminRoutes.post(
  "/deliveries/:id/retry",
  uuidParam(),
  rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  requirePermission("notifications.retry", "full"),
  notifications.retry,
);

notificationAdminRoutes.post(
  "/announcements",
  rateLimit({
    windowMs: 60 * 60_000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
  requirePermission("notifications.announce", "full"),
  validateBody(announcementBody),
  notifications.announce,
);

notificationAdminRoutes.put(
  "/guardians/:id/sms-consent",
  uuidParam(),
  requirePermission("notifications.preferences.manage", "full"),
  validateBody(guardianSmsConsentBody),
  notifications.guardianSmsConsent,
);
