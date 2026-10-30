import { Router } from "express";
import { z } from "zod";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as roles from "../controllers/roleController.js";
import { validateBody } from "../validation/request.js";

export const roleRoutes = Router();
roleRoutes.use(authenticate);
roleRoutes.get("/", requirePermission("roles", "view"), roles.listRoles);
roleRoutes.get(
  "/permissions",
  requirePermission("permissions", "view"),
  roles.listPermissions,
);
roleRoutes.get(
  "/:id/permissions",
  uuidParam(),
  requirePermission("roles", "view"),
  roles.getRolePermissions,
);
roleRoutes.put(
  "/:id/permissions",
  uuidParam(),
  requirePermission("permissions.manage", "full"),
  validateBody(
    z
      .object({
        permissions: z
          .array(
            z
              .object({
                permissionId: z.string().uuid(),
                accessLevel: z.enum(["view", "full"]),
              })
              .strict(),
          )
          .max(200),
      })
      .strict(),
  ),
  roles.putRolePermissions,
);
roleRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("roles", "view"),
  roles.getRole,
);
roleRoutes.post(
  "/",
  requirePermission("roles.manage", "full"),
  validateBody(
    z
      .object({
        key: z.string().min(2).max(64),
        name: z.string().min(1).max(120),
        description: z.string().max(4000).nullable().optional(),
      })
      .strict(),
  ),
  roles.createRole,
);
roleRoutes.patch(
  "/:id",
  uuidParam(),
  requirePermission("roles.manage", "full"),
  validateBody(
    z
      .object({
        key: z.string().min(2).max(64).optional(),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(4000).nullable().optional(),
      })
      .strict(),
  ),
  roles.updateRole,
);
