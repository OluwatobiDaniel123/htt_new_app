/* eslint-disable @typescript-eslint/no-explicit-any */
import { Op, col, fn, where } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";
import { normalizePhone, pageOptions } from "./academyShared.js";

const guardianFields = [
  "id",
  "fullName",
  "email",
  "phone",
  "preferredContact",
  "communicationPreferences",
  "accountStatus",
  "consentStatus",
  "createdAt",
  "updatedAt",
];
const contactFields = ["email", "phone", "address"];
const findDuplicatePhone = async (
  phone: string,
  excludeId?: string,
  transaction?: any,
) => {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  const clauses = [
    where(fn("regexp_replace", col("phone"), "[^0-9]", "", "g"), digits),
  ];
  if (excludeId) clauses.push({ id: { [Op.ne]: excludeId } } as any);
  return models.Guardian.unscoped().findOne({
    where: { [Op.and]: clauses },
    transaction,
  });
};
const output = (guardian: any, includeContact: boolean) => ({
  id: guardian.id,
  fullName: guardian.fullName,
  ...(includeContact
    ? {
        email: guardian.email,
        phone: guardian.phone,
        address: guardian.address,
      }
    : {}),
  preferredContact: guardian.preferredContact,
  communicationPreferences: guardian.communicationPreferences,
  accountStatus: guardian.accountStatus,
  consentStatus: guardian.consentStatus,
  createdAt: guardian.createdAt,
  updatedAt: guardian.updatedAt,
});

export const listGuardians = async (
  query: Record<string, unknown>,
  options: { includeContact: boolean },
) => {
  const { page, limit, offset } = pageOptions(query);
  const whereClause: any = {};
  if (query.accountStatus) whereClause.accountStatus = query.accountStatus;
  if (query.consentStatus) whereClause.consentStatus = query.consentStatus;
  if (typeof query.search === "string" && query.search.trim()) {
    const term = `%${query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    whereClause[Op.or] = [
      { fullName: { [Op.iLike]: term } },
      ...(options.includeContact
        ? [{ phone: { [Op.iLike]: term } }, { email: { [Op.iLike]: term } }]
        : []),
    ];
  }
  const attributes = [...guardianFields, "address"];
  if (!options.includeContact)
    for (const field of contactFields)
      attributes.splice(attributes.indexOf(field), 1);
  const result = await models.Guardian.unscoped().findAndCountAll({
    where: whereClause,
    attributes,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });
  return {
    items: result.rows.map((row: any) => output(row, options.includeContact)),
    page,
    limit,
    total: result.count,
  };
};

export const getGuardian = async (
  id: string,
  options: { includeContact: boolean },
) => {
  const attributes = [...guardianFields, "address"];
  if (!options.includeContact)
    for (const field of contactFields)
      attributes.splice(attributes.indexOf(field), 1);
  const guardian = (await models.Guardian.unscoped().findByPk(id, {
    attributes,
  })) as any;
  if (!guardian) throw new AppError(404, "NOT_FOUND", "Guardian not found.");
  return output(guardian, options.includeContact);
};

export const getGuardianPlayers = async (
  id: string,
  options: { includeContact: boolean; includePlayerPersonal: boolean },
) => {
  const guardian = await models.Guardian.findByPk(id);
  if (!guardian) throw new AppError(404, "NOT_FOUND", "Guardian not found.");
  const playerAttributes = options.includePlayerPersonal
    ? [
        "id",
        "playerCode",
        "fullName",
        "dateOfBirth",
        "ageGroup",
        "registrationStatus",
        "archived",
      ]
    : ["id", "playerCode", "ageGroup", "registrationStatus", "archived"];
  const rows = (await models.PlayerGuardian.findAll({
    where: { guardianId: id },
    attributes: [
      "id",
      "relationship",
      "isPrimary",
      "isEmergencyContact",
      "createdAt",
    ],
    include: [
      {
        model: models.Player.unscoped(),
        as: "player",
        attributes: playerAttributes,
      },
    ],
  })) as any[];
  return rows.map((row) => ({
    ...row.toJSON(),
    guardian: output(guardian, options.includeContact),
  }));
};

export const createGuardian = async (
  input: any,
  actorId: string,
  includeContact: boolean,
  ip?: string,
) => {
  const phone = input.phone.trim();
  if (await findDuplicatePhone(phone))
    throw new AppError(
      409,
      "GUARDIAN_PHONE_EXISTS",
      "A guardian with this phone number already exists.",
    );
  const guardian = await sequelize.transaction(async (transaction) => {
    const created = (await models.Guardian.unscoped().create(
      {
        fullName: input.fullName.trim(),
        phone,
        email: input.email?.trim().toLowerCase() ?? null,
        address: input.address ?? null,
        preferredContact: input.preferredContact ?? null,
        communicationPreferences: input.communicationPreferences ?? [],
        accountStatus: input.accountStatus ?? "active",
        consentStatus: input.consentStatus ?? "pending",
        notes: input.notes ?? null,
      },
      { transaction },
    )) as any;
    await writeAudit({
      actorId,
      action: "guardian.created",
      entityName: "Guardian",
      recordId: created.id,
      transaction,
      ipAddress: ip,
    });
    return created;
  });
  return output(guardian, includeContact);
};

export const updateGuardian = async (
  id: string,
  input: any,
  actorId: string,
  includeContact: boolean,
  ip?: string,
) => {
  if (input.phone !== undefined) {
    if (await findDuplicatePhone(input.phone, id))
      throw new AppError(
        409,
        "GUARDIAN_PHONE_EXISTS",
        "A guardian with this phone number already exists.",
      );
    input.phone = input.phone.trim();
  }
  if (input.email !== undefined && input.email)
    input.email = input.email.trim().toLowerCase();
  if (input.fullName !== undefined) input.fullName = input.fullName.trim();
  let guardian: any;
  await sequelize.transaction(async (transaction) => {
    guardian = (await models.Guardian.unscoped().findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!guardian) throw new AppError(404, "NOT_FOUND", "Guardian not found.");
    await guardian.update(input, { transaction });
    await writeAudit({
      actorId,
      action: "guardian.updated",
      entityName: "Guardian",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return output(guardian, includeContact);
};

export const deactivateGuardian = async (
  id: string,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const guardian = (await models.Guardian.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!guardian) throw new AppError(404, "NOT_FOUND", "Guardian not found.");
    await guardian.update({ accountStatus: "inactive" }, { transaction });
    await writeAudit({
      actorId,
      action: "guardian.deactivated",
      entityName: "Guardian",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return { id, accountStatus: "inactive" };
};

export const linkGuardianToPlayer = async (
  playerId: string,
  input: any,
  actorId: string,
  includeContact: boolean,
  ip?: string,
) => {
  const link = (await sequelize.transaction(async (transaction) => {
    await models.Player.findByPk(playerId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    }).then((row) => {
      if (!row) throw new AppError(404, "NOT_FOUND", "Player not found.");
    });
    const guardian = await models.Guardian.findByPk(input.guardianId, {
      transaction,
    });
    if (!guardian || (guardian as any).accountStatus !== "active")
      throw new AppError(
        400,
        "INVALID_GUARDIAN",
        "An active guardian is required.",
      );
    let relation = (await models.PlayerGuardian.findOne({
      where: { playerId, guardianId: input.guardianId },
      transaction,
    })) as any;
    if (input.isPrimary)
      await models.PlayerGuardian.update(
        { isPrimary: false },
        {
          where: {
            playerId,
            guardianId: { [Op.ne]: input.guardianId },
            isPrimary: true,
          },
          transaction,
        },
      );
    if (relation) {
      await relation.update(
        {
          relationship: input.relationship,
          isPrimary: input.isPrimary ?? relation.isPrimary,
          isEmergencyContact:
            input.isEmergencyContact ?? relation.isEmergencyContact,
          notes: input.notes ?? relation.notes,
        },
        { transaction },
      );
    } else {
      relation = await models.PlayerGuardian.create(
        {
          playerId,
          guardianId: input.guardianId,
          relationship: input.relationship,
          isPrimary: input.isPrimary ?? false,
          isEmergencyContact: input.isEmergencyContact ?? false,
          notes: input.notes ?? null,
        },
        { transaction },
      );
    }
    await writeAudit({
      actorId,
      action: "guardian.player_linked",
      entityName: "PlayerGuardian",
      recordId: (relation as any).id,
      transaction,
      ipAddress: ip,
    });
    return relation;
  })) as any;
  return models.PlayerGuardian.findByPk(link.id, {
    include: [
      {
        model: models.Guardian.unscoped(),
        as: "guardian",
        attributes: includeContact
          ? ["id", "fullName", "email", "phone"]
          : ["id", "fullName"],
      },
    ],
  });
};

export const unlinkGuardianFromPlayer = async (
  playerId: string,
  guardianId: string,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const relation = await models.PlayerGuardian.findOne({
      where: { playerId, guardianId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!relation)
      throw new AppError(404, "NOT_FOUND", "Guardian relationship not found.");
    await relation.destroy({ transaction });
    await writeAudit({
      actorId,
      action: "guardian.player_unlinked",
      entityName: "PlayerGuardian",
      recordId: (relation as any).id,
      transaction,
      ipAddress: ip,
    });
  });
};
