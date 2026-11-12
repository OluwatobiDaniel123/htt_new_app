import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as intake from "../controllers/publicIntakeController.js";
import { validateBody } from "../validation/request.js";
import { publicIntakeBody } from "../validation/publicIntakeSchemas.js";
import { publicRegistrationUpload } from "../middleware/publicRegistrationUpload.js";

export const publicIntakeRoutes = Router();
publicIntakeRoutes.get(
  "/payments/:reference",
  rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false }),
  intake.publicPaymentSummary,
);
publicIntakeRoutes.post(
  "/intake",
  rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false }),
  publicRegistrationUpload,
  validateBody(publicIntakeBody),
  intake.publicIntake,
);
