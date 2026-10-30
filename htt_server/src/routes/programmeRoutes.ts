import { Router } from "express";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as programmes from "../controllers/programmeController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  programmeBody,
  programmeListQuery,
  programmePatch,
  programmeStatusBody,
} from "../validation/academySchemas.js";

export const programmeRoutes = Router();
programmeRoutes.use(authenticate);
programmeRoutes.get(
  "/",
  requirePermission("programmes.read"),
  validateQuery(programmeListQuery),
  programmes.listProgrammes,
);
programmeRoutes.post(
  "/",
  requirePermission("programmes.create", "full"),
  validateBody(programmeBody),
  programmes.createProgramme,
);
programmeRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("programmes.read"),
  programmes.getProgramme,
);
programmeRoutes.patch(
  "/:id/status",
  uuidParam(),
  requirePermission("programmes.update", "full"),
  validateBody(programmeStatusBody),
  programmes.updateProgrammeStatus,
);
programmeRoutes.patch(
  "/:id",
  uuidParam(),
  requirePermission("programmes.update", "full"),
  validateBody(
    programmePatch.omit({ status: true, availability: true }).strict(),
  ),
  programmes.updateProgramme,
);
programmeRoutes.delete(
  "/:id",
  uuidParam(),
  requirePermission("programmes.delete", "full"),
  programmes.deleteProgramme,
);
