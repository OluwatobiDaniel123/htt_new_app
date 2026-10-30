import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/centreService.js";

const actor = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return req.auth.staffId;
};
export const listCentres: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.listCentres(req.validatedQuery ?? {}),
  }),
);
export const getCentre: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getCentre(req.params.id as string),
  }),
);
export const createCentre: RequestHandler = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({
      success: true,
      data: await service.createCentre(req.body, actor(req), req.ip),
    }),
);
export const updateCentre: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.updateCentre(
      req.params.id as string,
      req.body,
      actor(req),
      req.ip,
    ),
  }),
);
export const updateCentreStatus: RequestHandler = asyncHandler(
  async (req, res) =>
    res.json({
      success: true,
      data: await service.updateCentreStatus(
        req.params.id as string,
        req.body,
        actor(req),
        req.ip,
      ),
    }),
);
export const deleteCentre: RequestHandler = asyncHandler(async (req, res) => {
  await service.deleteCentre(req.params.id as string, actor(req), req.ip);
  res.json({ success: true });
});
