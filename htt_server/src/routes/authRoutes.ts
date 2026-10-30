import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { env } from "../config/env.js";
import * as auth from "../controllers/authController.js";
import { authenticate } from "../auth/middleware.js";
import { validateBody } from "../validation/request.js";

export const authRoutes = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.LOGIN_RATE_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: env.PASSWORD_RESET_RATE_LIMIT,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const emailBody = z.object({ email: z.string().email().max(320) }).strict();
authRoutes.post(
  "/login",
  loginLimiter,
  validateBody(
    z
      .object({
        email: z.string().email().max(320),
        password: z.string().min(1).max(128),
      })
      .strict(),
  ),
  auth.login,
);
authRoutes.post("/refresh", auth.refresh);
authRoutes.post("/logout", auth.logout);
authRoutes.post("/logout-all", authenticate, auth.logoutAll);
authRoutes.get("/me", authenticate, auth.me);
authRoutes.post(
  "/forgot-password",
  resetLimiter,
  validateBody(emailBody),
  auth.forgotPassword,
);
authRoutes.post(
  "/reset-password",
  resetLimiter,
  validateBody(
    z
      .object({
        token: z.string().min(32).max(256),
        password: z.string().min(12).max(128),
      })
      .strict(),
  ),
  auth.resetPassword,
);
authRoutes.post(
  "/change-password",
  authenticate,
  validateBody(
    z
      .object({
        currentPassword: z.string().min(1).max(128),
        password: z.string().min(12).max(128),
      })
      .strict(),
  ),
  auth.changePassword,
);
