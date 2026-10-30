import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/paymentService.js";

const actor = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return req.auth.staffId;
};
export const list: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.listPayments(req.validatedQuery ?? {}),
  }),
);
export const detail: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getPayment(req.params.id as string),
  }),
);
export const initialize: RequestHandler = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({
      success: true,
      data: await service.initializePayment(req.body, actor(req), req.ip),
    }),
);
export const verify: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.verifyPayment(
      req.params.reference as string,
      actor(req),
      req.ip,
    ),
  }),
);
export const manual: RequestHandler = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({
      success: true,
      data: await service.recordManualPayment(req.body, actor(req), req.ip),
    }),
);
export const receipt: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getReceipt(
      req.params.id as string,
      req.auth?.permissions["players.read_sensitive"] === "full",
      req.auth?.permissions["guardians.read_contact"] === "full",
    ),
  }),
);
export const requestRefund: RequestHandler = asyncHandler(async (req, res) =>
  res
    .status(201)
    .json({
      success: true,
      data: await service.requestRefund(
        req.params.id as string,
        req.body,
        actor(req),
        req.ip,
      ),
    }),
);
export const approveRefund: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.approveRefund(
      req.params.refundId as string,
      actor(req),
      req.ip,
    ),
  }),
);
export const manualRefund: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.confirmManualRefund(
      req.params.refundId as string,
      actor(req),
      req.body.outcome,
      req.ip,
    ),
  }),
);
export const summary: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getFinanceSummary(req.validatedQuery ?? {}),
  }),
);
export const webhook: RequestHandler = asyncHandler(async (req, res) => {
  if (
    !service.verifyWebhookSignature(
      req.rawBody,
      req.header("x-paystack-signature"),
    )
  )
    throw new AppError(
      401,
      "INVALID_WEBHOOK_SIGNATURE",
      "Webhook signature is invalid.",
    );
  res
    .status(200)
    .json({
      success: true,
      data: await service.processPaystackWebhook(req.body),
    });
});
