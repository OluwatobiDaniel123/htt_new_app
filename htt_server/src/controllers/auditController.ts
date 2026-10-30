/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RequestHandler } from "express";
import { Op } from "sequelize";
import { models } from "../models/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listAuditLogs: RequestHandler = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};
  const page = Number(query.page || 1);
  const limit = Math.min(Number(query.limit || 50), 100);
  const where: Record<PropertyKey, unknown> = {};
  if (query.action) where.action = query.action;
  if (query.entityName || query.entity_name) where.entityName = query.entityName || query.entity_name;
  if (query.search) (where as any)[Op.or] = ["actorName", "actorEmail", "recordLabel"].map((field) => ({ [field]: { [Op.iLike]: `%${String(query.search).trim()}%` } }));
  const result = await models.AuditLog.unscoped().findAndCountAll({
    where,
    attributes: ["id", "actorName", "actorEmail", "action", "entityName", "recordId", "recordLabel", "details", "createdAt"],
    order: [["createdAt", "DESC"]], limit, offset: (page - 1) * limit,
  });
  res.json({ success: true, data: { items: result.rows, total: result.count, page, limit } });
});
