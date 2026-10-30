import { Router } from "express";
import { authenticate, requirePermission } from "../auth/middleware.js";
import { listPermissions } from "../controllers/roleController.js";

export const permissionRoutes = Router();
permissionRoutes.use(authenticate, requirePermission("permissions", "view"));
permissionRoutes.get("/", listPermissions);
