import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import { AppError } from "../errors/AppError.js";
import * as staff from "../controllers/staffController.js";
import { validateBody } from "../validation/request.js";

export const staffRoutes = Router();
staffRoutes.use(authenticate);
staffRoutes.get("/", requirePermission("staff", "view"), staff.listStaff);
staffRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("staff", "view"),
  staff.getStaff,
);
const authorizeRoleAssignment = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (
    req.body?.roleIds !== undefined &&
    (!req.auth ||
      req.auth.staffId === req.params.id ||
      req.auth.permissions["staff.assign_roles"] !== "full")
  )
    return next(
      new AppError(403, "FORBIDDEN", "You cannot assign staff roles."),
    );
  next();
};
staffRoutes.post(
  "/",
  requirePermission("staff.create", "full"),
  authorizeRoleAssignment,
  validateBody(
    z
      .object({
        email: z.string().email().max(320),
        fullName: z.string().min(1).max(200),
        phone: z.string().max(40).nullable().optional(),
        roleIds: z.array(z.string().uuid()).max(20).optional(),
      })
      .strict(),
  ),
  staff.createStaff,
);
staffRoutes.patch(
  "/:id/status",
  uuidParam(),
  requirePermission("staff.deactivate", "full"),
  validateBody(z.object({ active: z.boolean() }).strict()),
  staff.setStaffStatus,
);
staffRoutes.patch(
  "/:id",
  uuidParam(),
  requirePermission("staff.update", "full"),
  authorizeRoleAssignment,
  validateBody(
    z
      .object({
        email: z.string().email().max(320).optional(),
        fullName: z.string().min(1).max(200).optional(),
        phone: z.string().max(40).nullable().optional(),
        roleIds: z.array(z.string().uuid()).max(20).optional(),
      })
      .strict(),
  ),
  staff.updateStaff,
);
staffRoutes.delete(
  "/:id",
  uuidParam(),
  requirePermission("staff.deactivate", "full"),
  staff.deactivateStaff,
);
