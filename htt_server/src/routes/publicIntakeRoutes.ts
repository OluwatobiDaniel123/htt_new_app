import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import * as intake from "../controllers/publicIntakeController.js";
import { validateBody } from "../validation/request.js";
import { publicIntakeBody } from "../validation/publicIntakeSchemas.js";

export const publicIntakeRoutes = Router();
publicIntakeRoutes.post(
  "/intake",
  rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false }),
  validateBody(publicIntakeBody),
  intake.publicIntake,
);
