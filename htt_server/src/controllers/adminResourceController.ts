/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { Op, fn, col } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import type { Transaction } from "sequelize";
import { writeAudit } from "../services/auditService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { adminResourceDefinitions } from "../validation/adminResourceSchemas.js";
import { env } from "../config/env.js";

const includes: Record<string, any[]> = {
  AttendanceSession: [{ model: models.Centre, as: "centre", attributes: ["id", "name"] }, { model: models.Programme, as: "programme", attributes: ["id", "name"] }, { model: models.StaffAccount, as: "coach", attributes: ["id", "fullName", "email"] }],
  Assessment: [{ model: models.Player.scope("withPersonalData"), as: "player", attributes: ["id", "fullName", "playerCode"] }, { model: models.Centre, as: "centre", attributes: ["id", "name"] }, { model: models.StaffAccount, as: "coach", attributes: ["id", "fullName", "email"] }],
  ScholarshipApplication: [{ model: models.Player.scope("withPersonalData"), as: "player", attributes: ["id", "fullName", "playerCode"] }, { model: models.Centre, as: "centre", attributes: ["id", "name"] }, { model: models.Programme, as: "programme", attributes: ["id", "name"] }],
  ScholarshipAward: [{ model: models.Player.scope("withPersonalData"), as: "player", attributes: ["id", "fullName", "playerCode"] }, { model: models.Programme, as: "programme", attributes: ["id", "name"] }, { model: models.Centre, as: "centre", attributes: ["id", "name"] }],
  FundingRecord: [{ model: models.Sponsor, as: "sponsor", attributes: ["id", "name"] }],
  Team: [{ model: models.Season, as: "season", attributes: ["id", "name"] }, { model: models.Centre, as: "centre", attributes: ["id", "name"] }, { model: models.StaffAccount, as: "coach", attributes: ["id", "fullName"] }, { model: models.Player, as: "players", attributes: ["id"], through: { attributes: [] } }],
  Fixture: [{ model: models.Season, as: "season", attributes: ["id", "name"] }, { model: models.Team, as: "homeTeam", attributes: ["id", "name"] }, { model: models.Team, as: "awayTeam", attributes: ["id", "name"] }],
  Enquiry: [{ model: models.StaffAccount, as: "assignee", attributes: ["id", "fullName", "email"] }],
  FollowUpTask: [{ model: models.Enquiry, as: "enquiry", attributes: ["id", "contactName", "subject"] }, { model: models.StaffAccount, as: "assignee", attributes: ["id", "fullName", "email"] }],
  SponsorshipEnquiry: [{ model: models.StaffAccount, as: "assignee", attributes: ["id", "fullName", "email"] }],
  Story: [{ model: models.Centre, as: "centre", attributes: ["id", "name"] }, { model: models.StaffAccount, as: "author", attributes: ["id", "fullName"] }, { model: models.MediaAsset, as: "media", attributes: ["id", "originalName", "resourceType", "access", "mimeType", "byteSize"], through: { attributes: ["sortOrder", "caption"] } }],
  ConsentRecord: [{ model: models.Player.scope("withPersonalData"), as: "player", attributes: ["id", "fullName", "playerCode"] }, { model: models.Guardian.scope("withContactData"), as: "guardian", attributes: ["id", "fullName"] }],
};

const camel = (key: string) => key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

const definitionFor = (name: keyof typeof adminResourceDefinitions) => adminResourceDefinitions[name];
const modelFor = (name: keyof typeof adminResourceDefinitions) => (models as any)[name];
const serialize = (name: keyof typeof adminResourceDefinitions, value: any) => {
  if (!value) return value;
  const plain = typeof value.get === "function" ? value.get({ plain: true }) : value;
  return name === "ApplicationSettings" ? { ...plain, paystackConfigured: Boolean(env.PAYSTACK_SECRET_KEY) } : plain;
};

const resolveStaffEmail = async (email: unknown) => {
  if (email === undefined) return undefined;
  if (email === null || email === "") return null;
  const staff = await models.StaffAccount.findOne({ where: { email: String(email).trim().toLowerCase(), active: true }, attributes: ["id"] }) as any;
  if (!staff) throw new AppError(400, "VALIDATION_ERROR", "The selected staff email does not match an active staff account.");
  return staff.id;
};

const resolveStaffFields = async (name: keyof typeof adminResourceDefinitions, body: Record<string, any>) => {
  const emailField = name === "Enquiry" || name === "FollowUpTask" ? "assignedEmail" : "coachEmail";
  const idField = name === "Enquiry" || name === "FollowUpTask" ? "assignedToId" : "coachId";
  if (["Enquiry", "FollowUpTask", "Team", "Assessment"].includes(name) && emailField in body) {
    body[idField] = await resolveStaffEmail(body[emailField]);
    delete body[emailField];
  }
};
const paramId = (req: any): string => {
  const value: unknown = req.params.id;
  return typeof value === "string" ? value : Array.isArray(value) && typeof value[0] === "string" ? value[0] : "";
};

const audit = (req: any, action: string, entity: string, id: string, transaction?: Transaction) => writeAudit({
  actorId: req.auth?.staffId,
  action,
  entityName: entity,
  recordId: id,
  ipAddress: req.ip,
  userAgent: req.get("user-agent"),
  transaction,
});

export const saveAttendanceMarks: RequestHandler = asyncHandler(async (req, res) => {
  const session = await models.AttendanceSession.findByPk(paramId(req)) as any;
  if (!session) throw new AppError(404, "NOT_FOUND", "Attendance session was not found.");
  if (session.status === "cancelled") throw new AppError(409, "INVALID_STATE", "Attendance cannot be marked for a cancelled session.");
  const records = req.body.records as Array<{ playerId: string; status: string; notes?: string | null }>;
  await sequelize.transaction(async (transaction) => {
    const playerIds = [...new Set(records.map((row) => row.playerId))];
    const players = await models.Player.findAll({ where: { id: { [Op.in]: playerIds }, archived: false, centreId: session.centreId }, transaction });
    if (players.length !== playerIds.length) throw new AppError(400, "VALIDATION_ERROR", "Every player must be active and registered at the session centre.");
    for (const item of records) {
      const [record, created] = await models.AttendanceRecord.findOrCreate({
        where: { sessionId: session.id, playerId: item.playerId },
        defaults: { sessionId: session.id, playerId: item.playerId, status: item.status, notes: item.notes || null },
        transaction,
      });
      if (!created) await record.update({ status: item.status, notes: item.notes || null }, { transaction });
    }
    const present = records.filter((item) => item.status === "present" || item.status === "late").length;
    const absent = records.filter((item) => item.status === "absent").length;
    await session.update({ presentCount: present, absentCount: absent, status: "completed" }, { transaction });
    await audit(req, "attendance.marked", "AttendanceSession", session.id, transaction);
  });
  const updated = await models.AttendanceSession.findByPk(session.id, { include: includes.AttendanceSession });
  res.json({ success: true, data: updated });
});

export const listAttendanceMarks: RequestHandler = asyncHandler(async (req, res) => {
  const session = await models.AttendanceSession.findByPk(paramId(req)) as any;
  if (!session) throw new AppError(404, "NOT_FOUND", "Attendance session was not found.");
  const records = await models.AttendanceRecord.findAll({ where: { sessionId: session.id }, include: [{ model: models.Player.scope("withPersonalData"), as: "player", attributes: ["id", "fullName", "playerCode"] }], order: [["createdAt", "ASC"]] });
  res.json({ success: true, data: { items: records } });
});

export const listPlayerAttendance: RequestHandler = asyncHandler(async (req, res) => {
  const playerId = paramId(req);
  const player = await models.Player.findByPk(playerId, { attributes: ["id"] });
  if (!player) throw new AppError(404, "NOT_FOUND", "Player was not found.");
  const query = req.validatedQuery || {};
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 50);
  const found = await models.AttendanceRecord.findAndCountAll({
    where: { playerId },
    include: [{ model: models.AttendanceSession, as: "session", attributes: ["id", "sessionDate", "centreId", "programmeId", "status"] }],
    order: [[{ model: models.AttendanceSession, as: "session" }, "sessionDate", "DESC"]],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  res.json({ success: true, data: { items: found.rows, total: found.count, page, limit } });
});

export const listPlayerGuardians: RequestHandler = asyncHandler(async (req, res) => {
  const playerId = paramId(req);
  const player = await models.Player.findByPk(playerId, { attributes: ["id"] });
  if (!player) throw new AppError(404, "NOT_FOUND", "Player was not found.");
  const includeContact = req.auth?.permissions["guardians.read_contact"] === "full";
  const query = req.validatedQuery || {};
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 50);
  const found = await models.PlayerGuardian.findAndCountAll({
    where: { playerId },
    include: [{ model: models.Guardian.scope("withContactData"), as: "guardian", attributes: includeContact ? ["id", "fullName", "email", "phone"] : ["id"] }],
    order: [[{ model: models.Guardian, as: "guardian" }, "fullName", "ASC"]],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  res.json({ success: true, data: { items: found.rows, total: found.count, page, limit } });
});

export const fundingSummary: RequestHandler = asyncHandler(async (_req, res) => {
  const rows = await models.FundingRecord.findAll({
    attributes: ["category", "kind", "currency", [fn("SUM", col("amount")), "totalAmount"]],
    where: { status: { [Op.in]: ["pledged", "confirmed", "received"] } },
    group: ["category", "kind", "currency"],
    raw: true,
  }) as any[];
  res.json({ success: true, data: rows });
});

export const approveScholarship: RequestHandler = asyncHandler(async (req, res) => {
  const result = await sequelize.transaction(async (transaction) => {
    const application = await models.ScholarshipApplication.findByPk(paramId(req), { transaction, lock: transaction.LOCK.UPDATE }) as any;
    if (!application) throw new AppError(404, "NOT_FOUND", "Scholarship application was not found.");
    if (application.status === "approved") throw new AppError(409, "ALREADY_APPROVED", "This application already has an award.");
    const playerId = req.body.playerId as string;
    const player = await models.Player.scope("withPersonalData").findByPk(playerId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!player) throw new AppError(404, "NOT_FOUND", "The selected player was not found.");
    const award = await models.ScholarshipAward.create({
      applicationId: application.id,
      playerId,
      programmeId: application.programmeId,
      centreId: application.centreId,
      awardAmount: application.awardAmount ?? 0,
      benefitDescription: req.body.benefitDescription || "Scholarship award",
      fundingSecured: application.fundingSecured ?? 0,
      fundingRequired: application.fundingRequired ?? 0,
      startDate: application.startDate,
      endDate: application.endDate,
      renewalDate: application.renewalDate,
      status: "active",
    }, { transaction }) as any;
    await application.update({ status: "approved" }, { transaction });
    await player.update({ scholarshipStatus: "active" }, { transaction });
    await models.ScholarshipDecision.create({ applicationId: application.id, reviewerId: req.auth?.staffId, status: "approved", note: `Award ${award.id} activated.` }, { transaction });
    await audit(req, "scholarship.approved", "ScholarshipApplication", application.id, transaction);
    return { application, award };
  });
  res.json({ success: true, data: result });
});

export const listAdminResource = (name: keyof typeof adminResourceDefinitions): RequestHandler => asyncHandler(async (req, res) => {
  const definition = definitionFor(name);
  const query = req.validatedQuery || {};
  const allowedFilters = definition.filters as readonly string[];
  const where: Record<PropertyKey, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (["page", "limit", "search", "sort"].includes(key)) continue;
    const attribute = camel(key);
    if (!allowedFilters.includes(attribute)) throw new AppError(400, "VALIDATION_ERROR", `Unsupported ${name} filter: ${key}.`);
    where[attribute] = value;
  }
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search && definition.search.length) {
    (where as any)[Op.or] = (definition.search as readonly string[]).map((field) => ({ [field]: { [Op.iLike]: `%${search}%` } }));
  }
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 50);
  const requestedSort = typeof query.sort === "string" ? query.sort : "-created_at";
  const sortKey = camel(requestedSort.replace(/^-/, ""));
  const sortFields = new Set(["createdAt", "updatedAt", ...definition.search, ...(definition.filters as readonly string[]), ...Object.keys(definition.fields)]);
  if (!sortFields.has(sortKey)) throw new AppError(400, "VALIDATION_ERROR", "Unsupported sort field.");
  const [sortDirection] = requestedSort.startsWith("-") ? ["DESC"] : ["ASC"];
  const options: any = {
    where,
    limit,
    offset: (page - 1) * limit,
    order: [[sortKey, sortDirection]],
    include: includes[name] || [],
    distinct: true,
  };
  const model = modelFor(name);
  let result;
  if ("singleton" in definition && definition.singleton) {
    const item = await model.findOne(options);
    result = { items: item ? [serialize(name, item)] : [], total: item ? 1 : 0, page: 1, limit: 1 };
  } else {
    const found = await model.findAndCountAll(options);
    result = { items: found.rows.map((row: any) => serialize(name, row)), total: found.count, page, limit };
  }
  res.json({ success: true, data: result });
});

export const getAdminResource = (name: keyof typeof adminResourceDefinitions): RequestHandler => asyncHandler(async (req, res) => {
  const record = await modelFor(name).findByPk(paramId(req), { include: includes[name] || [] });
  if (!record) throw new AppError(404, "NOT_FOUND", `${name} was not found.`);
  res.json({ success: true, data: serialize(name, record) });
});

export const createAdminResource = (name: keyof typeof adminResourceDefinitions): RequestHandler => asyncHandler(async (req, res) => {
  const definition = definitionFor(name);
  const body = { ...req.body };
  await resolveStaffFields(name, body);
  if (name === "AttendanceSession") {
    body.coachId ??= req.auth?.staffId;
  }
  if (name === "Enquiry") {
    if (body.optedOut) body.consentToContact = false;
  }
  if (name === "FollowUpTask" && body.status === "done") body.completedAt ??= new Date();
  if (name === "Story") body.authorId = req.auth?.staffId;
  if (name === "Story" && body.status === "published" && body.involvesChildren !== false && body.safeguardingApproved !== true) {
    throw new AppError(409, "SAFEGUARDING_APPROVAL_REQUIRED", "Content involving children requires safeguarding approval before publication.");
  }
  if (name === "Story" && body.safeguardingApproved === true && req.auth?.permissions["safeguarding.manage"] !== "full") throw new AppError(403, "FORBIDDEN", "Safeguarding approval requires safeguarding manager permission.");
  const playerIds: string[] | undefined = name === "Team" && Array.isArray(body.playerIds) ? body.playerIds as string[] : undefined;
  if (name === "Team") delete body.playerIds;
  if (name === "Fixture" && body.homeTeamId === body.awayTeamId) throw new AppError(400, "VALIDATION_ERROR", "A team cannot play itself.");
  if ("singleton" in definition && definition.singleton) {
    const existing = await modelFor(name).findOne();
    if (existing) throw new AppError(409, "ALREADY_EXISTS", "Application settings already exist; update the existing record.");
  }
  const record = await modelFor(name).create(body);
  if (name === "Team" && playerIds) await models.TeamPlayer.bulkCreate([...new Set(playerIds)].map((playerId: string) => ({ teamId: record.id, playerId })));
  await audit(req, `${snake(name)}.created`, name, record.id);
  res.status(201).json({ success: true, data: record });
});

export const updateAdminResource = (name: keyof typeof adminResourceDefinitions): RequestHandler => asyncHandler(async (req, res) => {
  const record = await modelFor(name).findByPk(paramId(req));
  if (!record) throw new AppError(404, "NOT_FOUND", `${name} was not found.`);
  const body = { ...req.body };
  await resolveStaffFields(name, body);
  const playerIds: string[] | undefined = name === "Team" && Array.isArray(body.playerIds) ? body.playerIds as string[] : undefined;
  if (name === "Team") delete body.playerIds;
  if (name === "Fixture" && body.homeTeamId && body.awayTeamId && body.homeTeamId === body.awayTeamId) throw new AppError(400, "VALIDATION_ERROR", "A team cannot play itself.");
  if (name === "Story" && body.status === "published" && (body.involvesChildren ?? record.involvesChildren) && !(body.safeguardingApproved ?? record.safeguardingApproved)) {
    throw new AppError(409, "SAFEGUARDING_APPROVAL_REQUIRED", "Content involving children requires safeguarding approval before publication.");
  }
  if (name === "Story" && body.safeguardingApproved === true && req.auth?.permissions["safeguarding.manage"] !== "full") throw new AppError(403, "FORBIDDEN", "Safeguarding approval requires safeguarding manager permission.");
  if (name === "Enquiry" && body.optedOut === true) body.consentToContact = false;
  if (name === "FollowUpTask" && body.status === "done") body.completedAt ??= new Date();
  if (name === "FollowUpTask" && body.status && body.status !== "done") body.completedAt = null;
  await record.update(body);
  if (name === "Story" && (body.status !== undefined || body.safeguardingApproved !== undefined)) {
    await models.StoryApproval.create({ storyId: record.id, reviewerId: req.auth?.staffId, decision: body.safeguardingApproved === true ? "safeguarding_approved" : String(body.status || "updated"), note: null });
  }
  if (name === "Team" && playerIds) {
    await models.TeamPlayer.destroy({ where: { teamId: record.id } });
    await models.TeamPlayer.bulkCreate([...new Set(playerIds)].map((playerId: string) => ({ teamId: record.id, playerId })));
  }
  await audit(req, `${snake(name)}.updated`, name, record.id);
  const updated = await modelFor(name).findByPk(record.id, { include: includes[name] || [] });
  res.json({ success: true, data: serialize(name, updated) });
});

export const deleteAdminResource = (name: keyof typeof adminResourceDefinitions): RequestHandler => asyncHandler(async (req, res) => {
  const record = await modelFor(name).findByPk(paramId(req));
  if (!record) throw new AppError(404, "NOT_FOUND", `${name} was not found.`);
  await record.destroy();
  const deletedId = paramId(req);
  await audit(req, `${snake(name)}.deleted`, name, deletedId);
  res.json({ success: true, data: { id: deletedId } });
});
