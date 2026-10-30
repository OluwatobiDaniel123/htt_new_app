import { Router } from "express";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as centres from "../controllers/centreController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  centreBody,
  centreListQuery,
  centrePatch,
  centreStatusBody,
} from "../validation/academySchemas.js";

export const centreRoutes = Router();
centreRoutes.use(authenticate);
centreRoutes.get(
  "/",
  requirePermission("centres.read"),
  validateQuery(centreListQuery),
  centres.listCentres,
);
centreRoutes.post(
  "/",
  requirePermission("centres.create", "full"),
  validateBody(centreBody),
  centres.createCentre,
);
centreRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("centres.read"),
  centres.getCentre,
);
centreRoutes.patch(
  "/:id/status",
  uuidParam(),
  requirePermission("centres.update", "full"),
  validateBody(centreStatusBody),
  centres.updateCentreStatus,
);
centreRoutes.patch(
  "/:id",
  uuidParam(),
  requirePermission("centres.update", "full"),
  validateBody(
    centrePatch
      .omit({
        status: true,
        reviewStatus: true,
        proposedArea: true,
        registrationAvailable: true,
      })
      .strict(),
  ),
  centres.updateCentre,
);
centreRoutes.delete(
  "/:id",
  uuidParam(),
  requirePermission("centres.delete", "full"),
  centres.deleteCentre,
);
