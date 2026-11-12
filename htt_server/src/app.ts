import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { createRequire } from "node:module";
import swaggerUi from "swagger-ui-express";
import type { RequestHandler } from "express";
import { env } from "./config/env.js";
import { swaggerSpec } from "./config/swagger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { originGuard } from "./middleware/originGuard.js";
import { notFoundHandler } from "./middleware/notFound.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { authRoutes } from "./routes/authRoutes.js";
import { staffRoutes } from "./routes/staffRoutes.js";
import { roleRoutes } from "./routes/roleRoutes.js";
import { permissionRoutes } from "./routes/permissionRoutes.js";
import { playerRoutes } from "./routes/playerRoutes.js";
import {
  guardianRoutes,
  playerGuardianRoutes,
} from "./routes/guardianRoutes.js";
import { registrationRoutes } from "./routes/registrationRoutes.js";
import { centreRoutes } from "./routes/centreRoutes.js";
import { programmeRoutes } from "./routes/programmeRoutes.js";
import { notificationRoutes } from "./routes/notificationRoutes.js";
import { notificationAdminRoutes } from "./routes/notificationAdminRoutes.js";
import { adminResourceRoutes } from "./routes/adminResourceRoutes.js";
import { mediaRoutes } from "./routes/mediaRoutes.js";
import { analyticsRoutes } from "./routes/analyticsRoutes.js";
import { auditRoutes } from "./routes/auditRoutes.js";
import { publicIntakeRoutes } from "./routes/publicIntakeRoutes.js";
import { coachingApprenticeRoutes } from "./routes/coachingApprenticeRoutes.js";
import { paymentRoutes } from "./routes/paymentRoutes.js";

export const app = express();
const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http") as (options: {
  level: string;
  redact: { paths: string[]; censor: string };
}) => RequestHandler;

app.disable("x-powered-by");
app.use(helmet() as unknown as RequestHandler);
app.use(
  cors({
    origin: [...env.FRONTEND_URL, ...env.PUBLIC_SITE_URL],
    credentials: true,
  }) as unknown as RequestHandler,
);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buffer) => {
      (req as express.Request).rawBody = Buffer.from(buffer);
    },
  }) as unknown as RequestHandler,
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }) as unknown as RequestHandler,
);

app.use(cookieParser() as unknown as RequestHandler);
app.use(
  pinoHttp({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "res.headers.set-cookie",
      ],
      censor: "[Redacted]",
    },
  }) as unknown as RequestHandler,
);
app.use(originGuard);

app.use("/api/v1", healthRoutes);
app.use("/api/v1/public", publicIntakeRoutes);
app.use("/api/v1/coaching-apprentices", coachingApprenticeRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/players", playerRoutes);
app.use("/api/v1/guardians", guardianRoutes);
app.use("/api/v1/players/:id/guardians", playerGuardianRoutes);
app.use("/api/v1/registrations", registrationRoutes);
app.use("/api/v1/centres", centreRoutes);
app.use("/api/v1/programmes", programmeRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/admin/notifications", notificationAdminRoutes);
app.use("/api/v1", adminResourceRoutes);
app.use("/api/v1", analyticsRoutes);
app.use("/api/v1/audit-logs", auditRoutes);
app.use("/api/v1/media", mediaRoutes);
app.get("/api-docs/swagger.json", (_req, res) => res.json(swaggerSpec));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFoundHandler);
app.use(errorHandler);
