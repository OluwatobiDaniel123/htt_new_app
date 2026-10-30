/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "node:crypto";
import type { Transaction } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models } from "../models/index.js";

export const pageOptions = (query: Record<string, unknown>) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 25);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "page must be 1–10000 and limit must be 1–100.",
    );
  }
  return { page, limit, offset: (page - 1) * limit };
};

export const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, "");

export const ageOnDate = (dateOfBirth: string | Date, asOf = new Date()) => {
  const dob = new Date(dateOfBirth);
  let age = asOf.getUTCFullYear() - dob.getUTCFullYear();
  const month = asOf.getUTCMonth() - dob.getUTCMonth();
  if (month < 0 || (month === 0 && asOf.getUTCDate() < dob.getUTCDate()))
    age -= 1;
  return age;
};

export const ageGroupFor = (age: number) =>
  age <= 10 ? "8-10" : age <= 12 ? "11-12" : age <= 14 ? "13-14" : "other";

export const ensureCentreProgramme = async (
  centreId?: string | null,
  programmeId?: string | null,
  transaction?: Transaction,
) => {
  if (
    centreId &&
    !(await models.Centre.findByPk(centreId, {
      transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    }))
  )
    throw new AppError(400, "INVALID_CENTRE", "Centre does not exist.");
  if (!programmeId) return;
  const programme = (await models.Programme.findByPk(programmeId, {
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  })) as any;
  if (!programme)
    throw new AppError(400, "INVALID_PROGRAMME", "Programme does not exist.");
  if (centreId) {
    const association = await models.CentreProgramme.findOne({
      where: { centreId, programmeId },
      transaction,
    });
    if (!association)
      throw new AppError(
        400,
        "PROGRAMME_NOT_AT_CENTRE",
        "The selected programme is not offered at this centre.",
      );
  }
};

export const ensureIdsExist = async (
  model: any,
  ids: string[],
  label: string,
  transaction?: Transaction,
) => {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== ids.length)
    throw new AppError(400, "DUPLICATE_IDS", `${label} IDs must be unique.`);
  const rows = ids.length
    ? await model.findAll({ where: { id: ids }, transaction })
    : [];
  if (rows.length !== ids.length)
    throw new AppError(
      400,
      `INVALID_${label.toUpperCase()}`,
      `One or more ${label.toLowerCase()} records do not exist.`,
    );
  return rows;
};

export const isOperationalCentre = (centre: any) =>
  !centre.proposedArea &&
  centre.reviewStatus === "approved" &&
  ["open_for_registration", "assessments_open"].includes(centre.status);

export const generateAcademyCode = async (
  kind: "player" | "registration",
  transaction?: Transaction,
) => {
  const field = kind === "player" ? "playerIdPrefix" : "registrationPrefix";
  const fallback = kind === "player" ? "HTT-P" : "HTT-REG";
  const settings = (await models.ApplicationSettings.findOne({
    attributes: [field],
    ...(transaction ? { transaction } : {}),
  })) as any;
  const configured =
    typeof settings?.[field] === "string" ? settings[field].trim() : fallback;
  const prefix = (
    configured.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 30) || fallback
  ).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
};
