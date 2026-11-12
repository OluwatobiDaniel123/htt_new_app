import { Router } from "express";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as resource from "../controllers/adminResourceController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  adminResourceDefinitions,
  resourceBodySchema,
  resourceQuerySchema,
} from "../validation/adminResourceSchemas.js";
import {
  attendanceMarksBody,
  scholarshipApprovalBody,
} from "../validation/adminResourceSchemas.js";

export const adminResourceRoutes = Router();
adminResourceRoutes.use(authenticate);
adminResourceRoutes.get(
  "/funding-summary",
  requirePermission("funding"),
  resource.fundingSummary,
);

for (const [modelName, definition] of Object.entries(
  adminResourceDefinitions,
) as [
  keyof typeof adminResourceDefinitions,
  (typeof adminResourceDefinitions)[keyof typeof adminResourceDefinitions],
][]) {
  const router = Router();
  const permission = definition.permission;
  router.get(
    "/",
    requirePermission(permission),
    validateQuery(resourceQuerySchema),
    resource.listAdminResource(modelName),
  );
  router.post(
    "/",
    requirePermission(permission, "full"),
    validateBody(resourceBodySchema(definition)),
    resource.createAdminResource(modelName),
  );
  router.get(
    "/:id",
    uuidParam(),
    requirePermission(permission),
    resource.getAdminResource(modelName),
  );

  if (modelName === "AttendanceSession") {
    router.get(
      "/:id/records",
      uuidParam(),
      requirePermission(permission),
      resource.listAttendanceMarks,
    );
    router.put(
      "/:id/records",
      uuidParam(),
      requirePermission(permission, "full"),
      validateBody(attendanceMarksBody),
      resource.saveAttendanceMarks,
    );
  }

  if (modelName === "ScholarshipApplication")
    router.post(
      "/:id/approve",
      uuidParam(),
      requirePermission(permission, "full"),
      validateBody(scholarshipApprovalBody),
      resource.approveScholarship,
    );
  router.patch(
    "/:id",
    uuidParam(),
    requirePermission(permission, "full"),
    validateBody(resourceBodySchema(definition, true)),
    resource.updateAdminResource(modelName),
  );
  router.delete(
    "/:id",
    uuidParam(),
    requirePermission(permission, "full"),
    resource.deleteAdminResource(modelName),
  );
  adminResourceRoutes.use(`/${definition.path}`, router);
}
