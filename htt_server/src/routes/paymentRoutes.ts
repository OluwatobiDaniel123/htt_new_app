import { Router } from "express";
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
paymentRoutes.post("/webhook/paystack", payments.webhook);
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
  "/verify/:reference",
  requirePermission("payments.verify", "full"),
  payments.verify,
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
