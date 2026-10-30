import { Router } from "express";
import { authenticate, uuidParam } from "../auth/middleware.js";
import * as notifications from "../controllers/notificationController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  notificationListQuery,
  notificationPreferencesBody,
} from "../validation/notificationSchemas.js";

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);
notificationRoutes.get("/unread-count", notifications.unreadCount);
notificationRoutes.get("/preferences", notifications.getPreferences);
notificationRoutes.put(
  "/preferences",
  validateBody(notificationPreferencesBody),
  notifications.updatePreferences,
);

notificationRoutes.patch("/read-all", notifications.markAllRead);
notificationRoutes.get(
  "/",
  validateQuery(notificationListQuery),
  notifications.listMine,
);

notificationRoutes.get("/:id", uuidParam(), notifications.getMine);
notificationRoutes.patch("/:id/read", uuidParam(), notifications.markRead);
