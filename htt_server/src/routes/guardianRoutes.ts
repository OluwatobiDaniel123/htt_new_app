import { Router } from "express";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as guardians from "../controllers/guardianController.js";
import { listPlayerGuardians } from "../controllers/adminResourceController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  guardianBody,
  guardianDeleteBody,
  guardianLinkBody,
  guardianListQuery,
  guardianPatch,
} from "../validation/academySchemas.js";
import { resourceQuerySchema } from "../validation/adminResourceSchemas.js";

export const guardianRoutes = Router();
guardianRoutes.use(authenticate);
guardianRoutes.get(
  "/",
  requirePermission("guardians.read"),
  validateQuery(guardianListQuery),
  guardians.listGuardians,
);
guardianRoutes.post(
  "/",
  requirePermission("guardians.create", "full"),
  validateBody(guardianBody),
  guardians.createGuardian,
);
guardianRoutes.get(
  "/:id/players",
  uuidParam(),
  requirePermission("guardians.read"),
  guardians.getGuardianPlayers,
);
guardianRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("guardians.read"),
  guardians.getGuardian,
);
guardianRoutes.patch(
  "/:id",
  uuidParam(),
  requirePermission("guardians.update", "full"),
  validateBody(guardianPatch),
  guardians.updateGuardian,
);
guardianRoutes.delete(
  "/:id",
  uuidParam(),
  requirePermission("guardians.delete", "full"),
  validateBody(guardianDeleteBody),
  guardians.deleteGuardian,
);
export const playerGuardianRoutes = Router({ mergeParams: true });
playerGuardianRoutes.use(authenticate, uuidParam());
playerGuardianRoutes.get(
  "/",
  requirePermission("guardians.read"),
  validateQuery(resourceQuerySchema),
  listPlayerGuardians,
);
playerGuardianRoutes.post(
  "/",
  requirePermission("guardians.update", "full"),
  validateBody(guardianLinkBody),
  guardians.linkGuardian,
);
playerGuardianRoutes.delete(
  "/:guardianId",
  uuidParam("guardianId"),
  requirePermission("guardians.update", "full"),
  guardians.unlinkGuardian,
);
