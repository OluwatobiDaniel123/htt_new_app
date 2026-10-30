/* eslint-disable @typescript-eslint/no-explicit-any */
import { Op, type Transaction } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";
import {
  ageGroupFor,
  ageOnDate,
  ensureCentreProgramme,
  generateAcademyCode,
  pageOptions,
} from "./academyShared.js";

const personalFields = [
  "fullName",
  "dateOfBirth",
  "school",
  "developmentNotes",
  "matchNotes",
  "archivedReason",
];
const restrictedCreateFields = ["school", "developmentNotes", "matchNotes"];
const playerFields = [
  "id",
  "playerCode",
  "fullName",
  "dateOfBirth",
  "ageGroup",
  "centreId",
  "programmeId",
  "registrationStatus",
  "scholarshipStatus",
  "documentVerification",
  "developmentNotes",
  "matchAppearances",
  "matchNotes",
  "school",
  "archived",
  "archivedReason",
  "registrationId",
  "createdAt",
  "updatedAt",
];
const includes = [
  {
    model: models.Centre,
    as: "centre",
    attributes: [
      "id",
      "name",
      "code",
      "area",
      "status",
      "reviewStatus",
      "proposedArea",
    ],
  },
  {
    model: models.Programme,
    as: "programme",
    attributes: [
      "id",
      "name",
      "code",
      "ageMin",
      "ageMax",
      "ageGroupLabel",
      "status",
    ],
  },
];
const checkDate = (value: string) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "dateOfBirth must be a valid calendar date.",
    );
  if (new Date(`${value}T00:00:00Z`) > new Date())
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "dateOfBirth cannot be in the future.",
    );
};
const validateAssignedProgramme = async (
  dateOfBirth: string,
  programmeId?: string | null,
  transaction?: Transaction,
) => {
  if (!programmeId) return;
  const programme = (await models.Programme.findByPk(programmeId, {
    transaction,
  })) as any;
  if (!programme)
    throw new AppError(400, "INVALID_PROGRAMME", "Programme does not exist.");
  const age = ageOnDate(dateOfBirth);
  if (
    (programme.ageMin !== null &&
      programme.ageMin !== undefined &&
      age < programme.ageMin) ||
    (programme.ageMax !== null &&
      programme.ageMax !== undefined &&
      age > programme.ageMax)
  ) {
    throw new AppError(
      409,
      "PROGRAMME_AGE_INELIGIBLE",
      "Player age is outside the selected programme eligibility range.",
    );
  }
};
const serialise = (player: any, includePersonal: boolean) => {
  const result: any = {
    id: player.id,
    playerCode: player.playerCode,
    ageGroup: player.ageGroup,
    centreId: player.centreId,
    programmeId: player.programmeId,
    registrationStatus: player.registrationStatus,
    scholarshipStatus: player.scholarshipStatus,
    documentVerification: player.documentVerification,
    matchAppearances: player.matchAppearances,
    archived: player.archived,
    registrationId: player.registrationId,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
    centre: player.centre ?? null,
    programme: player.programme ?? null,
  };
  if (includePersonal)
    Object.assign(result, {
      fullName: player.fullName,
      dateOfBirth: player.dateOfBirth,
      school: player.school,
      developmentNotes: player.developmentNotes,
      matchNotes: player.matchNotes,
      archivedReason: player.archivedReason,
    });
  return result;
};

const ensureRelationships = async (payload: any, transaction?: Transaction) => {
  await ensureCentreProgramme(
    payload.centreId ?? null,
    payload.programmeId ?? null,
    transaction,
  );
  if (payload.dateOfBirth)
    await validateAssignedProgramme(
      payload.dateOfBirth,
      payload.programmeId ?? null,
      transaction,
    );
};

export const listPlayers = async (
  query: Record<string, unknown>,
  options: { includePersonal: boolean },
) => {
  const { page, limit, offset } = pageOptions(query);
  const where: any = {};
  if (query.archived !== undefined) where.archived = query.archived === "true";
  else where.archived = false;
  for (const key of [
    "registrationStatus",
    "scholarshipStatus",
    "documentVerification",
    "ageGroup",
    "centreId",
  ] as const) {
    if (query[key] !== undefined && query[key] !== "") where[key] = query[key];
  }
  if (typeof query.search === "string" && query.search.trim()) {
    const search = `%${query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.or] = options.includePersonal
      ? [
          { playerCode: { [Op.iLike]: search } },
          { fullName: { [Op.iLike]: search } },
        ]
      : [{ playerCode: { [Op.iLike]: search } }];
  }
  const attributes = options.includePersonal
    ? playerFields
    : playerFields.filter((field) => !personalFields.includes(field));
  const result = await models.Player.unscoped().findAndCountAll({
    where,
    attributes,
    include: includes,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return {
    items: result.rows.map((row: any) =>
      serialise(row, options.includePersonal),
    ),
    page,
    limit,
    total: result.count,
  };
};

export const getPlayer = async (
  id: string,
  options: { includePersonal: boolean; includeGuardianContacts: boolean },
) => {
  const attributes = options.includePersonal
    ? playerFields
    : playerFields.filter((field) => !personalFields.includes(field));
  const player = (await models.Player.unscoped().findByPk(id, {
    attributes,
    include: includes,
  })) as any;
  if (!player) throw new AppError(404, "NOT_FOUND", "Player not found.");
  const linkAttributes = [
    "id",
    "playerId",
    "guardianId",
    "relationship",
    "isPrimary",
    "isEmergencyContact",
    "createdAt",
  ];
  const guardianAttributes = options.includeGuardianContacts
    ? [
        "id",
        "fullName",
        "email",
        "phone",
        "preferredContact",
        "accountStatus",
        "consentStatus",
      ]
    : ["id", "fullName", "accountStatus", "consentStatus"];
  const links = (await models.PlayerGuardian.findAll({
    where: { playerId: id },
    attributes: linkAttributes,
    include: [
      {
        model: models.Guardian.unscoped(),
        as: "guardian",
        attributes: guardianAttributes,
      },
    ],
  })) as any[];
  const linkedRegs = (await models.Registration.unscoped().findAll({
    where: {
      [Op.or]: [{ id: player.registrationId ?? null }, { linkedPlayerId: id }],
    },
    attributes: ["id"],
  })) as any[];
  const registrations = linkedRegs.length
    ? await models.RegistrationStatusHistory.findAll({
        where: {
          registrationId: { [Op.in]: linkedRegs.map((reg: any) => reg.id) },
        },
        attributes: ["id", "status", "createdAt"],
        order: [["createdAt", "ASC"]],
      })
    : [];
  return {
    ...serialise(player, options.includePersonal),
    guardians: links.map((link) => ({
      relationship: link.relationship,
      isPrimary: link.isPrimary,
      isEmergencyContact: link.isEmergencyContact,
      guardian: link.guardian,
    })),
    registrationHistory: registrations,
  };
};

export const createPlayer = async (
  input: any,
  actorId: string,
  allowSensitiveWrite: boolean,
  ip?: string,
) => {
  if (
    !allowSensitiveWrite &&
    restrictedCreateFields.some((key) => input[key] !== undefined)
  )
    throw new AppError(
      403,
      "FORBIDDEN",
      "Restricted player notes require additional permission.",
    );
  checkDate(input.dateOfBirth);
  const ageGroup = input.ageGroup ?? ageGroupFor(ageOnDate(input.dateOfBirth));
  const player = await sequelize.transaction(async (transaction) => {
    await ensureRelationships(input, transaction);
    const created = (await models.Player.unscoped().create(
      {
        playerCode: await generateAcademyCode("player", transaction),
        fullName: input.fullName.trim(),
        dateOfBirth: input.dateOfBirth,
        ageGroup,
        centreId: input.centreId ?? null,
        programmeId: input.programmeId ?? null,
        registrationStatus: input.registrationStatus ?? "registered",
        scholarshipStatus: input.scholarshipStatus ?? "none",
        documentVerification: input.documentVerification ?? "pending",
        developmentNotes: input.developmentNotes ?? null,
        matchAppearances: input.matchAppearances ?? 0,
        matchNotes: input.matchNotes ?? null,
        school: input.school ?? null,
        archived: false,
        archivedReason: null,
      },
      { transaction },
    )) as any;
    await writeAudit({
      actorId,
      action: "player.created",
      entityName: "Player",
      recordId: created.id,
      transaction,
      ipAddress: ip,
    });
    return created;
  });
  return getPlayer(player.id, {
    includePersonal: allowSensitiveWrite,
    includeGuardianContacts: false,
  });
};

export const updatePlayer = async (
  id: string,
  input: any,
  actorId: string,
  allowSensitiveWrite: boolean,
  ip?: string,
) => {
  if (
    !allowSensitiveWrite &&
    personalFields.some((key) => input[key] !== undefined)
  )
    throw new AppError(
      403,
      "FORBIDDEN",
      "Sensitive player fields require additional permission.",
    );
  if (input.dateOfBirth) checkDate(input.dateOfBirth);
  await sequelize.transaction(async (transaction) => {
    const player = (await models.Player.unscoped().findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!player) throw new AppError(404, "NOT_FOUND", "Player not found.");
    const nextDob = input.dateOfBirth ?? player.dateOfBirth;
    await ensureRelationships(
      {
        centreId: input.centreId ?? player.centreId,
        programmeId: input.programmeId ?? player.programmeId,
        dateOfBirth: nextDob,
      },
      transaction,
    );
    const updates: any = { ...input };
    if (input.fullName !== undefined) updates.fullName = input.fullName.trim();
    if (input.dateOfBirth !== undefined && input.ageGroup === undefined)
      updates.ageGroup = ageGroupFor(ageOnDate(nextDob));
    await player.update(updates, { transaction });
    await writeAudit({
      actorId,
      action: "player.updated",
      entityName: "Player",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return getPlayer(id, {
    includePersonal: allowSensitiveWrite,
    includeGuardianContacts: false,
  });
};

export const updatePlayerStatus = async (
  id: string,
  input: { registrationStatus: string; archivedReason?: string },
  actorId: string,
  ip?: string,
) => {
  const archived = input.registrationStatus === "archived";
  await sequelize.transaction(async (transaction) => {
    const player = (await models.Player.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!player) throw new AppError(404, "NOT_FOUND", "Player not found.");
    await player.update(
      {
        registrationStatus: input.registrationStatus,
        archived,
        archivedReason: archived
          ? (input.archivedReason ?? "Archived by staff")
          : null,
      },
      { transaction },
    );
    await writeAudit({
      actorId,
      action: archived ? "player.archived" : "player.status_changed",
      entityName: "Player",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return { id, registrationStatus: input.registrationStatus, archived };
};

export const archivePlayer = (
  id: string,
  actorId: string,
  reason: string | undefined,
  ip?: string,
) =>
  updatePlayerStatus(
    id,
    { registrationStatus: "archived", archivedReason: reason },
    actorId,
    ip,
  );
