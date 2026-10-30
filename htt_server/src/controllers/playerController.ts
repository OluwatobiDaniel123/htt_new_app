import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/playerService.js";

const actor = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return req.auth;
};
export const listPlayers: RequestHandler = asyncHandler(async (req, res) => {
  const auth = actor(req);
  const data = await service.listPlayers(req.validatedQuery ?? {}, {
    includePersonal: auth.permissions["players.read_sensitive"] === "full",
  });
  res.json({ success: true, data });
});
export const getPlayer: RequestHandler = asyncHandler(async (req, res) => {
  const auth = actor(req);
  const data = await service.getPlayer(req.params.id as string, {
    includePersonal: auth.permissions["players.read_sensitive"] === "full",
    includeGuardianContacts:
      auth.permissions["guardians.read_contact"] === "full",
  });
  res.json({ success: true, data });
});
export const createPlayer: RequestHandler = asyncHandler(async (req, res) => {
  const auth = actor(req);
  const data = await service.createPlayer(
    req.body,
    auth.staffId,
    auth.permissions["players.read_sensitive"] === "full",
    req.ip,
  );
  res.status(201).json({ success: true, data });
});
export const updatePlayer: RequestHandler = asyncHandler(async (req, res) => {
  const auth = actor(req);
  const data = await service.updatePlayer(
    req.params.id as string,
    req.body,
    auth.staffId,
    auth.permissions["players.read_sensitive"] === "full",
    req.ip,
  );
  res.json({ success: true, data });
});
export const updatePlayerStatus: RequestHandler = asyncHandler(
  async (req, res) => {
    const auth = actor(req);
    if (
      req.body.archivedReason !== undefined &&
      auth.permissions["players.read_sensitive"] !== "full"
    )
      throw new AppError(
        403,
        "FORBIDDEN",
        "Archive reasons require additional permission.",
      );
    res.json({
      success: true,
      data: await service.updatePlayerStatus(
        req.params.id as string,
        req.body,
        auth.staffId,
        req.ip,
      ),
    });
  },
);
export const deletePlayer: RequestHandler = asyncHandler(async (req, res) => {
  const auth = actor(req);
  const reason =
    typeof req.body?.reason === "string"
      ? req.body.reason.slice(0, 1000)
      : undefined;
  res.json({
    success: true,
    data: await service.archivePlayer(
      req.params.id as string,
      auth.staffId,
      reason,
      req.ip,
    ),
  });
});
