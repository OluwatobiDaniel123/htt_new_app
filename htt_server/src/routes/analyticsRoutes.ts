import { Router } from "express";
import { authenticate, requirePermission } from "../auth/middleware.js";
import { academyReport, dashboardSummary } from "../controllers/analyticsController.js";

export const analyticsRoutes = Router();
analyticsRoutes.use(authenticate);
analyticsRoutes.get("/dashboard/summary", requirePermission("dashboard"), dashboardSummary);
analyticsRoutes.get("/reports/academy", requirePermission("reports.finance.read"), academyReport);
