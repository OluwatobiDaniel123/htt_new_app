/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as service from "../services/registrationService.js";
import { models } from "../models/index.js";
import { Op } from "sequelize";

const authOf = (req: Parameters<RequestHandler>[0]) => {
  if (!req.auth)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return req.auth;
};
const viewAccess = (req: Parameters<RequestHandler>[0]) => {
  const auth = authOf(req);
  return {
    playerData: auth.permissions["players.read_sensitive"] === "full",
    guardianData: auth.permissions["guardians.read_contact"] === "full",
    internal: auth.permissions["registrations.update"] === "full",
  };
};
export const listRegistrations: RequestHandler = asyncHandler(
  async (req, res) =>
    res.json({
      success: true,
      data: await service.listRegistrations(
        req.validatedQuery ?? {},
        viewAccess(req),
      ),
    }),
);
export const getRegistration: RequestHandler = asyncHandler(async (req, res) =>
  res.json({
    success: true,
    data: await service.getRegistration(
      req.params.id as string,
      viewAccess(req),
    ),
  }),
);
// export const getRegistrationProfileImage: RequestHandler = asyncHandler(async (req, res) => {
//   res.redirect(302, await service.getRegistrationProfileImageUrl(req.params.id as string));
// });

export const getRegistrationProfileImage: RequestHandler = asyncHandler(
  async (req, res) => {
    const imageUrl = await service.getRegistrationProfileImageUrl(
      req.params.id as string,
    );

    res.status(200).json({
      success: true,
      data: {
        url: imageUrl,
      },
    });
  },
);
export const registrationBalance: RequestHandler = asyncHandler(
  async (req, res) => {
    const registration = (await models.Registration.findByPk(
      req.params.id as string,
    )) as any;
    if (!registration)
      throw new AppError(404, "NOT_FOUND", "Registration was not found.");
    const payments = (await models.Payment.findAll({
      where: { registrationId: registration.id },
      attributes: [
        "id",
        "reference",
        "amount",
        "currency",
        "method",
        "purpose",
        "status",
        "paidAt",
        "refundAmount",
        "receiptNumber",
      ],
      order: [["createdAt", "ASC"]],
    })) as any[];
    const qualifying = payments.filter((payment) =>
      ["successful", "partially_refunded", "refunded"].includes(payment.status),
    );
    const paid = qualifying.reduce(
      (sum, payment) =>
        sum +
        Math.max(
          0,
          Number(payment.amount || 0) - Number(payment.refundAmount || 0),
        ),
      0,
    );
    res.json({
      success: true,
      data: {
        registrationId: registration.id,
        amountDue: registration.amountDue,
        amountPaid: paid,
        outstanding: Math.max(0, Number(registration.amountDue || 0) - paid),
        currency: payments[0]?.currency || "NGN",
        payments,
      },
    });
  },
);
export const listRegistrationBalances: RequestHandler = asyncHandler(
  async (req, res) => {
    const query = req.validatedQuery || {};
    const page = Number(query.page || 1);
    const limit = Math.min(Number(query.limit || 50), 100);
    const found = (await models.Registration.findAndCountAll({
      attributes: [
        "id",
        "reference",
        "childName",
        "amountDue",
        "status",
        "paymentStatus",
        "createdAt",
      ],
      include: [
        { model: models.Centre, as: "centre", attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    })) as any;
    const registrationIds = found.rows.map((row: any) => row.id);
    const payments = registrationIds.length
      ? ((await models.Payment.findAll({
          where: {
            registrationId: { [Op.in]: registrationIds },
            status: {
              [Op.in]: ["successful", "partially_refunded", "refunded"],
            },
          },
          attributes: [
            "id",
            "registrationId",
            "reference",
            "amount",
            "currency",
            "status",
            "refundAmount",
            "paidAt",
          ],
        })) as any[])
      : [];
    const canReadNames =
      req.auth?.permissions["players.read_sensitive"] === "full";
    const rows = found.rows.map((registration: any) => {
      const related = payments.filter(
        (payment) => payment.registrationId === registration.id,
      );
      const amountPaid = related.reduce(
        (sum, payment) =>
          sum +
          Math.max(
            0,
            Number(payment.amount || 0) - Number(payment.refundAmount || 0),
          ),
        0,
      );
      const amountDue = Number(registration.amountDue || 0);
      return {
        id: registration.id,
        reference: registration.reference,
        ...(canReadNames ? { childName: registration.childName } : {}),
        centreName: registration.centre?.name || null,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        amountDue,
        amountPaid,
        outstanding: Math.max(0, amountDue - amountPaid),
        currency: related[0]?.currency || "NGN",
        payments: related,
      };
    });
    res.json({
      success: true,
      data: { items: rows, total: found.count, page, limit },
    });
  },
);
export const createRegistration: RequestHandler = asyncHandler(
  async (req, res) => {
    const auth = authOf(req);
    const created = await service.createRegistration(
      req.body,
      auth.staffId,
      req.ip,
    );
    res.status(201).json({
      success: true,
      data: await service.getRegistration(created.id, viewAccess(req)),
    });
  },
);
export const updateRegistration: RequestHandler = asyncHandler(
  async (req, res) => {
    const auth = authOf(req);
    await service.updateRegistration(
      req.params.id as string,
      req.body,
      auth.staffId,
      req.ip,
    );
    res.json({
      success: true,
      data: await service.getRegistration(
        req.params.id as string,
        viewAccess(req),
      ),
    });
  },
);
export const updateDocuments: RequestHandler = asyncHandler(
  async (req, res) => {
    const auth = authOf(req);
    await service.updateRegistrationDocuments(
      req.params.id as string,
      req.body.documents,
      auth.staffId,
      req.ip,
    );
    res.json({
      success: true,
      data: await service.getRegistration(
        req.params.id as string,
        viewAccess(req),
      ),
    });
  },
);
export const approveRegistration: RequestHandler = asyncHandler(
  async (req, res) => {
    const auth = authOf(req);
    res.json({
      success: true,
      data: await service.approveRegistration(
        req.params.id as string,
        req.body,
        auth.staffId,
        req.ip,
      ),
    });
  },
);
const decide = (status: string): RequestHandler =>
  asyncHandler(async (req, res) => {
    const auth = authOf(req);
    await service.transitionRegistration(
      req.params.id as string,
      status,
      req.body.note,
      auth.staffId,
      req.ip,
    );
    res.json({
      success: true,
      data: await service.getRegistration(
        req.params.id as string,
        viewAccess(req),
      ),
    });
  });
export const rejectRegistration = decide("rejected");
export const requestChanges = decide("information_required");
export const startReview = decide("under_review");
export const requireAssessment = decide("assessment_required");
