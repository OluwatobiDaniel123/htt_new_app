/* eslint-disable @typescript-eslint/no-explicit-any */
import { Op } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";
import { ensureIdsExist, pageOptions } from "./academyShared.js";

const includeCentres = [
  {
    model: models.Centre,
    as: "centres",
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
];
const syncCentres = async (
  programme: any,
  ids: string[] | undefined,
  transaction: any,
) => {
  if (ids === undefined) return;
  await ensureIdsExist(models.Centre, ids, "centres", transaction);
  await models.CentreProgramme.destroy({
    where: { programmeId: programme.id },
    transaction,
  });
  if (ids.length)
    await models.CentreProgramme.bulkCreate(
      ids.map((centreId) => ({ centreId, programmeId: programme.id })),
      { transaction },
    );
};
const checkAgeBounds = (input: any) => {
  if (input.ageMin !== undefined && input.ageMin !== null && input.ageMin < 0)
    throw new AppError(400, "VALIDATION_ERROR", "ageMin cannot be negative.");
  if (input.ageMax !== undefined && input.ageMax !== null && input.ageMax < 0)
    throw new AppError(400, "VALIDATION_ERROR", "ageMax cannot be negative.");
  if (
    input.ageMin !== undefined &&
    input.ageMax !== undefined &&
    input.ageMin !== null &&
    input.ageMax !== null &&
    input.ageMax < input.ageMin
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "ageMax cannot be lower than ageMin.",
    );
};

export const listProgrammes = async (query: Record<string, unknown>) => {
  const { page, limit, offset } = pageOptions(query);
  const where: any = {};
  if (query.status) where.status = query.status;
  if (query.availability) where.availability = query.availability;
  if (typeof query.search === "string" && query.search.trim()) {
    const term = `%${query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { code: { [Op.iLike]: term } },
      { ageGroupLabel: { [Op.iLike]: term } },
    ];
  }
  const result = await models.Programme.findAndCountAll({
    where,
    include: includeCentres,
    order: [["name", "ASC"]],
    limit,
    offset,
    distinct: true,
  });
  return { items: result.rows, page, limit, total: result.count };
};
export const getProgramme = async (id: string) => {
  const programme = await models.Programme.findByPk(id, {
    include: includeCentres,
  });
  if (!programme) throw new AppError(404, "NOT_FOUND", "Programme not found.");
  return programme;
};
export const createProgramme = async (
  input: any,
  actorId: string,
  ip?: string,
) => {
  checkAgeBounds(input);
  const created = await sequelize.transaction(async (transaction) => {
    const programme = (await models.Programme.create(
      {
        slug: input.slug ?? null,
        name: input.name.trim(),
        tagline: input.tagline ?? null,
        code: input.code?.trim().toUpperCase() ?? null,
        description: input.description ?? null,
        ageGroup: input.ageGroup ?? null,
        trainingDays: input.trainingDays ?? [],
        duration: input.duration ?? null,
        price: input.price ?? null,
        benefits: input.benefits ?? [],
        requirements: input.requirements ?? [],
        equipment: input.equipment ?? [],
        icon: input.icon ?? null,
        featured: input.featured ?? false,
        ageGroupLabel: input.ageGroupLabel.trim(),
        ageMin: input.ageMin ?? null,
        ageMax: input.ageMax ?? null,
        approvedFee: input.approvedFee ?? null,
        currency: input.currency ?? "NGN",
        schedule: input.schedule ?? null,
        capacity: input.capacity ?? null,
        assessmentsRequired: input.assessmentsRequired ?? true,
        availability: input.availability ?? "open",
        status: input.status ?? "active",
        notes: input.notes ?? null,
      },
      { transaction },
    )) as any;
    await syncCentres(programme, input.centreIds, transaction);
    await writeAudit({
      actorId,
      action: "programme.created",
      entityName: "Programme",
      recordId: programme.id,
      transaction,
      ipAddress: ip,
    });
    return programme;
  });
  return getProgramme(created.id);
};
export const updateProgramme = async (
  id: string,
  input: any,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const programme = (await models.Programme.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!programme)
      throw new AppError(404, "NOT_FOUND", "Programme not found.");
    const merged = { ...programme.toJSON(), ...input };
    checkAgeBounds(merged);
    const updates: any = { ...input };
    if (updates.name !== undefined) updates.name = updates.name.trim();
    if (updates.slug !== undefined) updates.slug = updates.slug?.trim() || null;
    if (updates.code !== undefined)
      updates.code = updates.code?.trim().toUpperCase() || null;
    if (updates.ageGroupLabel !== undefined)
      updates.ageGroupLabel = updates.ageGroupLabel.trim();
    delete updates.centreIds;
    await programme.update(updates, { transaction });
    await syncCentres(programme, input.centreIds, transaction);
    await writeAudit({
      actorId,
      action: "programme.updated",
      entityName: "Programme",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return getProgramme(id);
};
export const updateProgrammeStatus = async (
  id: string,
  input: { status: string; availability?: string },
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const programme = (await models.Programme.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!programme)
      throw new AppError(404, "NOT_FOUND", "Programme not found.");
    await programme.update(input, { transaction });
    await writeAudit({
      actorId,
      action: "programme.status_changed",
      entityName: "Programme",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return getProgramme(id);
};
export const deleteProgramme = async (
  id: string,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const programme = await models.Programme.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!programme)
      throw new AppError(404, "NOT_FOUND", "Programme not found.");
    const refs = await Promise.all([
      models.Registration.count({ where: { programmeId: id }, transaction }),
      models.Player.count({ where: { programmeId: id }, transaction }),
      models.AttendanceSession.count({
        where: { programmeId: id },
        transaction,
      }),
      models.Assessment.count({ where: { programmeId: id }, transaction }),
      models.ScholarshipAward.count({
        where: { programmeId: id },
        transaction,
      }),
      models.ScholarshipApplication.count({
        where: { programmeId: id },
        transaction,
      }),
    ]);
    if (refs.some(Boolean))
      throw new AppError(
        409,
        "PROGRAMME_HAS_HISTORY",
        "This programme is referenced by academy or historical records and cannot be deleted.",
      );
    await models.CentreProgramme.destroy({
      where: { programmeId: id },
      transaction,
    });
    await programme.destroy({ transaction });
    await writeAudit({
      actorId,
      action: "programme.deleted",
      entityName: "Programme",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
};
