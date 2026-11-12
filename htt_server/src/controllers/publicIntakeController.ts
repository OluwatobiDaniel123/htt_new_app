import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getPublicReferenceData,
  getPublicPaymentSummary,
  submitPublicEnquiry,
  submitPublicRegistration,
  submitPublicScholarship,
  submitPublicSponsorship,
} from "../services/publicIntakeService.js";
import type { PublicIntakeInput } from "../validation/publicIntakeSchemas.js";

export const publicIntake: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.validatedBody as PublicIntakeInput;
  switch (input.action) {
    case "reference_data":
      res.json(await getPublicReferenceData());
      return;
    case "submit_registration":
      res.status(201).json(await submitPublicRegistration(input.registration, req.ip, req.registrationImage));
      return;
    case "submit_enquiry":
      res.status(201).json(await submitPublicEnquiry(input, req.ip));
      return;
    case "submit_scholarship":
      res.status(201).json(await submitPublicScholarship(input, req.ip));
      return;
    case "submit_sponsorship":
      res.status(201).json(await submitPublicSponsorship(input, req.ip));
      return;
    default:
      throw new AppError(400, "UNKNOWN_ACTION", "A supported public intake action is required.");
  }
});

export const publicPaymentSummary: RequestHandler = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await getPublicPaymentSummary(req.params.reference as string) }),
);
