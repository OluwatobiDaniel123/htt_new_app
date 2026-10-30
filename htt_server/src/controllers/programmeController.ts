import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/programmeService.js";

const actor = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return req.auth.staffId;
};
export const listProgrammes: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.listProgrammes(req.validatedQuery ?? {}),
  }),
);
export const getProgramme: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getProgramme(req.params.id as string),
  }),
);
export const createProgramme: RequestHandler = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({
      success: true,
      data: await service.createProgramme(req.body, actor(req), req.ip),
    }),
);
export const updateProgramme: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.updateProgramme(
      req.params.id as string,
      req.body,
      actor(req),
      req.ip,
    ),
  }),
);
export const updateProgrammeStatus: RequestHandler = asyncHandler(
  async (req, res) =>
    res.json({
      success: true,
      data: await service.updateProgrammeStatus(
        req.params.id as string,
        req.body,
        actor(req),
        req.ip,
      ),
    }),
);
export const deleteProgramme: RequestHandler = asyncHandler(
  async (req, res) => {
    await service.deleteProgramme(req.params.id as string, actor(req), req.ip);
    res.json({ success: true });
  },
);
