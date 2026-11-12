/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";
import { enqueueNotificationEvent } from "./notificationService.js";

export const moneyMinor = (value: unknown) => {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new AppError(
      400,
      "INVALID_AMOUNT",
      "Amount must be a positive value with at most two decimal places.",
    );
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole ?? "0") * 100n + BigInt(fraction.padEnd(2, "0"));
};
export const fromMinor = (value: bigint) =>
  `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
const newReference = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${randomBytes(8).toString("hex")}`;
const publicPayment = (payment: any) => ({
  id: payment.id,
  reference: payment.reference,
  registrationId: payment.registrationId ?? null,
  playerId: payment.playerId ?? null,
  playerName: null,
  payerName: null,
  guardianId: payment.guardianId ?? null,
  programmeId: payment.programmeId ?? null,
  centreId: payment.centreId ?? null,
  amount: payment.amount,
  currency: payment.currency,
  method: payment.method,
  purpose: payment.purpose,
  status: payment.status,
  paidAt: payment.paidAt ?? null,
  receiptNumber: payment.receiptNumber ?? null,
  refundAmount: payment.refundAmount,
  providerStatus: payment.providerStatus ?? null,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});
export const createPaystackClient =
  (
    config: { secretKey: string; baseUrl: string; timeoutMs: number },
    fetchImpl: typeof fetch = fetch,
  ) =>
  async (path: string, body?: unknown) => {
    if (!config.secretKey)
      throw new AppError(
        503,
        "PAYMENTS_UNAVAILABLE",
        "Online payments are not configured.",
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(`${config.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = (await response.json()) as any;
      if (!response.ok || data.status !== true)
        throw new AppError(
          502,
          "PAYSTACK_ERROR",
          "Payment provider request failed.",
        );
      return data.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        503,
        "PAYSTACK_UNAVAILABLE",
        "Payment provider could not be reached. The payment remains pending until verified.",
      );
    } finally {
      clearTimeout(timeout);
    }
  };
const paystackRequest = createPaystackClient(
  {
    secretKey: env.PAYSTACK_SECRET_KEY,
    baseUrl: env.PAYSTACK_API_BASE_URL,
    timeoutMs: env.PAYSTACK_TIMEOUT_MS,
  },
  (input, init) => fetch(input, init),
);

const setRegistrationPaymentState = async (
  registrationId: string,
  transaction: Transaction,
) => {
  const registration = (await models.Registration.unscoped().findByPk(
    registrationId,
    { transaction, lock: transaction.LOCK.UPDATE },
  )) as any;
  if (!registration) return;
  const payments = (await models.Payment.findAll({
    where: {
      registrationId,
      status: { [Op.in]: ["successful", "partially_refunded", "refunded"] },
    },
    transaction,
    attributes: ["amount", "currency", "refundAmount"],
  })) as any[];
  const matchingPayments = payments.filter((payment) => String(payment.currency).trim().toUpperCase() === String(registration.amountDueCurrency || "NGN").trim().toUpperCase());
  const paid = matchingPayments.reduce(
    (sum, payment) =>
      sum + moneyMinor(payment.amount) - moneyMinor(payment.refundAmount ?? 0),
    0n,
  );
  const due = moneyMinor(registration.amountDue ?? 0);
  registration.paymentStatus =
    paid <= 0n ? "unpaid" : paid < due ? "partial" : "paid";
  await registration.save({ transaction });
};

const markSuccessful = async (paymentId: string, transaction: Transaction) => {
  const payment = (await models.Payment.unscoped().findByPk(paymentId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  })) as any;
  if (
    !payment ||
    ["successful", "partially_refunded", "refunded"].includes(payment.status)
  )
    return payment;
  payment.status = "successful";
  payment.paidAt = new Date();
  payment.receiptNumber ??= newReference("HTT-RCP").toUpperCase();
  await payment.save({ transaction });
  if (payment.registrationId)
    await setRegistrationPaymentState(payment.registrationId, transaction);
  await enqueueNotificationEvent(
    "payment.confirmed",
    "payment",
    payment.id,
    transaction,
  );
  return payment;
};

const verifyProviderPayment = async (
  payment: any,
  actorId?: string,
  ipAddress?: string,
) => {
  const data = await paystackRequest(
    `/transaction/verify/${encodeURIComponent(payment.gatewayReference ?? payment.reference)}`,
  );
  assertProviderTransactionMatches(payment, data);
  const transaction = await sequelize.transaction();
  try {
    const locked = (await models.Payment.unscoped().findByPk(payment.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    locked.providerStatus = String(data.status ?? "unknown").slice(0, 40);
    locked.verifiedAt = new Date();
    locked.verifiedAmount = fromMinor(BigInt(String(data.amount)));
    locked.verifiedCurrency = String(data.currency ?? "").toUpperCase().slice(0, 3);
    locked.providerTransactionId = data.id == null ? null : String(data.id).slice(0, 120);
    locked.verificationDetails = {
      status: String(data.status ?? "unknown").slice(0, 40),
      reference: String(data.reference ?? "").slice(0, 160),
      amount: String(data.amount ?? ""), currency: String(data.currency ?? "").slice(0, 3),
      paidAt: data.paid_at ?? null, channel: data.channel ?? null,
    };
    if (data.status === "success") {
      const successful = await markSuccessful(locked.id, transaction);
      locked.status = successful.status;
      locked.paidAt = successful.paidAt;
      locked.receiptNumber = successful.receiptNumber;
    }
    else if (
      ["failed", "abandoned", "reversed", "expired"].includes(data.status) &&
      locked.status === "pending"
    ) {
      locked.status = data.status === "abandoned" ? "cancelled" : data.status === "expired" ? "expired" : "failed";
      await enqueueNotificationEvent(
        "payment.failed",
        "payment",
        locked.id,
        transaction,
      );
    }
    await locked.save({ transaction });
    await writeAudit({
      actorId,
      action: "payment.verified",
      entityName: "payment",
      recordId: locked.id,
      transaction,
      ipAddress,
    });
    await transaction.commit();
    return publicPayment(locked);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const assertProviderTransactionMatches = (payment: any, data: any) => {
  if (
    data.reference !== payment.gatewayReference &&
    data.reference !== payment.reference
  )
    throw new AppError(
      409,
      "REFERENCE_MISMATCH",
      "Payment reference could not be verified.",
    );
  const expectedAmount = moneyMinor(payment.amount);
  const requestedAmount = data.requested_amount == null
    ? null
    : BigInt(String(data.requested_amount));
  const chargedAmount = BigInt(String(data.amount));
  if (
    (requestedAmount !== null && requestedAmount !== expectedAmount) ||
    chargedAmount < expectedAmount
  )
    throw new AppError(
      409,
      "AMOUNT_MISMATCH",
      "Verified amount does not match the payment record.",
    );
  if (String(data.currency).toUpperCase() !== payment.currency)
    throw new AppError(
      409,
      "CURRENCY_MISMATCH",
      "Verified currency does not match the payment record.",
    );
  if (
    payment.payerEmail &&
    String(data.customer?.email ?? "").toLowerCase() !==
      payment.payerEmail.toLowerCase()
  )
    throw new AppError(
      409,
      "CUSTOMER_MISMATCH",
      "Verified payer does not match the payment record.",
    );
};

export const refundableMinor = (
  amount: unknown,
  alreadyRefunded: unknown,
  reserved: unknown,
) =>
  moneyMinor(amount) -
  moneyMinor(alreadyRefunded ?? 0) -
  moneyMinor(reserved ?? 0);

export const balanceFor = (due: unknown, collected: unknown) => {
  const dueMinor = moneyMinor(due ?? 0),
    collectedMinor = moneyMinor(collected ?? 0);
  return {
    outstanding: fromMinor(
      dueMinor > collectedMinor ? dueMinor - collectedMinor : 0n,
    ),
    overpayment: fromMinor(
      collectedMinor > dueMinor ? collectedMinor - dueMinor : 0n,
    ),
  };
};

export const initializePayment = async (
  input: any,
  actorId: string | null,
  ipAddress?: string,
) => {
  const prior = (await models.Payment.unscoped().findOne({
    where: { idempotencyKey: input.idempotencyKey },
  })) as any;
  if (prior) {
    if (
      prior.method !== "paystack" ||
      prior.status !== "pending" ||
      prior.registrationId !== input.registrationId ||
      prior.purpose !== input.purpose
    )
      throw new AppError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request key has already been used.",
      );
    return {
      payment: publicPayment(prior),
      authorizationUrl: prior.metadata?.checkoutUrl ?? null,
      duplicate: true,
    };
  }
  if (!env.PAYSTACK_SECRET_KEY)
    throw new AppError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Online payments are not configured.",
    );
  const transaction = await sequelize.transaction();
  let registration: any;
  let payment: any;
  let amountMinor = 0n;
  try {
    registration = (await models.Registration.unscoped().findByPk(
      input.registrationId,
      { transaction, lock: transaction.LOCK.UPDATE },
    )) as any;
    if (!registration)
      throw new AppError(
        404,
        "REGISTRATION_NOT_FOUND",
        "Registration was not found.",
      );
    if (!registration.guardianEmail)
      throw new AppError(
        400,
        "PAYER_EMAIL_REQUIRED",
        "A registration guardian email is required for online payment.",
      );
    const programme = registration.programmeId
      ? ((await models.Programme.findByPk(registration.programmeId, {
          transaction,
        })) as any)
      : null;
    const currency = String(registration.amountDueCurrency || programme?.currency || "NGN").trim().toUpperCase();
    if (currency !== "NGN")
      throw new AppError(409, "PAYMENT_CURRENCY_UNSUPPORTED", "Online registration payments currently support NGN only.");
    const due = moneyMinor(
      input.purpose === "programme_fee"
        ? (programme?.approvedFee ?? 0)
        : registration.amountDue && moneyMinor(registration.amountDue) > 0n
          ? registration.amountDue
          : (programme?.approvedFee ?? 0),
    );
    const priorPayments = (await models.Payment.findAll({
      where: {
        registrationId: registration.id,
        status: {
          [Op.in]: ["successful", "partially_refunded", "refunded", "pending"],
        },
      },
      transaction,
      attributes: ["id", "amount", "refundAmount", "status", "expiresAt"],
    })) as any[];
    for (const priorPayment of priorPayments) {
      if (priorPayment.status === "pending" && priorPayment.expiresAt && new Date(priorPayment.expiresAt) <= new Date()) {
        priorPayment.status = "expired";
        await priorPayment.save({ transaction });
      }
    }
    const reserved = priorPayments.reduce(
      (sum, item) =>
        sum +
        (item.status === "expired" ? 0n : item.status === "pending"
          ? moneyMinor(item.amount)
          : moneyMinor(item.amount) - moneyMinor(item.refundAmount ?? 0)),
      0n,
    );
    amountMinor = due - reserved;
    if (amountMinor <= 0n)
      throw new AppError(
        409,
        "NO_BALANCE_DUE",
        "The registration has no remaining payable balance.",
      );
    payment = (await models.Payment.create(
      {
        reference: newReference("HTT-PAY").toUpperCase(),
        gatewayReference: newReference("htt")
          .replace(/[^A-Za-z0-9=.-]/g, "")
          .slice(0, 60),
        idempotencyKey: input.idempotencyKey,
        registrationId: registration.id,
        playerId: registration.linkedPlayerId ?? null,
        playerName: registration.childName,
        guardianId: registration.guardianId ?? null,
        programmeId: registration.programmeId ?? null,
        centreId: registration.centreId ?? null,
        payerName: registration.guardianName,
        payerEmail: registration.guardianEmail,
        amount: fromMinor(amountMinor),
        currency,
        method: "paystack",
        purpose: input.purpose,
        status: "pending",
        recordedById: actorId,
      },
      { transaction },
    )) as any;
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    if ((error as any)?.name === "SequelizeUniqueConstraintError") {
      const duplicate = (await models.Payment.unscoped().findOne({
        where: { idempotencyKey: input.idempotencyKey },
      })) as any;
      if (duplicate)
        return {
          payment: publicPayment(duplicate),
          authorizationUrl: duplicate.metadata?.checkoutUrl ?? null,
          duplicate: true,
        };
    }
    throw error;
  }
  let initialized: any;
  try {
    initialized = await paystackRequest("/transaction/initialize", {
      email: registration.guardianEmail,
      amount: amountMinor.toString(),
      currency: "NGN",
      reference: payment.gatewayReference,
      callback_url: env.PAYSTACK_CALLBACK_URL,
      metadata: {
        payment_id: payment.id,
        payment_reference: payment.reference,
        registration_id: registration.id,
      },
    });
  } catch {
    // Provider timeouts are ambiguous; keep the record pending to prevent double charging.
    await payment.update({ providerStatus: "initialization_unknown" });
    await writeAudit({
      actorId,
      action: "payment.initialization_outcome_unknown",
      entityName: "payment",
      recordId: payment.id,
      ipAddress,
    });
    return {
      payment: publicPayment(payment),
      authorizationUrl: null,
      duplicate: false,
      needsVerification: true,
    };
  }
  await payment.update({
    providerStatus: "initialized",
    metadata: { checkoutUrl: initialized.authorization_url },
  });
  const eventTransaction = await sequelize.transaction();
  try {
    await enqueueNotificationEvent(
      "payment.initiated",
      "payment",
      payment.id,
      eventTransaction,
    );
    await writeAudit({
      actorId,
      action: "payment.initialized",
      entityName: "payment",
      recordId: payment.id,
      ipAddress,
      transaction: eventTransaction,
    });
    await eventTransaction.commit();
  } catch {
    await eventTransaction.rollback();
  }
  return {
    payment: publicPayment(payment),
    authorizationUrl: initialized.authorization_url,
    duplicate: false,
  };
};

export const verifyPayment = async (
  reference: string,
  actorId?: string,
  ipAddress?: string,
) => {
  const payment = (await models.Payment.unscoped().findOne({
    where: { [Op.or]: [{ reference }, { gatewayReference: reference }] },
  })) as any;
  if (!payment)
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
  if (payment.method !== "paystack")
    throw new AppError(
      400,
      "INVALID_METHOD",
      "Only Paystack transactions can be provider verified.",
    );
  return verifyProviderPayment(payment, actorId, ipAddress);
};

export const verifyWebhookSignature = (
  rawBody: Buffer | undefined,
  legacySignature: string | undefined,
  paystackSignature?: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) => {
  if (!rawBody) return false;

  if (legacySignature && env.PAYSTACK_SECRET_KEY && /^[0-9a-f]{128}$/i.test(legacySignature)) {
    const expected = createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest();
    const supplied = Buffer.from(legacySignature, "hex");
    if (supplied.length === expected.length && timingSafeEqual(expected, supplied)) return true;
  }

  if (!paystackSignature || !env.PAYSTACK_WEBHOOK_SECRET) return false;
  const fields = paystackSignature.split(",").map((field) => field.trim());
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const field of fields) {
    const separator = field.indexOf("=");
    if (separator <= 0) return false;
    const key = field.slice(0, separator).trim();
    const value = field.slice(separator + 1).trim();
    if (key === "t") {
      if (timestamp !== undefined || !/^\d{1,12}$/.test(value)) return false;
      timestamp = Number(value);
    } else if (key === "v1") {
      const match = /^([A-Za-z0-9_-]+):([0-9a-f]{128})$/i.exec(value);
      if (!match) return false;
      signatures.push(match[2]!);
    }
  }
  if (
    timestamp === undefined ||
    signatures.length === 0 ||
    Math.abs(nowSeconds - timestamp) > 300
  ) return false;

  const expected = createHmac("sha512", env.PAYSTACK_WEBHOOK_SECRET)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  let matched = false;
  for (const signature of signatures) {
    const supplied = Buffer.from(signature, "hex");
    if (supplied.length === expected.length && timingSafeEqual(expected, supplied)) matched = true;
  }
  return matched;
};

const stableWebhookJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableWebhookJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableWebhookJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

export const paystackWebhookEventId = (event: any) => {
  const eventType = typeof event?.event === "string" ? event.event.trim() : "";
  if (!eventType) throw new AppError(400, "INVALID_WEBHOOK", "Webhook event is invalid.");
  if (eventType === "ping") return "ping";
  const data = event?.data;
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AppError(400, "INVALID_WEBHOOK", "Webhook event data is invalid.");

  const providerId = event?.id ?? (eventType.startsWith("refund.") ? data.refund_reference : data.id);
  if (providerId !== undefined && providerId !== null && String(providerId).trim())
    return `${eventType}:${String(providerId).trim()}`.slice(0, 200);

  const hasReference = [data.reference, data.transaction_reference].some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  const hasEventState = [data.status, data.amount, data.currency].some(
    (value) => value !== undefined && value !== null && String(value).length > 0,
  );
  if (!hasReference || !hasEventState)
    throw new AppError(400, "WEBHOOK_IDENTITY_MISSING", "Webhook event does not contain enough information for safe deduplication.");

  const digest = createHash("sha256").update(stableWebhookJson(event)).digest("hex");
  return `${eventType}:sha256:${digest}`;
};

export const matchPaystackRefund = (candidates: any[], data: any) => {
  const suppliedReference = [data?.refund_reference]
    .find((value) => typeof value === "string" && value.trim())?.trim();
  if (suppliedReference) {
    const matches = candidates.filter((refund) => {
      const referenceMatches = [refund.reference, refund.gatewayReference, refund.providerRefundReference]
        .some((value) => value && String(value) === suppliedReference);
      const amountMatches = data?.amount == null || /^\d+$/.test(String(data.amount)) && moneyMinor(refund.amount) === BigInt(String(data.amount));
      const currencyMatches = data?.currency == null || String(refund.currency).trim().toUpperCase() === String(data.currency).trim().toUpperCase();
      return referenceMatches && amountMatches && currencyMatches;
    });
    return matches.length === 1 ? { refund: matches[0], ambiguous: false } : { refund: null, ambiguous: matches.length > 1 };
  }
  if (data?.amount == null || !/^\d+$/.test(String(data.amount)))
    return { refund: null, ambiguous: candidates.length > 0 };
  const amount = BigInt(String(data.amount));
  const matches = candidates.filter((refund) =>
    moneyMinor(refund.amount) === amount &&
    (data?.currency == null || String(refund.currency).trim().toUpperCase() === String(data.currency).trim().toUpperCase()),
  );
  return matches.length === 1
    ? { refund: matches[0], ambiguous: false }
    : { refund: null, ambiguous: matches.length > 1 };
};

export const processPaystackWebhook = async (event: any) => {
  const eventType = String(event?.event ?? "");
  const eventId = paystackWebhookEventId(event);
  if (eventType === "ping") return { received: true, duplicate: false };
  const reference = String(
    event?.data?.reference ?? event?.data?.transaction_reference ?? "",
  );
  const payment = reference
    ? ((await models.Payment.unscoped().findOne({
        where: { [Op.or]: [{ gatewayReference: reference }, { reference }] },
      })) as any)
    : null;
  const transaction = await sequelize.transaction();
  try {
    const record = (await models.PaymentEvent.create(
      {
        paymentId: payment?.id ?? null,
        provider: "paystack",
        providerEventId: eventId,
        eventType,
        receivedAt: new Date(),
        processingStatus: "received",
        payload: {
          event: eventType,
          reference,
          providerRefundReference: event?.data?.refund_reference ?? null,
          amount: event?.data?.amount == null ? null : String(event.data.amount),
          currency: event?.data?.currency == null ? null : String(event.data.currency),
        },
      },
      { transaction },
    )) as any;
    if (eventType === "charge.success" && payment?.status === "pending") {
      await verifyProviderPayment(payment);
    } else if (eventType === "charge.success" && !payment) {
      record.processingStatus = "needs_reconciliation";
      await writeAudit({ action: "payment.webhook_unmatched", entityName: "payment_event", recordId: record.id, transaction, details: "charge_success_payment_not_found" });
    } else if (eventType.startsWith("refund.")) {
      if (!payment) {
        record.processingStatus = "needs_reconciliation";
        await writeAudit({ action: "refund.webhook_unmatched", entityName: "payment_event", recordId: record.id, transaction, details: "refund_payment_not_found" });
      } else {
      const candidates = (await models.Refund.findAll({
        where: {
          paymentId: payment.id,
          status: { [Op.in]: ["pending", "processing", "needs_attention"] },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
        order: [["createdAt", "ASC"]],
      })) as any[];
      const match = matchPaystackRefund(candidates, event?.data);
      const refund = match.refund;
      if (refund) {
        const statusMap: Record<string, string> = {
          "refund.pending": "pending",
          "refund.processing": "processing",
          "refund.processed": "successful",
          "refund.failed": "failed",
          "refund.needs-attention": "needs_attention",
        };
        refund.status = statusMap[eventType] ?? refund.status;
        refund.processedAt = refund.status === "successful" ? new Date() : null;
        await refund.save({ transaction });
        await writeAudit({
          action: `refund.provider_${refund.status}`,
          entityName: "refund",
          recordId: refund.id,
          transaction,
        });
        await refreshRefundTotals(refund.paymentId, transaction);
        if (["successful", "failed"].includes(refund.status))
          await enqueueNotificationEvent(
            refund.status === "successful"
              ? "refund.completed"
              : "refund.failed",
            "refund",
            refund.id,
            transaction,
          );
      } else {
        record.processingStatus = "needs_reconciliation";
        await writeAudit({
          action: "refund.webhook_unmatched",
          entityName: "payment_event",
          recordId: record.id,
          transaction,
          details: `${match.ambiguous ? "ambiguous_refund_event" : "unmatched_refund_event"}:${eventId}`,
        });
      }
      }
    }
    if (record.processingStatus === "received") record.processingStatus = "processed";
    await record.save({ transaction });
    await transaction.commit();
    return { received: true, duplicate: false };
  } catch (error: any) {
    await transaction.rollback();
    if (error?.name === "SequelizeUniqueConstraintError")
      return { received: true, duplicate: true };
    throw error;
  }
};

const refreshRefundTotals = async (
  paymentId: string,
  transaction: Transaction,
) => {
  const payment = (await models.Payment.findByPk(paymentId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  })) as any;
  if (!payment) return;
  const refunds = (await models.Refund.findAll({
    where: { paymentId, status: "successful" },
    transaction,
    attributes: ["amount"],
  })) as any[];
  const total = refunds.reduce(
    (sum, item) => sum + moneyMinor(item.amount),
    0n,
  );
  payment.refundAmount = fromMinor(total);
  payment.status =
    total === 0n
      ? "successful"
      : total >= moneyMinor(payment.amount)
        ? "refunded"
        : "partially_refunded";
  await payment.save({ transaction });
  if (payment.registrationId)
    await setRegistrationPaymentState(payment.registrationId, transaction);
};

export const recordManualPayment = async (
  input: any,
  actorId: string,
  ipAddress?: string,
) => {
  const amount = moneyMinor(input.amount);
  if (amount <= 0n)
    throw new AppError(
      400,
      "INVALID_AMOUNT",
      "Amount must be greater than zero.",
    );
  const prior = (await models.Payment.unscoped().findOne({
    where: { idempotencyKey: input.idempotencyKey },
  })) as any;
  if (prior) {
    if (
      prior.method !== input.method ||
      moneyMinor(prior.amount) !== amount ||
      prior.registrationId !== (input.registrationId ?? null) ||
      prior.playerId !== (input.playerId ?? null) ||
      prior.payerName !== input.payerName ||
      prior.gatewayReference !== (input.gatewayReference ?? null)
    )
      throw new AppError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request key has already been used.",
      );
    return publicPayment(prior);
  }
  const transaction = await sequelize.transaction();
  try {
    let registration: any = null;
    if (input.registrationId) {
      registration = (await models.Registration.unscoped().findByPk(
        input.registrationId,
        { transaction, lock: transaction.LOCK.UPDATE },
      )) as any;
      if (!registration)
        throw new AppError(
          404,
          "REGISTRATION_NOT_FOUND",
          "Registration was not found.",
        );
      if (
        input.playerId &&
        registration.linkedPlayerId &&
        input.playerId !== registration.linkedPlayerId
      )
        throw new AppError(
          400,
          "PLAYER_REGISTRATION_MISMATCH",
          "The selected player is not linked to this registration.",
        );
      if (
        input.programmeId &&
        registration.programmeId &&
        input.programmeId !== registration.programmeId
      )
        throw new AppError(
          400,
          "REGISTRATION_PROGRAMME_MISMATCH",
          "The programme does not match the registration.",
        );
      if (
        input.centreId &&
        registration.centreId &&
        input.centreId !== registration.centreId
      )
        throw new AppError(
          400,
          "REGISTRATION_CENTRE_MISMATCH",
          "The centre does not match the registration.",
        );
      if (registration.currency && registration.currency !== input.currency)
        throw new AppError(
          400,
          "CURRENCY_MISMATCH",
          "Payment currency must match the registration.",
        );
      const programme = registration.programmeId
        ? ((await models.Programme.findByPk(registration.programmeId, {
            transaction,
          })) as any)
        : null;
      if (programme?.currency && programme.currency !== input.currency)
        throw new AppError(
          400,
          "CURRENCY_MISMATCH",
          "Payment currency must match the programme.",
        );
    }
    const payment = (await models.Payment.create(
      {
        ...input,
        playerId: input.playerId ?? registration?.linkedPlayerId ?? null,
        playerName: input.playerName ?? registration?.childName ?? null,
        guardianId: input.guardianId ?? registration?.guardianId ?? null,
        programmeId: input.programmeId ?? registration?.programmeId ?? null,
        centreId: input.centreId ?? registration?.centreId ?? null,
        payerEmail: input.payerEmail ?? registration?.guardianEmail ?? null,
        amount: fromMinor(amount),
        reference: newReference("HTT-MAN").toUpperCase(),
        receiptNumber: newReference("HTT-RCP").toUpperCase(),
        status: "successful",
        paidAt: new Date(input.paidAt),
        recordedById: actorId,
        refundAmount: "0.00",
      },
      { transaction },
    )) as any;
    if (input.registrationId) {
      await models.PaymentAllocation.create(
        {
          paymentId: payment.id,
          registrationId: input.registrationId,
          amount: fromMinor(amount),
        },
        { transaction },
      );
      await setRegistrationPaymentState(input.registrationId, transaction);
    }
    await writeAudit({
      actorId,
      action: "payment.manual_recorded",
      entityName: "payment",
      recordId: payment.id,
      ipAddress,
      transaction,
    });
    await enqueueNotificationEvent(
      "payment.confirmed",
      "payment",
      payment.id,
      transaction,
    );
    await transaction.commit();
    return publicPayment(payment);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const listPayments = async (query: any) => {
  const page = Number(query.page ?? 1),
    limit = Number(query.limit ?? 25);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Pagination values are invalid.",
    );
  const where: any = {};
  for (const key of [
    "playerId",
    "registrationId",
    "method",
    "status",
    "programmeId",
    "centreId",
  ] as const)
    if (query[key]) where[key] = query[key];
  if (query.from || query.to)
    where.createdAt = {
      ...(query.from
        ? { [Op.gte]: new Date(`${query.from}T00:00:00.000Z`) }
        : {}),
      ...(query.to ? { [Op.lte]: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    };
  const result = await models.Payment.findAndCountAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });
  return {
    items: result.rows.map(publicPayment),
    page,
    limit,
    total: result.count,
  };
};

export const getPayment = async (id: string) => {
  const payment = (await models.Payment.unscoped().findByPk(id, {
    include: [
      {
        model: models.Refund,
        as: "refunds",
        attributes: [
          "id",
          "reference",
          "amount",
          "currency",
          "reason",
          "status",
          "requestedById",
          "approvedById",
          "processedAt",
          "createdAt",
          "updatedAt",
        ],
      },
    ],
  })) as any;
  if (!payment)
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment was not found.");
  return {
    ...publicPayment(payment),
    refunds: (payment.refunds ?? []).map((refund: any) => ({
      id: refund.id,
      reference: refund.reference,
      amount: refund.amount,
      currency: refund.currency,
      reason: refund.reason,
      status: refund.status,
      requestedById: refund.requestedById,
      approvedById: refund.approvedById,
      processedAt: refund.processedAt,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    })),
  };
};

export const getReceipt = async (
  id: string,
  includePlayer: boolean,
  includePayer: boolean,
) => {
  const payment = (await models.Payment.unscoped().findByPk(id)) as any;
  if (
    !payment ||
    !["successful", "partially_refunded", "refunded"].includes(
      payment.status,
    ) ||
    !payment.receiptNumber
  )
    throw new AppError(
      404,
      "RECEIPT_NOT_AVAILABLE",
      "Receipt is not available.",
    );
  return {
    academy: "HTT Academy",
    receiptNumber: payment.receiptNumber,
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    paidAt: payment.paidAt,
    method: payment.method,
    ...(includePayer ? { payerName: payment.payerName } : {}),
    ...(includePlayer ? { playerName: payment.playerName ?? null } : {}),
    status: payment.status,
    refundAmount: payment.refundAmount,
  };
};

export const requestRefund = async (
  paymentId: string,
  input: any,
  actorId: string,
  ipAddress?: string,
) => {
  const transaction = await sequelize.transaction();
  try {
    const payment = (await models.Payment.findByPk(paymentId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (
      !payment ||
      !["successful", "partially_refunded"].includes(payment.status)
    )
      throw new AppError(
        409,
        "PAYMENT_NOT_REFUNDABLE",
        "Only successful, not fully refunded payments can be refunded.",
      );
    const openRefunds = (await models.Refund.findAll({
      where: {
        paymentId,
        status: {
          [Op.in]: ["requested", "pending", "processing", "needs_attention"],
        },
      },
      transaction,
      attributes: ["amount"],
    })) as any[];
    const reserved = openRefunds.reduce(
      (sum, item) => sum + moneyMinor(item.amount),
      0n,
    );
    const refundable = refundableMinor(
      payment.amount,
      payment.refundAmount ?? 0,
      fromMinor(reserved),
    );
    const amount = moneyMinor(input.amount);
    if (amount <= 0n || amount > refundable)
      throw new AppError(
        400,
        "REFUND_EXCEEDS_REMAINDER",
        "Refund exceeds the remaining refundable amount.",
      );
    const refund = (await models.Refund.create(
      {
        paymentId,
        reference: newReference("HTT-REF").toUpperCase(),
        amount: fromMinor(amount),
        currency: payment.currency,
        reason: input.reason,
        status: "requested",
        requestedById: actorId,
      },
      { transaction },
    )) as any;
    await writeAudit({
      actorId,
      action: "refund.requested",
      entityName: "refund",
      recordId: refund.id,
      ipAddress,
      transaction,
    });
    await enqueueNotificationEvent(
      "refund.requested",
      "refund",
      refund.id,
      transaction,
    );
    await transaction.commit();
    return refund;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const approveRefund = async (
  refundId: string,
  actorId: string,
  ipAddress?: string,
) => {
  const transaction = await sequelize.transaction();
  let refund: any;
  let payment: any;
  try {
    refund = (await models.Refund.findByPk(refundId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!refund || refund.status !== "requested")
      throw new AppError(
        409,
        "REFUND_NOT_APPROVABLE",
        "Refund is not awaiting approval.",
      );
    payment = (await models.Payment.unscoped().findByPk(refund.paymentId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (payment.method !== "paystack")
      throw new AppError(
        409,
        "MANUAL_REFUND_CONFIRMATION_REQUIRED",
        "For a manual payment, use the manual refund confirmation workflow after the transfer is completed.",
      );
    refund.status = "pending";
    refund.approvedById = actorId;
    await refund.save({ transaction });
    await writeAudit({
      actorId,
      action: "refund.submitted_to_provider",
      entityName: "refund",
      recordId: refund.id,
      ipAddress,
      transaction,
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  // Once approved, retries cannot submit a second provider refund. A timeout leaves it pending for webhook reconciliation.
  const result = await paystackRequest("/refund", {
    transaction: payment.gatewayReference ?? payment.reference,
    amount: moneyMinor(refund.amount).toString(),
    reference: refund.reference,
    merchant_note: String(refund.reason).slice(0, 200),
  });
  refund.status = result.status === "processing" ? "processing" : "pending";
  refund.gatewayReference = result.id ? String(result.id) : null;
  refund.providerRefundReference = result.refund_reference ?? result.reference ?? null;
  refund.metadata = { providerStatus: result.status ?? "pending" };
  await refund.save();
  return refund;
};

export const confirmManualRefund = async (
  refundId: string,
  actorId: string,
  outcome: "successful" | "failed",
  ipAddress?: string,
) => {
  const transaction = await sequelize.transaction();
  try {
    const refund = (await models.Refund.findByPk(refundId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    const payment = refund
      ? ((await models.Payment.findByPk(refund.paymentId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })) as any)
      : null;
    if (
      !refund ||
      refund.status !== "requested" ||
      payment?.method === "paystack"
    )
      throw new AppError(
        409,
        "MANUAL_REFUND_INVALID",
        "Only a requested refund for a manual payment can be confirmed.",
      );
    refund.status = outcome;
    refund.approvedById = actorId;
    refund.processedAt = new Date();
    await refund.save({ transaction });
    if (outcome === "successful")
      await refreshRefundTotals(refund.paymentId, transaction);
    await writeAudit({
      actorId,
      action: `refund.manual_${outcome}`,
      entityName: "refund",
      recordId: refund.id,
      transaction,
      ipAddress,
    });
    await enqueueNotificationEvent(
      outcome === "successful" ? "refund.completed" : "refund.failed",
      "refund",
      refund.id,
      transaction,
    );
    await transaction.commit();
    return refund;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const getFinanceSummary = async (query: any) => {
  const scope: any = {
    ...(query.programmeId ? { programmeId: query.programmeId } : {}),
    ...(query.centreId ? { centreId: query.centreId } : {}),
  };
  const allPayments = (await models.Payment.findAll({ where: scope })) as any[];
  const inRange = (date: unknown) => {
    const value = new Date(String(date)).getTime();
    return (
      (!query.from || value >= new Date(`${query.from}T00:00:00Z`).getTime()) &&
      (!query.to || value <= new Date(`${query.to}T23:59:59.999Z`).getTime())
    );
  };
  const payments = allPayments.filter((payment) =>
    inRange(
      ["successful", "partially_refunded", "refunded"].includes(payment.status)
        ? (payment.paidAt ?? payment.createdAt)
        : payment.createdAt,
    ),
  );
  const totals = { successful: 0n, pending: 0n, failed: 0n, refunded: 0n };
  const groups = new Map<
    string,
    {
      count: number;
      successful: bigint;
      pending: bigint;
      failed: bigint;
      refunded: bigint;
    }
  >();
  for (const payment of payments) {
    const value = moneyMinor(payment.amount);
    const key = `${payment.programmeId ?? "unassigned"}:${payment.centreId ?? "unassigned"}:${payment.method}`;
    const group = groups.get(key) ?? {
      count: 0,
      successful: 0n,
      pending: 0n,
      failed: 0n,
      refunded: 0n,
    };
    group.count++;
    if (
      ["successful", "partially_refunded", "refunded"].includes(
        payment.status,
      ) &&
      payment.method !== "waiver"
    ) {
      totals.successful += value;
      group.successful += value;
    }
    if (payment.status === "pending") {
      totals.pending += value;
      group.pending += value;
    }
    if (payment.status === "failed" || payment.status === "cancelled") {
      totals.failed += value;
      group.failed += value;
    }
    groups.set(key, group);
  }
  const refundRows = (await models.Refund.findAll({
    where: {
      status: "successful",
      ...(query.from || query.to
        ? {
            processedAt: {
              ...(query.from
                ? { [Op.gte]: new Date(`${query.from}T00:00:00Z`) }
                : {}),
              ...(query.to
                ? { [Op.lte]: new Date(`${query.to}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
    },
    include: [
      {
        model: models.Payment,
        as: "payment",
        attributes: ["programmeId", "centreId", "method"],
      },
    ],
  })) as any[];
  for (const refund of refundRows) {
    const payment = refund.payment;
    if (
      !payment ||
      (query.programmeId && payment.programmeId !== query.programmeId) ||
      (query.centreId && payment.centreId !== query.centreId)
    )
      continue;
    const amount = moneyMinor(refund.amount);
    totals.refunded += amount;
    const key = `${payment.programmeId ?? "unassigned"}:${payment.centreId ?? "unassigned"}:${payment.method}`;
    const group = groups.get(key) ?? {
      count: 0,
      successful: 0n,
      pending: 0n,
      failed: 0n,
      refunded: 0n,
    };
    group.refunded += amount;
    groups.set(key, group);
  }
  const regs = (await models.Registration.unscoped().findAll({
    where: {
      status: { [Op.ne]: "rejected" },
      ...(query.programmeId ? { programmeId: query.programmeId } : {}),
      ...(query.centreId ? { centreId: query.centreId } : {}),
    },
    attributes: ["id", "amountDue"],
  })) as any[];
  const balances = await Promise.all(
    regs.map(async (reg) => {
      const linked = allPayments.filter(
        (payment) =>
          payment.registrationId === reg.id &&
          ["successful", "partially_refunded", "refunded"].includes(
            payment.status,
          ) &&
          payment.method !== "waiver",
      );
      const collected = linked.reduce(
        (sum, payment) =>
          sum +
          moneyMinor(payment.amount) -
          moneyMinor(payment.refundAmount ?? 0),
        0n,
      );
      const due = moneyMinor(reg.amountDue ?? 0);
      return {
        due,
        collected,
        outstanding: due > collected ? due - collected : 0n,
        overpayment: collected > due ? collected - due : 0n,
      };
    }),
  );
  return {
    currency: "NGN",
    payments: payments.length,
    successfulGross: fromMinor(totals.successful),
    successfulNet: fromMinor(totals.successful - totals.refunded),
    pending: fromMinor(totals.pending),
    failed: fromMinor(totals.failed),
    refunds: fromMinor(totals.refunded),
    totalDue: fromMinor(balances.reduce((sum, item) => sum + item.due, 0n)),
    outstanding: fromMinor(
      balances.reduce((sum, item) => sum + item.outstanding, 0n),
    ),
    overpayments: fromMinor(
      balances.reduce((sum, item) => sum + item.overpayment, 0n),
    ),
    byProgrammeCentreMethod: [...groups].map(([key, value]) => ({
      key,
      count: value.count,
      successfulGross: fromMinor(value.successful),
      pending: fromMinor(value.pending),
      failed: fromMinor(value.failed),
      refunds: fromMinor(value.refunded),
    })),
  };
};
