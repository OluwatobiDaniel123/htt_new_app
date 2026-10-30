/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { sendNotificationEmail } from "./emailService.js";
import { normalizePhone } from "./academyShared.js";
import {
  notificationTemplateCatalog,
  renderNotificationTemplate,
} from "./notificationTemplates.js";
import { writeAudit } from "./auditService.js";

const channelByEvent: Record<string, string[]> = {
  "registration.received": ["email", "sms"],
  "registration.approved": ["email", "sms"],
  "registration.rejected": ["email", "sms"],
  "registration.information_required": ["email", "sms"],
  "payment.initiated": ["email", "sms"],
  "payment.confirmed": ["email", "sms"],
  "payment.failed": ["email", "sms"],
  "refund.requested": ["email", "sms"],
  "refund.completed": ["email", "sms"],
  "refund.failed": ["email", "sms"],
};

export const enqueueNotificationEvent = async (
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  transaction: Transaction,
  payload: Record<string, unknown> = {},
) => {
  const channels = channelByEvent[eventType];
  if (!channels) return;
  return models.NotificationOutbox.create(
    {
      eventKey: `${eventType}:${aggregateId}`.slice(0, 180),
      eventType,
      aggregateType,
      aggregateId,
      payload,
      channels,
      status: "pending",
      availableAt: new Date(),
    },
    { transaction },
  );
};

const eventVariables = async (outbox: any) => {
  if (outbox.eventType.startsWith("registration.")) {
    const registration = (await models.Registration.unscoped().findByPk(
      outbox.aggregateId,
    )) as any;
    if (!registration)
      throw new AppError(
        404,
        "NOTIFICATION_SOURCE_MISSING",
        "Notification source record is unavailable.",
      );
    return {
      recipient: {
        email: registration.guardianEmail,
        phone: registration.guardianPhone,
        guardianId: registration.guardianId,
      },
      variables: {
        guardianName: registration.guardianName,
        childName: registration.childName,
        reference: registration.reference,
        note: String(outbox.payload?.note ?? ""),
      },
    };
  }
  if (outbox.eventType.startsWith("payment.")) {
    const payment = (await models.Payment.unscoped().findByPk(
      outbox.aggregateId,
    )) as any;
    if (!payment)
      throw new AppError(
        404,
        "NOTIFICATION_SOURCE_MISSING",
        "Notification source record is unavailable.",
      );
    const guardian = payment.guardianId
      ? ((await models.Guardian.unscoped().findByPk(payment.guardianId)) as any)
      : null;
    const registration = payment.registrationId
      ? ((await models.Registration.unscoped().findByPk(
          payment.registrationId,
        )) as any)
      : null;
    return {
      recipient: {
        email: payment.payerEmail ?? registration?.guardianEmail,
        phone: guardian?.phone ?? registration?.guardianPhone,
        guardianId: payment.guardianId ?? registration?.guardianId,
      },
      variables: {
        guardianName:
          payment.payerName ?? registration?.guardianName ?? "Guardian",
        amount: String(payment.amount),
        currency: payment.currency,
        reference: payment.reference,
        receiptNumber: payment.receiptNumber ?? "",
      },
    };
  }
  if (outbox.eventType.startsWith("refund.")) {
    const refund = (await models.Refund.findByPk(outbox.aggregateId)) as any;
    if (!refund)
      throw new AppError(
        404,
        "NOTIFICATION_SOURCE_MISSING",
        "Notification source record is unavailable.",
      );
    const payment = (await models.Payment.unscoped().findByPk(
      refund.paymentId,
    )) as any;
    if (!payment)
      throw new AppError(
        404,
        "NOTIFICATION_SOURCE_MISSING",
        "Notification source record is unavailable.",
      );
    const registration = payment.registrationId
      ? ((await models.Registration.unscoped().findByPk(
          payment.registrationId,
        )) as any)
      : null;
    const guardian = payment.guardianId
      ? ((await models.Guardian.unscoped().findByPk(payment.guardianId)) as any)
      : null;
    return {
      recipient: {
        email: payment.payerEmail ?? registration?.guardianEmail,
        phone: guardian?.phone ?? registration?.guardianPhone,
        guardianId: payment.guardianId ?? registration?.guardianId,
      },
      variables: {
        guardianName:
          payment.payerName ?? registration?.guardianName ?? "Guardian",
        amount: String(refund.amount),
        currency: refund.currency,
        reference: payment.reference,
      },
    };
  }
  if (outbox.eventType === "announcement") {
    const staff = (await models.StaffAccount.findByPk(
      outbox.recipientStaffId,
    )) as any;
    if (!staff || !staff.active || staff.suspendedAt)
      return {
        recipient: {},
        variables: {
          title: String(outbox.payload.title),
          body: String(outbox.payload.body),
          link: outbox.payload.link ?? null,
        },
      };
    return {
      recipient: {
        staffId: staff?.id,
        email: staff?.email,
        phone: staff?.phone,
      },
      variables: {
        title: String(outbox.payload.title),
        body: String(outbox.payload.body),
        link: outbox.payload.link ?? null,
      },
    };
  }
  throw new AppError(
    400,
    "UNKNOWN_NOTIFICATION_EVENT",
    "Notification event is not supported.",
  );
};

const hashRecipient = (value: string) =>
  createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
const previousDelivery = async (outboxId: string, channel: string) =>
  models.NotificationAttempt.findOne({
    where: { outboxId, channel, status: "delivered" },
  });

export const createSmsClient =
  (
    config: { enabled: boolean; url: string; apiKey: string; senderId: string },
    fetchImpl: typeof fetch = fetch,
  ) =>
  async (to: string, body: string) => {
    if (!config.enabled)
      return {
        delivered: false,
        retryable: true,
        errorCode: "external_notifications_disabled",
      };
    if (!config.url || !config.apiKey || !config.senderId)
      return {
        delivered: false,
        retryable: true,
        errorCode: "sms_provider_not_configured",
      };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImpl(config.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to, from: config.senderId, text: body }),
      });
      if (!response.ok)
        return {
          delivered: false,
          retryable: response.status >= 500 || response.status === 429,
          errorCode: `sms_http_${response.status}`,
        };
      const data = (await response.json().catch(() => ({}))) as any;
      return {
        delivered: true,
        providerMessageId:
          typeof data.id === "string" ? data.id.slice(0, 200) : undefined,
      };
    } catch {
      return {
        delivered: false,
        retryable: true,
        errorCode: "sms_provider_unavailable",
      };
    } finally {
      clearTimeout(timeout);
    }
  };
const sendSms = createSmsClient(
  {
    enabled: env.NOTIFICATIONS_ENABLED,
    url: env.SMS_API_URL,
    apiKey: env.SMS_API_KEY,
    senderId: env.SMS_SENDER_ID,
  },
  (input, init) => fetch(input, init),
);

const addAttempt = async (
  outbox: any,
  channel: string,
  recipient: string,
  result: any,
) =>
  models.NotificationAttempt.create({
    outboxId: outbox.id,
    channel,
    recipientHash: hashRecipient(recipient),
    status: result.delivered
      ? "delivered"
      : result.retryable
        ? "failed"
        : "skipped",
    providerMessageId: result.providerMessageId ?? null,
    errorCode: result.errorCode ?? null,
    attemptedAt: new Date(),
  });

interface DeliveryResult {
  delivered: boolean;
  retryable?: boolean;
  errorCode?: string;
  providerMessageId?: string;
}
const deliverChannel = async (
  outbox: any,
  channel: string,
  data: any,
): Promise<DeliveryResult> => {
  const recipient = data.recipient;
  if (channel === "in_app") {
    if (!recipient.staffId)
      return {
        delivered: false,
        retryable: false,
        errorCode: "recipient_unavailable",
      };
    const preference = (await models.NotificationPreference.findOne({
      where: { staffAccountId: recipient.staffId },
    })) as any;
    if (!isNotificationChannelEnabled("in_app", outbox.eventType, preference))
      return {
        delivered: false,
        retryable: false,
        errorCode: "preference_disabled",
      };
    const title = String(data.variables.title ?? "HTT Academy update").slice(
      0,
      200,
    );
    await models.Notification.findOrCreate({
      where: { eventKey: outbox.eventKey },
      defaults: {
        eventKey: outbox.eventKey,
        title,
        body: String(data.variables.body ?? "").slice(0, 4000),
        type: "info",
        category: "announcement",
        link: data.variables.link,
        forStaffId: recipient.staffId,
        metadata: {},
      },
    });
    return { delivered: true };
  }
  const isStaff = Boolean(recipient.staffId);
  const preference = (await models.NotificationPreference.findOne({
    where: isStaff
      ? { staffAccountId: recipient.staffId }
      : recipient.guardianId
        ? { guardianId: recipient.guardianId }
        : { guardianId: null, staffAccountId: null },
  })) as any;
  if (channel === "email") {
    if (!recipient.email)
      return {
        delivered: false,
        retryable: false,
        errorCode: "email_unavailable",
      };
    if (!isNotificationChannelEnabled("email", outbox.eventType, preference))
      return {
        delivered: false,
        retryable: false,
        errorCode: "preference_disabled",
      };
    const rendered = renderNotificationTemplate(
      outbox.eventType,
      data.variables,
    );
    return sendNotificationEmail(
      recipient.email,
      rendered.subject,
      rendered.html,
      rendered.text,
    );
  }
  if (channel === "sms") {
    if (!recipient.phone)
      return {
        delivered: false,
        retryable: false,
        errorCode: "phone_unavailable",
      };
    if (!isNotificationChannelEnabled("sms", outbox.eventType, preference))
      return {
        delivered: false,
        retryable: false,
        errorCode: "sms_consent_missing",
      };
    const destination = normalizePhone(recipient.phone);
    if (destination.length < 7 || destination.length > 15)
      return { delivered: false, retryable: false, errorCode: "phone_invalid" };
    const rendered = renderNotificationTemplate(
      outbox.eventType,
      data.variables,
    );
    return sendSms(
      destination,
      rendered.text.replace(/\s+/g, " ").slice(0, 300),
    );
  }
  return {
    delivered: false,
    retryable: false,
    errorCode: "unsupported_channel",
  };
};

export const retryDelayMs = (attempt: number) =>
  Math.min(60 * 60_000, 1000 * 2 ** Math.min(attempt, 12));
export const isNotificationChannelEnabled = (
  channel: "email" | "sms" | "in_app",
  eventType: string,
  preference: any,
) => {
  const category = eventType.split(".")[0] ?? "other";
  if (preference?.categoryPreferences?.[category] === false) return false;
  if (channel === "email") return preference?.emailEnabled !== false;
  if (channel === "in_app") return preference?.inAppEnabled !== false;
  return Boolean(
    preference?.smsEnabled &&
    preference?.smsConsentAt &&
    !preference?.smsRevokedAt,
  );
};

export const processOutboxBatch = async (limit = 20) => {
  const transaction = await sequelize.transaction();
  let rows: any[];
  try {
    const now = new Date();
    rows = (await models.NotificationOutbox.findAll({
      where: {
        [Op.or]: [
          { status: "pending", availableAt: { [Op.lte]: now } },
          {
            status: "processing",
            lockedAt: { [Op.lte]: new Date(now.getTime() - 5 * 60_000) },
          },
        ],
      },
      order: [["createdAt", "ASC"]],
      limit,
      transaction,
      lock: transaction.LOCK.UPDATE,
      skipLocked: true,
    })) as any[];
    for (const row of rows)
      await row.update(
        {
          status: "processing",
          lockedAt: new Date(),
          attemptCount: row.attemptCount + 1,
        },
        { transaction },
      );
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  for (const outbox of rows) {
    let retryableFailure = false;
    let errorCode: string | null = null;
    try {
      const data = await eventVariables(outbox);
      for (const channel of outbox.channels as string[]) {
        const address =
          channel === "in_app"
            ? String(data.recipient.staffId ?? outbox.id)
            : String(
                channel === "email"
                  ? (data.recipient.email ?? "")
                  : (data.recipient.phone ?? ""),
              );
        const recipientAddress = address || `${outbox.eventKey}:${channel}`;
        if (await previousDelivery(outbox.id, channel)) continue;
        const result = await deliverChannel(outbox, channel, data);
        await addAttempt(outbox, channel, recipientAddress, result);
        if (!result.delivered && result.retryable) {
          retryableFailure = true;
          errorCode = result.errorCode ?? "provider_error";
        }
      }
    } catch (error) {
      retryableFailure = true;
      errorCode =
        error instanceof AppError
          ? error.code
          : "notification_processing_error";
    }
    const attempts = Number(outbox.attemptCount);
    await outbox.update({
      status:
        retryableFailure && attempts < 5
          ? "pending"
          : retryableFailure
            ? "failed"
            : "delivered",
      availableAt: retryableFailure
        ? new Date(Date.now() + retryDelayMs(attempts))
        : outbox.availableAt,
      lockedAt: null,
      processedAt: retryableFailure && attempts < 5 ? null : new Date(),
      lastErrorCode: errorCode,
    });
  }
  return rows.length;
};

export const getMyNotifications = async (staffId: string, query: any) => {
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
  const result = await models.Notification.findAndCountAll({
    where: { forStaffId: staffId },
    order: [["createdAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
  });
  return { items: result.rows, page, limit, total: result.count };
};
export const getUnreadCount = async (staffId: string) =>
  models.Notification.count({ where: { forStaffId: staffId, read: false } });
export const getMyNotification = async (staffId: string, id: string) => {
  const notification = (await models.Notification.findOne({
    where: { id, forStaffId: staffId },
  })) as any;
  if (!notification)
    throw new AppError(
      404,
      "NOTIFICATION_NOT_FOUND",
      "Notification was not found.",
    );
  return notification;
};
export const markRead = async (staffId: string, id: string) => {
  const notification = (await models.Notification.findOne({
    where: { id, forStaffId: staffId },
  })) as any;
  if (!notification)
    throw new AppError(
      404,
      "NOTIFICATION_NOT_FOUND",
      "Notification was not found.",
    );
  if (!notification.read) await notification.update({ read: true });
  return notification;
};
export const markAllRead = async (staffId: string) =>
  models.Notification.update(
    { read: true },
    { where: { forStaffId: staffId, read: false } },
  ).then(([count]) => count);

export const getStaffPreferences = async (staffId: string) => {
  const [preferences] = (await models.NotificationPreference.findOrCreate({
    where: { staffAccountId: staffId },
    defaults: { staffAccountId: staffId },
  })) as any;
  return preferences;
};
export const updateStaffPreferences = async (staffId: string, input: any) => {
  const preferences = await getStaffPreferences(staffId);
  const updates = { ...input };
  if (input.smsEnabled === true) {
    updates.smsConsentAt = new Date();
    updates.smsRevokedAt = null;
    updates.consentSource = "staff_self_service";
  }
  if (input.smsEnabled === false) {
    updates.smsRevokedAt = new Date();
    updates.consentSource = "staff_self_service";
  }
  await preferences.update(updates);
  return preferences;
};

export const recordGuardianSmsConsent = async (
  guardianId: string,
  granted: boolean,
  source: string,
  actorId: string,
  ipAddress?: string,
) => {
  const transaction = await sequelize.transaction();
  try {
    const guardian = await models.Guardian.unscoped().findByPk(guardianId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!guardian)
      throw new AppError(404, "GUARDIAN_NOT_FOUND", "Guardian was not found.");
    const [preference] = (await models.NotificationPreference.findOrCreate({
      where: { guardianId },
      defaults: { guardianId },
      transaction,
    })) as any;
    await preference.update(
      {
        smsEnabled: granted,
        smsConsentAt: granted ? new Date() : preference.smsConsentAt,
        smsRevokedAt: granted ? null : new Date(),
        consentSource: source,
      },
      { transaction },
    );
    await writeAudit({
      actorId,
      action: granted
        ? "notification.guardian_sms_consent_granted"
        : "notification.guardian_sms_consent_revoked",
      entityName: "Guardian",
      recordId: guardianId,
      transaction,
      ipAddress,
    });
    await transaction.commit();
    return {
      guardianId,
      smsEnabled: granted,
      smsConsentAt: preference.smsConsentAt,
      smsRevokedAt: preference.smsRevokedAt,
      consentSource: preference.consentSource,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const listTemplates = () => notificationTemplateCatalog();

export const listDeliveryAttempts = async (query: any) => {
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
  if (query.channel) where.channel = query.channel;
  if (query.status) where.status = query.status;
  const outboxWhere: any = {};
  if (query.eventType) outboxWhere.eventType = query.eventType;
  if (query.from || query.to)
    outboxWhere.createdAt = {
      ...(query.from ? { [Op.gte]: new Date(`${query.from}T00:00:00Z`) } : {}),
      ...(query.to ? { [Op.lte]: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    };
  const result = await models.NotificationAttempt.findAndCountAll({
    where,
    include: [
      {
        model: models.NotificationOutbox,
        as: "outbox",
        where: outboxWhere,
        attributes: [
          "eventKey",
          "eventType",
          "aggregateType",
          "aggregateId",
          "status",
          "attemptCount",
          "lastErrorCode",
          "createdAt",
        ],
      },
    ],
    order: [["attemptedAt", "DESC"]],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  return { items: result.rows, page, limit, total: result.count };
};

export const retryNotification = async (
  id: string,
  actorId: string,
  ipAddress?: string,
) => {
  const transaction = await sequelize.transaction();
  try {
    const outbox = (await models.NotificationOutbox.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!outbox || outbox.status !== "failed")
      throw new AppError(
        409,
        "NOTIFICATION_NOT_RETRYABLE",
        "Only exhausted failed notifications may be retried.",
      );
    await outbox.update(
      {
        status: "pending",
        attemptCount: 0,
        lastErrorCode: null,
        lockedAt: null,
        processedAt: null,
        availableAt: new Date(),
      },
      { transaction },
    );
    await writeAudit({
      actorId,
      action: "notification.retry_requested",
      entityName: "NotificationOutbox",
      recordId: id,
      transaction,
      ipAddress,
    });
    await transaction.commit();
    return { id, status: "pending" };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export const createStaffAnnouncement = async (
  input: any,
  actorId: string,
  ipAddress?: string,
) => {
  const recipients = (await models.StaffAccount.findAll({
    where: { active: true, suspendedAt: null },
    attributes: ["id"],
    ...(input.roleKeys?.length
      ? {
          include: [
            {
              model: models.Role,
              as: "roles",
              where: { key: { [Op.in]: input.roleKeys } },
              attributes: [],
              through: { attributes: [] },
              required: true,
            },
          ],
        }
      : {}),
  })) as any[];
  if (!recipients.length)
    throw new AppError(
      400,
      "EMPTY_AUDIENCE",
      "No active staff match this audience.",
    );
  if (recipients.length > 500)
    throw new AppError(
      400,
      "AUDIENCE_TOO_LARGE",
      "Announcement audience exceeds 500 staff.",
    );
  const transaction = await sequelize.transaction();
  try {
    const events = recipients.map((staff) => ({
      eventKey: `announcement:${input.idempotencyKey}:${staff.id}`.slice(
        0,
        180,
      ),
      eventType: "announcement",
      aggregateType: "staff_account",
      aggregateId: staff.id,
      recipientStaffId: staff.id,
      payload: {
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      },
      channels: ["in_app"],
      status: "pending",
      availableAt: new Date(),
    }));
    await models.NotificationOutbox.bulkCreate(events, {
      transaction,
      ignoreDuplicates: true,
    });
    await writeAudit({
      actorId,
      action: "notification.announcement_created",
      entityName: "NotificationOutbox",
      recordId: input.idempotencyKey,
      transaction,
      ipAddress,
    });
    await transaction.commit();
    return { queued: recipients.length };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
