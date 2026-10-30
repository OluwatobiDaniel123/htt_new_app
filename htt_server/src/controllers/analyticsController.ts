/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { Op, fn, col } from "sequelize";
import { models } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getFinanceSummary } from "../services/paymentService.js";

export const dashboardSummary: RequestHandler = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [registeredPlayers, pendingRegistrations, openCentres, pendingCentres, upcomingAssessments, activeScholarships, pendingScholarships, openEnquiries, overdueTasks, recentRegistrations, players, scholarshipGroups, paymentGroups, nextAssessments, dueTasks, activityRows, fundingRows, settings, finance] = await Promise.all([
    models.Player.count({ where: { registrationStatus: "registered", archived: false } }),
    models.Registration.count({ where: { status: { [Op.in]: ["submitted", "under_review"] } } }),
    models.Centre.count({ where: { status: { [Op.in]: ["open_for_registration", "assessments_open"] } } }),
    models.Centre.count({ where: { status: "pending_verification" } }),
    models.Assessment.count({ where: { status: "scheduled", scheduledAt: { [Op.gte]: now } } }),
    models.ScholarshipAward.count({ where: { status: "active" } }),
    models.ScholarshipApplication.count({ where: { status: { [Op.in]: ["received", "eligibility_review", "selection_panel", "assessed"] } } }),
    models.Enquiry.count({ where: { status: { [Op.in]: ["new", "contacted", "in_progress"] } } }),
    models.FollowUpTask.count({ where: { status: { [Op.in]: ["open", "in_progress"] }, dueDate: { [Op.lt]: today } } }),
    models.Registration.findAll({ limit: 200, order: [["createdAt", "DESC"]], attributes: ["id", "reference", "status", "createdAt"] }),
    models.Player.findAll({ where: { archived: false }, attributes: ["id", "centreId"], include: [{ model: models.Centre, as: "centre", attributes: ["name"] }] }),
    models.ScholarshipApplication.findAll({ attributes: ["status", [fn("COUNT", col("id")), "count"]], group: ["status"], raw: true }) as any,
    models.Payment.findAll({ attributes: ["status", [fn("SUM", col("amount")), "sumAmount"]], group: ["status"], raw: true }) as any,
    models.Assessment.findAll({ where: { status: "scheduled", scheduledAt: { [Op.gte]: now } }, limit: 4, order: [["scheduledAt", "ASC"]], include: [{ model: models.Player.scope("withPersonalData"), as: "player", attributes: ["fullName"] }, { model: models.Centre, as: "centre", attributes: ["name"] }] }),
    models.FollowUpTask.findAll({ where: { status: { [Op.in]: ["open", "in_progress"] } }, limit: 4, order: [["dueDate", "ASC"]] }),
    req.auth?.permissions.audit ? models.AuditLog.unscoped().findAll({ limit: 6, order: [["createdAt", "DESC"]], attributes: ["id", "actorName", "actorEmail", "action", "entityName", "recordLabel", "createdAt"] }) : Promise.resolve([]),
    models.FundingRecord.findAll({ attributes: ["kind", [fn("SUM", col("amount")), "totalAmount"]], where: { status: { [Op.in]: ["pledged", "confirmed", "received"] } }, group: ["kind"], raw: true }) as any,
    models.ApplicationSettings.findOne() as any,
    req.auth?.permissions["payments.read"] ? getFinanceSummary({}) : Promise.resolve(null),
  ]);
  const centreCounts = new Map<string, number>();
  for (const player of players as any[]) {
    const name = player.centre?.name;
    if (name) centreCounts.set(name, (centreCounts.get(name) || 0) + 1);
  }
  const funds = new Map((fundingRows as any[]).map((row) => [row.kind, Number(row.totalAmount || 0)]));
  const financeRows = (paymentGroups as any[]).map((row) => ({ status: row.status, sumAmount: Number(row.sumAmount || 0) }));
  const financeData: any = finance || {};
  const data = {
    metrics: {
      registeredPlayers, pendingRegistrations, openCentres, pendingCentres, upcomingAssessments, activeScholarships, pendingScholarships,
      paymentsReceived: financeData.successfulGross || 0,
      outstandingBalances: financeData.outstanding || 0,
      fundingReceived: funds.get("payment") || 0,
      fundingRequired: Math.max((funds.get("pledge") || 0) - (funds.get("payment") || 0), 0),
      openEnquiries, overdueTasks, scholarshipTarget: settings?.scholarshipTarget || 20,
    },
    recentRegistrations,
    playersByCentre: [...centreCounts].map(([centreName, count]) => ({ centreName, count })),
    pipeline: scholarshipGroups,
    paymentsByStatus: financeRows,
    assessments: nextAssessments,
    tasks: dueTasks,
    activity: activityRows,
  };
  res.json({ success: true, data });
});

export const academyReport: RequestHandler = asyncHandler(async (_req, res) => {
  const [playersByCentre, registrationsByStatus, players, registrations, centres, completedAssessments, noCentre, pendingRegistrations, pendingCentres, pendingDocs] = await Promise.all([
    models.Player.findAll({ where: { archived: false }, attributes: ["centreId", [fn("COUNT", col("Player.id")), "count"]], include: [{ model: models.Centre, as: "centre", attributes: ["name"] }], group: ["centreId", "centre.id", "centre.name"] }),
    models.Registration.findAll({ attributes: ["status", [fn("COUNT", col("id")), "count"]], group: ["status"], raw: true }),
    models.Player.count({ where: { archived: false } }),
    models.Registration.count(),
    models.Centre.count(),
    models.Assessment.count({ where: { status: "completed" } }),
    models.Player.count({ where: { archived: false, centreId: null } }),
    models.Registration.count({ where: { status: { [Op.in]: ["submitted", "under_review"] } } }),
    models.Centre.count({ where: { status: "pending_verification" } }),
    models.RegistrationDocument.count({ where: { status: "pending" } }),
  ]);
  res.json({ success: true, data: { playersByCentre, registrationsByStatus, counts: { players, registrations, centres, completedAssessments }, checks: { noCentre, pendingRegistrations, pendingCentres, pendingDocs } } });
});
