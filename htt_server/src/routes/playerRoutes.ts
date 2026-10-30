import { Router } from "express";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as players from "../controllers/playerController.js";
import * as adminResources from "../controllers/adminResourceController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  playerBody,
  playerDeleteBody,
  playerListQuery,
  playerPatch,
  playerStatusBody,
} from "../validation/academySchemas.js";
import { resourceQuerySchema } from "../validation/adminResourceSchemas.js";

export const playerRoutes = Router();
playerRoutes.use(authenticate);
playerRoutes.get(
  "/",
  requirePermission("players.read"),
  validateQuery(playerListQuery),
  players.listPlayers,
);
playerRoutes.get(
  "/:id/attendance",
  uuidParam(),
  requirePermission("players.read"),
  validateQuery(resourceQuerySchema),
  adminResources.listPlayerAttendance,
);
playerRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("players.read"),
  players.getPlayer,
);
playerRoutes.post(
  "/",
  requirePermission("players.create", "full"),
  validateBody(playerBody),
  players.createPlayer,
);
playerRoutes.patch(
  "/:id/status",
  uuidParam(),
  requirePermission("players.update", "full"),
  validateBody(playerStatusBody),
  players.updatePlayerStatus,
);
playerRoutes.patch(
  "/:id",
  uuidParam(),
  requirePermission("players.update", "full"),
  validateBody(playerPatch.omit({ registrationStatus: true }).strict()),
  players.updatePlayer,
);
playerRoutes.delete(
  "/:id",
  uuidParam(),
  requirePermission("players.delete", "full"),
  validateBody(playerDeleteBody),
  players.deletePlayer,
);
