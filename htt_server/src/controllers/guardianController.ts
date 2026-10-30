import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/guardianService.js";

const authOf = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return req.auth;
};
export const listGuardians: RequestHandler = asyncHandler(async (req, res) => {
  const auth = authOf(req);
  res.json({
    success: true,
    data: await service.listGuardians(req.validatedQuery ?? {}, {
      includeContact: auth.permissions["guardians.read_contact"] === "full",
    }),
  });
});
export const getGuardian: RequestHandler = asyncHandler(async (req, res) => {
  const auth = authOf(req);
  res.json({
    success: true,
    data: await service.getGuardian(req.params.id as string, {
      includeContact: auth.permissions["guardians.read_contact"] === "full",
    }),
  });
});
export const getGuardianPlayers: RequestHandler = asyncHandler(
  async (req, res) => {
    const auth = authOf(req);
    res.json({
      success: true,
      data: await service.getGuardianPlayers(req.params.id as string, {
        includeContact: auth.permissions["guardians.read_contact"] === "full",
        includePlayerPersonal:
          auth.permissions["players.read_sensitive"] === "full",
      }),
    });
  },
);
export const createGuardian: RequestHandler = asyncHandler(async (req, res) => {
  const auth = authOf(req);
  const data = await service.createGuardian(
    req.body,
    auth.staffId,
    auth.permissions["guardians.read_contact"] === "full",
    req.ip,
  );
  res.status(201).json({ success: true, data });
});
export const updateGuardian: RequestHandler = asyncHandler(async (req, res) => {
  const auth = authOf(req);
  const contactKeys = ["phone", "email", "address"];
  if (
    contactKeys.some((key) => req.body[key] !== undefined) &&
    auth.permissions["guardians.read_contact"] !== "full"
  )
    throw new AppError(
      403,
      "FORBIDDEN",
      "Guardian contact updates require additional permission.",
    );
  const data = await service.updateGuardian(
    req.params.id as string,
    req.body,
    auth.staffId,
    auth.permissions["guardians.read_contact"] === "full",
    req.ip,
  );
  res.json({ success: true, data });
});
export const deleteGuardian: RequestHandler = asyncHandler(async (req, res) => {
  const auth = authOf(req);
  res.json({
    success: true,
    data: await service.deactivateGuardian(
      req.params.id as string,
      auth.staffId,
      req.ip,
    ),
  });
});
export const linkGuardian: RequestHandler = asyncHandler(async (req, res) => {
  const auth = authOf(req);
  res
    .status(201)
    .json({
      success: true,
      data: await service.linkGuardianToPlayer(
        req.params.id as string,
        req.body,
        auth.staffId,
        auth.permissions["guardians.read_contact"] === "full",
        req.ip,
      ),
    });
});
export const unlinkGuardian: RequestHandler = asyncHandler(async (req, res) => {
  const auth = authOf(req);
  await service.unlinkGuardianFromPlayer(
    req.params.id as string,
    req.params.guardianId as string,
    auth.staffId,
    req.ip,
  );
  res.json({ success: true });
});
