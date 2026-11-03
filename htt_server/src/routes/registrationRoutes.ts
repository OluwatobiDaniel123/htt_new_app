import { Router } from "express";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as registrations from "../controllers/registrationController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  approveRegistrationBody,
  registrationBody,
  registrationDecisionBody,
  registrationDocumentsBody,
  registrationListQuery,
  registrationPatch,
} from "../validation/academySchemas.js";

export const registrationRoutes = Router();
registrationRoutes.use(authenticate);
registrationRoutes.get(
  "/",
  requirePermission("registrations.read"),
  validateQuery(registrationListQuery),
  registrations.listRegistrations,
);
registrationRoutes.post(
  "/",
  requirePermission("registrations.create", "full"),
  validateBody(registrationBody),
  registrations.createRegistration,
);
registrationRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("registrations.read"),
  registrations.getRegistration,
);
registrationRoutes.post(
  "/:id/approve",
  uuidParam(),
  requirePermission("registrations.approve", "full"),
  requirePermission("players.read_sensitive", "full"),
  validateBody(approveRegistrationBody),
  registrations.approveRegistration,
);
registrationRoutes.post(
  "/:id/reject",
  uuidParam(),
  requirePermission("registrations.update", "full"),
  validateBody(registrationDecisionBody),
  registrations.rejectRegistration,
);
registrationRoutes.post(
  "/:id/request-changes",
  uuidParam(),
  requirePermission("registrations.update", "full"),
  validateBody(registrationDecisionBody),
  registrations.requestChanges,
);
registrationRoutes.post(
  "/:id/start-review",
  uuidParam(),
  requirePermission("registrations.update", "full"),
  validateBody(registrationDecisionBody),
  registrations.startReview,
);
registrationRoutes.post(
  "/:id/require-assessment",
  uuidParam(),
  requirePermission("registrations.update", "full"),
  validateBody(registrationDecisionBody),
  registrations.requireAssessment,
);
registrationRoutes.put(
  "/:id/documents",
  uuidParam(),
  requirePermission("registrations.update", "full"),
  validateBody(registrationDocumentsBody),
  registrations.updateDocuments,
);
registrationRoutes.patch(
  "/:id",
  uuidParam(),
  requirePermission("registrations.update", "full"),
  validateBody(registrationPatch),
  registrations.updateRegistration,
);
