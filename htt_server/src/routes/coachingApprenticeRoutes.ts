import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as recruitment from "../controllers/coachingApprenticeController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  coachingApprenticeApplicationBody,
  coachingApprenticeListQuery,
  coachingApprenticeStatusBody,
} from "../validation/coachingApprenticeSchemas.js";

export const coachingApprenticeRoutes = Router();

coachingApprenticeRoutes.post(
  "/apply",
  rateLimit({
    windowMs: 60_000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many applications. Please try again later.",
        },
      }),
  }),
  validateBody(coachingApprenticeApplicationBody),
  recruitment.apply,
);

coachingApprenticeRoutes.use(authenticate);
coachingApprenticeRoutes.get(
  "/",
  requirePermission("coaching_apprentices", "view"),
  validateQuery(coachingApprenticeListQuery),
  recruitment.list,
);
coachingApprenticeRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("coaching_apprentices", "view"),
  recruitment.get,
);
coachingApprenticeRoutes.patch(
  "/:id/status",
  uuidParam(),
  requirePermission("coaching_apprentices", "full"),
  validateBody(coachingApprenticeStatusBody),
  recruitment.updateStatus,
);
