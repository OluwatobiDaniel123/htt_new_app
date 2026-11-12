import type { RequestHandler } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getCoachingApprenticeApplication,
  listCoachingApprenticeApplications,
  submitCoachingApprenticeApplication,
  updateCoachingApprenticeApplicationStatus,
} from "../services/coachingApprenticeService.js";

export const apply: RequestHandler = asyncHandler(async (req, res) => {
  const application = await submitCoachingApprenticeApplication(
    req.validatedBody as Parameters<typeof submitCoachingApprenticeApplication>[0],
    req.ip,
    req.get("user-agent"),
  );
  res.status(201).json({ success: true, data: application });
});

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const data = await listCoachingApprenticeApplications(
    req.validatedQuery as { page: number; limit: number; status?: string },
  );
  res.json({ success: true, data });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const application = await getCoachingApprenticeApplication(req.params.id as string);
  res.json({ success: true, data: application });
});

export const updateStatus: RequestHandler = asyncHandler(async (req, res) => {
  const application = await updateCoachingApprenticeApplicationStatus(
    req.params.id as string,
    (req.validatedBody as { status: string }).status,
    req.auth!.staffId,
    req.ip,
    req.get("user-agent"),
  );
  res.json({ success: true, data: application });
});
