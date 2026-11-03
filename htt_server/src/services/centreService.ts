/* eslint-disable @typescript-eslint/no-explicit-any */
import { Op } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";
import {
  ensureIdsExist,
  isOperationalCentre,
  pageOptions,
} from "./academyShared.js";

const includeProgrammes = [
  {
    model: models.Programme,
    as: "programmes",
    attributes: [
      "id",
      "name",
      "code",
      "status",
      "availability",
      "ageGroupLabel",
    ],
  },
];
const operationalStatuses = ["open_for_registration", "assessments_open"];
const serialise = (centre: any) => ({
  ...centre.toJSON(),
  isOperational: isOperationalCentre(centre),
});
const validateState = (state: any) => {
  const status = state.status ?? "pending_verification";
  const reviewStatus = state.reviewStatus ?? "pending_verification";
  const proposedArea = state.proposedArea ?? true;
  if (
    operationalStatuses.includes(status) &&
    (reviewStatus !== "approved" || proposedArea)
  )
    throw new AppError(
      409,
      "CENTRE_NOT_VERIFIED",
      "A centre must be approved and marked non-proposed before becoming operational.",
    );
  if (
    state.registrationAvailable &&
    (!operationalStatuses.includes(status) ||
      reviewStatus !== "approved" ||
      proposedArea)
  )
    throw new AppError(
      409,
      "CENTRE_NOT_OPEN",
      "Registration availability requires an approved operational centre.",
    );
};
const syncProgrammes = async (
  centre: any,
  ids: string[] | undefined,
  transaction: any,
) => {
  if (ids === undefined) return;
  await ensureIdsExist(models.Programme, ids, "programmes", transaction);
  await models.CentreProgramme.destroy({
    where: { centreId: centre.id },
    transaction,
  });
  if (ids.length)
    await models.CentreProgramme.bulkCreate(
      ids.map((programmeId) => ({ centreId: centre.id, programmeId })),
      { transaction },
    );
};

export const listCentres = async (query: Record<string, unknown>) => {
  const { page, limit, offset } = pageOptions(query);
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.reviewStatus) where.reviewStatus = query.reviewStatus;
  if (query.operational === "true")
    where[Op.and] = [
      ...(where[Op.and] ?? []),
      {
        proposedArea: false,
        reviewStatus: "approved",
        status: { [Op.in]: operationalStatuses },
      },
    ];
  if (query.operational === "false")
    where[Op.and] = [
      ...(where[Op.and] ?? []),
      {
        [Op.or]: [
          { proposedArea: true },
          { reviewStatus: { [Op.ne]: "approved" } },
          { status: { [Op.notIn]: operationalStatuses } },
        ],
      },
    ];
  if (typeof query.search === "string" && query.search.trim()) {
    const term = `%${query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.and] = [
      ...(where[Op.and] ?? []),
      {
        [Op.or]: [
          { name: { [Op.iLike]: term } },
          { code: { [Op.iLike]: term } },
          { area: { [Op.iLike]: term } },
        ],
      },
    ];
  }
  const result = await models.Centre.findAndCountAll({
    where,
    include: includeProgrammes,
    order: [["name", "ASC"]],
    limit,
    offset,
    distinct: true,
  });
  return {
    items: result.rows.map(serialise),
    page,
    limit,
    total: result.count,
  };
};

export const getCentre = async (id: string) => {
  const centre = (await models.Centre.findByPk(id, {
    include: includeProgrammes,
  })) as any;
  if (!centre) throw new AppError(404, "NOT_FOUND", "Centre not found.");
  return serialise(centre);
};

export const createCentre = async (
  input: any,
  actorId: string,
  ip?: string,
) => {
  validateState(input);
  const centre = await sequelize.transaction(async (transaction) => {
    const created = (await models.Centre.create(
      {
        slug: input.slug ?? null,
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        area: input.area.trim(),
        address: input.address ?? null,
        city: input.city ?? null,
        region: input.region ?? null,
        mapEmbed: input.mapEmbed ?? null,
        mapLink: input.mapLink ?? null,
        leadCoach: input.leadCoach ?? null,
        staffEmails: input.staffEmails ?? [],
        ageGroups: input.ageGroups ?? [],
        schedule: input.schedule ?? null,
        image: input.image ?? null,
        comingSoon: input.comingSoon ?? false,
        approvedFee: input.approvedFee ?? null,
        capacity: input.capacity ?? null,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail?.toLowerCase() ?? null,
        operationalNotes: input.operationalNotes ?? null,
        registrationAvailable: input.registrationAvailable ?? false,
        reviewStatus: input.reviewStatus ?? "pending_verification",
        status: input.status ?? "pending_verification",
        proposedArea: input.proposedArea ?? true,
      },
      { transaction },
    )) as any;
    await syncProgrammes(created, input.programmeIds, transaction);
    await writeAudit({
      actorId,
      action: "centre.created",
      entityName: "Centre",
      recordId: created.id,
      transaction,
      ipAddress: ip,
    });
    return created;
  });
  return getCentre(centre.id);
};

export const updateCentre = async (
  id: string,
  input: any,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const centre = (await models.Centre.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!centre) throw new AppError(404, "NOT_FOUND", "Centre not found.");
    validateState({ ...centre.toJSON(), ...input });
    const updates: any = { ...input };
    if (updates.name !== undefined) updates.name = updates.name.trim();
    if (updates.slug !== undefined) updates.slug = updates.slug?.trim() || null;
    if (updates.code !== undefined)
      updates.code = updates.code.trim().toUpperCase();
    if (updates.area !== undefined) updates.area = updates.area.trim();
    if (updates.contactEmail)
      updates.contactEmail = updates.contactEmail.toLowerCase();
    delete updates.programmeIds;
    await centre.update(updates, { transaction });
    await syncProgrammes(centre, input.programmeIds, transaction);
    await writeAudit({
      actorId,
      action: "centre.updated",
      entityName: "Centre",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return getCentre(id);
};

export const updateCentreStatus = async (
  id: string,
  input: any,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const centre = (await models.Centre.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!centre) throw new AppError(404, "NOT_FOUND", "Centre not found.");
    const state = { ...centre.toJSON(), ...input };
    validateState(state);
    await centre.update(input, { transaction });
    await writeAudit({
      actorId,
      action: "centre.status_changed",
      entityName: "Centre",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return getCentre(id);
};

export const deleteCentre = async (
  id: string,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const centre = await models.Centre.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!centre) throw new AppError(404, "NOT_FOUND", "Centre not found.");
    const refs = await Promise.all([
      models.Registration.count({ where: { centreId: id }, transaction }),
      models.Player.count({ where: { centreId: id }, transaction }),
      models.AttendanceSession.count({ where: { centreId: id }, transaction }),
      models.Assessment.count({ where: { centreId: id }, transaction }),
      models.ScholarshipAward.count({ where: { centreId: id }, transaction }),
      models.ScholarshipApplication.count({
        where: { centreId: id },
        transaction,
      }),
    ]);
    if (refs.some(Boolean))
      throw new AppError(
        409,
        "CENTRE_HAS_HISTORY",
        "This centre is referenced by academy or historical records and cannot be deleted.",
      );
    await models.CentreProgramme.destroy({
      where: { centreId: id },
      transaction,
    });
    await centre.destroy({ transaction });
    await writeAudit({
      actorId,
      action: "centre.deleted",
      entityName: "Centre",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
};
