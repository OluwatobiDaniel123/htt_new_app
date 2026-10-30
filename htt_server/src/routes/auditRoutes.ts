import { Router } from "express";
import { authenticate, requirePermission } from "../auth/middleware.js";
import { listAuditLogs } from "../controllers/auditController.js";
import { validateQuery } from "../validation/request.js";
import { resourceQuerySchema } from "../validation/adminResourceSchemas.js";

export const auditRoutes = Router();
auditRoutes.use(authenticate, requirePermission("audit"));
auditRoutes.get("/", validateQuery(resourceQuerySchema), listAuditLogs);
