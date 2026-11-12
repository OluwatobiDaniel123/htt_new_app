import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import {
  authenticate,
  requirePermission,
  uuidParam,
} from "../auth/middleware.js";
import * as payments from "../controllers/paymentController.js";
import { validateBody, validateQuery } from "../validation/request.js";
import {
  financeSummaryQuery,
  initializePaymentBody,
  manualPaymentBody,
  manualRefundBody,
  paymentListQuery,
  refundBody,
} from "../validation/paymentSchemas.js";

export const paymentRoutes = Router();
// Express's default proxy trust is disabled; these limits use req.ip as supplied
// by the socket unless the deployment explicitly configures a trusted proxy.
export const paystackWebhookLimiter = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
export const paymentVerificationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
paymentRoutes.post("/webhook/paystack", paystackWebhookLimiter, payments.webhook);
// The hosted checkout returns to a public callback, which must be able to ask
// the server to verify the opaque Paystack reference. The reference is only a
// lookup key; payment status is always established by the server-side request.
paymentRoutes.post("/verify/:reference", paymentVerificationLimiter, payments.verify);
paymentRoutes.use(authenticate);
paymentRoutes.get(
  "/",
  requirePermission("payments.read"),
  validateQuery(paymentListQuery),
  payments.list,
);
paymentRoutes.post(
  "/initialize",
  requirePermission("payments.initialize", "full"),
  validateBody(initializePaymentBody),
  payments.initialize,
);
paymentRoutes.post(
  "/manual",
  requirePermission("payments.record", "full"),
  validateBody(manualPaymentBody),
  payments.manual,
);
paymentRoutes.get(
  "/reports/summary",
  requirePermission("reports.finance.read"),
  validateQuery(financeSummaryQuery),
  payments.summary,
);
paymentRoutes.get(
  "/:id/receipt",
  uuidParam(),
  requirePermission("payments.receipt.read"),
  payments.receipt,
);
paymentRoutes.post(
  "/:id/refunds",
  uuidParam(),
  requirePermission("payments.refunds.request", "full"),
  validateBody(refundBody),
  payments.requestRefund,
);
paymentRoutes.get(
  "/:id",
  uuidParam(),
  requirePermission("payments.read"),
  payments.detail,
);
paymentRoutes.post(
  "/refunds/:refundId/approve",
  uuidParam("refundId"),
  requirePermission("payments.refunds.approve", "full"),
  payments.approveRefund,
);
paymentRoutes.post(
  "/refunds/:refundId/confirm-manual",
  uuidParam("refundId"),
  requirePermission("payments.refunds.approve", "full"),
  validateBody(manualRefundBody),
  payments.manualRefund,
);
