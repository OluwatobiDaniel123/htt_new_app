/* eslint-disable @typescript-eslint/no-explicit-any */
import { Op, col, fn, where, type Transaction } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";
import { enqueueNotificationEvent } from "./notificationService.js";
import {
  ageGroupFor,
  ageOnDate,
  ensureCentreProgramme,
  generateAcademyCode,
  isOperationalCentre,
  normalizePhone,
  pageOptions,
} from "./academyShared.js";

export const registrationStatuses = [
  "submitted",
  "under_review",
  "assessment_required",
  "information_required",
  "approved",
  "rejected",
] as const;
const allowedTransitions: Record<string, string[]> = {
  submitted: [
    "under_review",
    "assessment_required",
    "information_required",
    "rejected",
    "approved",
  ],
  under_review: [
    "assessment_required",
    "information_required",
    "rejected",
    "approved",
  ],
  assessment_required: [
    "under_review",
    "information_required",
    "rejected",
    "approved",
  ],
  information_required: [
    "under_review",
    "assessment_required",
    "rejected",
    "approved",
  ],
  approved: [],
  rejected: [],
};
export const isAllowedRegistrationTransition = (from: string, to: string) =>
  allowedTransitions[from]?.includes(to) ?? false;
const registrationIncludes = [
  {
    model: models.Centre,
    as: "centre",
    attributes: [
      "id",
      "name",
      "code",
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
      "approvedFee",
      "status",
      "availability",
    ],
  },
  {
    model: models.Player.unscoped(),
    as: "player",
    attributes: ["id", "playerCode", "fullName", "dateOfBirth", "ageGroup"],
  },
  {
    model: models.Guardian.unscoped(),
    as: "guardian",
    attributes: ["id", "fullName", "email", "phone"],
  },
];
const registrationDetailIncludes = [
  ...registrationIncludes,
  {
    model: models.RegistrationDocument,
    as: "documents",
    attributes: [
      "id",
      "name",
      "mediaAssetId",
      "status",
      "verifiedById",
      "verifiedAt",
      "createdAt",
    ],
  },
  {
    model: models.RegistrationStatusHistory,
    as: "statusHistory",
    attributes: ["id", "status", "note", "actorId", "createdAt"],
  },
];
const fullPersonalFields = [
  "guardianName",
  "guardianEmail",
  "guardianPhone",
  "guardianAddress",
  "childName",
  "childDateOfBirth",
  "internalNotes",
];
const serializeRegistration = (
  row: any,
  canSeePlayer: boolean,
  canSeeGuardian: boolean,
  canSeeInternal = true,
) => {
  const json = row.toJSON();
  if (Array.isArray(json.statusHistory))
    json.statusHistory.sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  if (!canSeePlayer) {
    json.childName = undefined;
    json.childDateOfBirth = undefined;
  }
  if (!canSeeGuardian) {
    json.guardianName = undefined;
    json.guardianEmail = undefined;
    json.guardianPhone = undefined;
    json.guardianAddress = undefined;
  }
  if (!canSeeInternal) json.internalNotes = undefined;
  if (!canSeeInternal) json.documents = undefined;
  if (!canSeeInternal && Array.isArray(json.statusHistory))
    json.statusHistory = json.statusHistory.map(
      ({ note: _note, ...entry }: any) => entry,
    );
  if (json.player && !canSeePlayer) {
    json.player.fullName = undefined;
    json.player.dateOfBirth = undefined;
  }
  if (json.guardian && !canSeeGuardian) {
    json.guardian.fullName = undefined;
    json.guardian.email = undefined;
    json.guardian.phone = undefined;
  }
  return json;
};
const assertOperationalSelections = async (
  centreId?: string | null,
  programmeId?: string | null,
  transaction?: Transaction,
) => {
  await ensureCentreProgramme(centreId, programmeId, transaction);
  if (centreId) {
    const centre = (await models.Centre.findByPk(centreId, {
      transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    })) as any;
    if (!centre || !isOperationalCentre(centre))
      throw new AppError(
        409,
        "CENTRE_NOT_OPERATIONAL",
        "Registrations require an approved operational centre.",
      );
  }
  if (programmeId) {
    const programme = (await models.Programme.findByPk(programmeId, {
      transaction,
      ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    })) as any;
    if (programme.status !== "active" || programme.availability === "closed")
      throw new AppError(
        409,
        "PROGRAMME_UNAVAILABLE",
        "The selected programme is not currently available.",
      );
  }
};
const requiredRegistrationFields = (row: any) => {
  if (
    !row.childName?.trim() ||
    !row.childDateOfBirth ||
    !row.guardianName?.trim() ||
    !row.guardianPhone?.trim()
  )
    throw new AppError(
      409,
      "REGISTRATION_INCOMPLETE",
      "Child name, date of birth, guardian name, and guardian phone are required before approval.",
    );
  const date = new Date(`${row.childDateOfBirth}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date > new Date())
    throw new AppError(
      409,
      "REGISTRATION_INVALID_DOB",
      "Registration must have a valid non-future date of birth before approval.",
    );
};
const guardianByPhone = async (phone: string, transaction: Transaction) => {
  const normalized = normalizePhone(phone);
  const rows = await models.Guardian.unscoped().findAll({
    where: where(
      fn("regexp_replace", col("phone"), "[^0-9]", "", "g"),
      normalized,
    ),
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (rows.length > 1)
    throw new AppError(
      409,
      "GUARDIAN_MATCH_AMBIGUOUS",
      "Multiple guardians match this phone number; resolve duplicate records before approval.",
    );
  if (rows[0] && (rows[0] as any).accountStatus !== "active")
    throw new AppError(
      409,
      "GUARDIAN_INACTIVE",
      "The matching guardian record is inactive. Review it before approval.",
    );
  return rows[0] as any | undefined;
};
const playerCandidates = async (row: any, transaction: Transaction) =>
  models.Player.unscoped().findAll({
    where: {
      [Op.and]: [
        where(
          fn("lower", fn("btrim", col("full_name"))),
          row.childName.trim().toLowerCase(),
        ),
        { dateOfBirth: row.childDateOfBirth },
      ],
    },
    attributes: ["id", "playerCode", "fullName", "dateOfBirth", "archived"],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
const lockPotentialDuplicate = async (row: any, transaction: Transaction) => {
  const key = `${row.childName.trim().toLowerCase()}:${row.childDateOfBirth}`;
  await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:dedupeKey))", {
    replacements: { dedupeKey: key },
    transaction,
  });
};

export const listRegistrations = async (
  query: Record<string, unknown>,
  access: { playerData: boolean; guardianData: boolean; internal: boolean },
) => {
  const { page, limit, offset } = pageOptions(query);
  const whereClause: any = {};
  for (const key of ["status", "centreId", "programmeId"] as const)
    if (query[key]) whereClause[key] = query[key];
  if (typeof query.search === "string" && query.search.trim()) {
    const term = `%${query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    whereClause[Op.or] = [
      { reference: { [Op.iLike]: term } },
      ...(access.playerData ? [{ childName: { [Op.iLike]: term } }] : []),
      ...(access.guardianData
        ? [
            { guardianName: { [Op.iLike]: term } },
            { guardianPhone: { [Op.iLike]: term } },
          ]
        : []),
    ];
  }
  const attributes = fullPersonalFields.filter((field) =>
    field === "guardianName" ||
    field === "guardianEmail" ||
    field === "guardianPhone" ||
    field === "guardianAddress"
      ? access.guardianData
      : field === "childName" || field === "childDateOfBirth"
        ? access.playerData
        : access.internal,
  );
  const result = await models.Registration.unscoped().findAndCountAll({
    where: whereClause,
    attributes: [
      "id",
      "reference",
      "centreId",
      "programmeId",
      "ageGroup",
      "pathway",
      "documentStatus",
      "consentMedia",
      "consentData",
      "consentMedical",
      "paymentStatus",
      "amountDue",
      "paymentReference",
      "assignedReviewerId",
      "submittedAt",
      "reviewedAt",
      "status",
      "source",
      "linkedPlayerId",
      "guardianId",
      "createdAt",
      "updatedAt",
      ...attributes,
    ],
    include: registrationIncludes,
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    distinct: true,
  });
  return {
    items: result.rows.map((row: any) =>
      serializeRegistration(
        row,
        access.playerData,
        access.guardianData,
        access.internal,
      ),
    ),
    page,
    limit,
    total: result.count,
  };
};

export const getRegistration = async (
  id: string,
  access: { playerData: boolean; guardianData: boolean; internal?: boolean },
) => {
  const attributes = fullPersonalFields.filter((field) =>
    [
      "guardianName",
      "guardianEmail",
      "guardianPhone",
      "guardianAddress",
    ].includes(field)
      ? access.guardianData
      : ["childName", "childDateOfBirth"].includes(field)
        ? access.playerData
        : access.internal === true,
  );
  const row = (await models.Registration.unscoped().findByPk(id, {
    attributes: [
      "id",
      "reference",
      "centreId",
      "programmeId",
      "ageGroup",
      "pathway",
      "documentStatus",
      "consentMedia",
      "consentData",
      "consentMedical",
      "paymentStatus",
      "amountDue",
      "paymentReference",
      "assignedReviewerId",
      "submittedAt",
      "reviewedAt",
      "status",
      "source",
      "linkedPlayerId",
      "guardianId",
      "createdAt",
      "updatedAt",
      ...attributes,
    ],
    include: registrationDetailIncludes,
  })) as any;
  if (!row) throw new AppError(404, "NOT_FOUND", "Registration not found.");
  return serializeRegistration(
    row,
    access.playerData,
    access.guardianData,
    access.internal === true,
  );
};

export const createRegistration = async (
  input: any,
  actorId: string | null,
  ip?: string,
  source = "admin",
) => {
  if (
    input.childDateOfBirth &&
    new Date(`${input.childDateOfBirth}T00:00:00Z`) > new Date()
  )
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Child date of birth cannot be in the future.",
    );
  const status = "submitted";
  const record = await sequelize.transaction(async (transaction) => {
    await assertOperationalSelections(
      input.centreId,
      input.programmeId,
      transaction,
    );
    const programme = input.programmeId
      ? ((await models.Programme.findByPk(input.programmeId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        })) as any)
      : null;
    if (input.assignedReviewerId) {
      const reviewer = await models.StaffAccount.findOne({
        where: {
          id: input.assignedReviewerId,
          active: true,
          suspendedAt: null,
        },
        transaction,
      });
      if (!reviewer)
        throw new AppError(
          400,
          "INVALID_REVIEWER",
          "Assigned reviewer must be an active staff account.",
        );
    }
    const registration = (await models.Registration.unscoped().create(
      {
        reference: await generateAcademyCode("registration", transaction),
        guardianName: input.guardianName.trim(),
        guardianEmail: input.guardianEmail?.trim().toLowerCase() ?? null,
        guardianPhone: input.guardianPhone.trim(),
        guardianAddress: input.guardianAddress ?? null,
        childName: input.childName.trim(),
        childDateOfBirth: input.childDateOfBirth ?? null,
        centreId: input.centreId ?? null,
        programmeId: input.programmeId ?? null,
        ageGroup:
          input.ageGroup ??
          (input.childDateOfBirth
            ? ageGroupFor(ageOnDate(input.childDateOfBirth))
            : null),
        pathway: input.pathway ?? "paid_academy",
        documentStatus: "pending",
        consentMedia: input.consentMedia ?? false,
        consentData: input.consentData ?? false,
        consentMedical: input.consentMedical ?? false,
        paymentStatus: "unpaid",
        amountDue: programme?.approvedFee ?? 0,
        status,
        source,
        submittedAt: new Date(),
        internalNotes: input.internalNotes ?? null,
        assignedReviewerId: input.assignedReviewerId ?? null,
      },
      { transaction },
    )) as any;
    await models.RegistrationStatusHistory.create(
      {
        registrationId: registration.id,
        status,
        note: input.initialNote ?? (source === "public_website" ? "Submitted through the public website" : "Registration captured by staff"),
        actorId,
      },
      { transaction },
    );
    await writeAudit({
      actorId,
      action: source === "public_website" ? "registration.public_submitted" : "registration.created",
      entityName: "Registration",
      recordId: registration.id,
      transaction,
      ipAddress: ip,
    });
    await enqueueNotificationEvent("registration.received", "registration", registration.id, transaction);
    return registration;
  });
  return { id: record.id, reference: record.reference, status: record.status };
};

export const updateRegistration = async (
  id: string,
  input: any,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const row = (await models.Registration.unscoped().findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!row) throw new AppError(404, "NOT_FOUND", "Registration not found.");
    if (["approved", "rejected"].includes(row.status))
      throw new AppError(
        409,
        "REGISTRATION_FINAL",
        "Approved or rejected registrations cannot be edited.",
      );
    const centreId = input.centreId ?? row.centreId;
    const programmeId = input.programmeId ?? row.programmeId;
    await assertOperationalSelections(centreId, programmeId, transaction);
    const updates: any = { ...input };
    for (const key of [
      "guardianName",
      "childName",
      "guardianPhone",
      "guardianAddress",
      "internalNotes",
    ])
      if (typeof updates[key] === "string") updates[key] = updates[key].trim();
    if (updates.guardianEmail)
      updates.guardianEmail = updates.guardianEmail.trim().toLowerCase();
    if (
      updates.childDateOfBirth &&
      new Date(`${updates.childDateOfBirth}T00:00:00Z`) > new Date()
    )
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Child date of birth cannot be in the future.",
      );
    if (input.assignedReviewerId) {
      const reviewer = await models.StaffAccount.findOne({
        where: {
          id: input.assignedReviewerId,
          active: true,
          suspendedAt: null,
        },
        transaction,
      });
      if (!reviewer)
        throw new AppError(
          400,
          "INVALID_REVIEWER",
          "Assigned reviewer must be an active staff account.",
        );
    }
    if (input.programmeId !== undefined) {
      const programme = input.programmeId
        ? ((await models.Programme.findByPk(input.programmeId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })) as any)
        : null;
      updates.amountDue = programme?.approvedFee ?? 0;
    }
    await row.update(updates, { transaction });
    await writeAudit({
      actorId,
      action: "registration.updated",
      entityName: "Registration",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return { id };
};

export const updateRegistrationDocuments = async (
  id: string,
  docs: any[],
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const row = await models.Registration.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) throw new AppError(404, "NOT_FOUND", "Registration not found.");
    if (["approved", "rejected"].includes((row as any).status))
      throw new AppError(
        409,
        "REGISTRATION_FINAL",
        "Documents cannot be changed after a final decision.",
      );
    const suppliedIds = docs.map((doc) => doc.id).filter(Boolean);
    const existing = suppliedIds.length
      ? ((await models.RegistrationDocument.findAll({
          where: { id: suppliedIds, registrationId: id },
          transaction,
        })) as any[])
      : [];
    if (existing.length !== suppliedIds.length)
      throw new AppError(
        400,
        "INVALID_DOCUMENT",
        "One or more document IDs do not belong to this registration.",
      );
    const byId = new Map(existing.map((row) => [row.id, row]));
    const retainedIds: string[] = [];
    for (const doc of docs) {
      const values = {
        registrationId: id,
        mediaAssetId: doc.mediaAssetId ?? null,
        name: doc.name.trim(),
        status: doc.status ?? "pending",
        verifiedById: doc.status === "verified" ? actorId : null,
        verifiedAt: doc.status === "verified" ? new Date() : null,
      };
      const row = doc.id ? byId.get(doc.id) : undefined;
      if (row) {
        await row.update(values, { transaction });
        retainedIds.push(row.id);
      } else {
        const created = (await models.RegistrationDocument.create(values, {
          transaction,
        })) as any;
        retainedIds.push(created.id);
      }
    }
    await models.RegistrationDocument.destroy({
      where: {
        registrationId: id,
        ...(retainedIds.length ? { id: { [Op.notIn]: retainedIds } } : {}),
      },
      transaction,
    });
    const documentStatus =
      docs.length > 0 && docs.every((doc) => doc.status === "verified")
        ? "verified"
        : docs.length === 0
          ? "not_submitted"
          : "pending";
    await row.update({ documentStatus }, { transaction });
    await writeAudit({
      actorId,
      action: "registration.documents_updated",
      entityName: "Registration",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
  });
  return { id };
};

export const transitionRegistration = async (
  id: string,
  nextStatus: string,
  note: string | undefined,
  actorId: string,
  ip?: string,
) => {
  await sequelize.transaction(async (transaction) => {
    const row = (await models.Registration.unscoped().findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!row) throw new AppError(404, "NOT_FOUND", "Registration not found.");
    if (!isAllowedRegistrationTransition(row.status, nextStatus))
      throw new AppError(
        409,
        "INVALID_STATUS_TRANSITION",
        `Registration cannot move from ${row.status} to ${nextStatus}.`,
      );
    const reviewer = await models.StaffAccount.findByPk(actorId, {
      transaction,
    });
    await row.update(
      {
        status: nextStatus,
        assignedReviewerId: row.assignedReviewerId ?? actorId,
        reviewedAt: new Date(),
      },
      { transaction },
    );
    await models.RegistrationStatusHistory.create(
      { registrationId: id, status: nextStatus, note: note ?? null, actorId },
      { transaction },
    );
    await writeAudit({
      actorId,
      action: `registration.${nextStatus}`,
      entityName: "Registration",
      recordId: id,
      reason: reviewer ? undefined : "reviewer_missing",
      transaction,
      ipAddress: ip,
    });
    if (nextStatus === "rejected" || nextStatus === "information_required")
      await enqueueNotificationEvent(`registration.${nextStatus}`, "registration", id, transaction, { note: note ?? "" });
  });
  return { id };
};

const attachGuardian = async (
  row: any,
  player: any,
  transaction: Transaction,
  actorId: string,
) => {
  let guardian = await guardianByPhone(row.guardianPhone, transaction);
  if (!guardian) {
    guardian = await models.Guardian.unscoped().create(
      {
        fullName: row.guardianName.trim(),
        phone: row.guardianPhone.trim(),
        email: row.guardianEmail?.trim().toLowerCase() ?? null,
        address: row.guardianAddress ?? null,
        preferredContact: "phone",
        accountStatus: "active",
        consentStatus: row.consentData ? "granted" : "pending",
      },
      { transaction },
    );
  }
  row.guardianId = guardian.id;
  await row.save({ transaction });
  await models.PlayerGuardian.update(
    { isPrimary: false },
    { where: { playerId: player.id, isPrimary: true }, transaction },
  );
  const existing = (await models.PlayerGuardian.findOne({
    where: { playerId: player.id, guardianId: guardian.id },
    transaction,
  })) as any;
  if (existing)
    await existing.update(
      { relationship: "guardian", isPrimary: true, isEmergencyContact: true },
      { transaction },
    );
  else
    await models.PlayerGuardian.create(
      {
        playerId: player.id,
        guardianId: guardian.id,
        relationship: "guardian",
        isPrimary: true,
        isEmergencyContact: true,
      },
      { transaction },
    );
  await writeAudit({
    actorId,
    action: "guardian.player_linked",
    entityName: "PlayerGuardian",
    recordId: `${player.id}:${guardian.id}`,
    transaction,
  });
  return guardian;
};

export const approveRegistration = async (
  id: string,
  input: {
    note?: string;
    existingPlayerId?: string;
    confirmNewPlayer?: boolean;
  },
  actorId: string,
  ip?: string,
) => {
  const result = await sequelize.transaction(async (transaction) => {
    const row = (await models.Registration.unscoped().findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    })) as any;
    if (!row) throw new AppError(404, "NOT_FOUND", "Registration not found.");
    if (row.linkedPlayerId)
      return {
        playerId: row.linkedPlayerId,
        created: false,
        alreadyApproved: true,
      };
    if (!allowedTransitions[row.status]?.includes("approved"))
      throw new AppError(
        409,
        "INVALID_STATUS_TRANSITION",
        `Registration cannot be approved from ${row.status}.`,
      );
    requiredRegistrationFields(row);
    await assertOperationalSelections(
      row.centreId,
      row.programmeId,
      transaction,
    );
    const programme = row.programmeId
      ? ((await models.Programme.findByPk(row.programmeId, {
          transaction,
        })) as any)
      : null;
    if (programme) {
      const age = ageOnDate(row.childDateOfBirth);
      if (
        (programme.ageMin !== null &&
          programme.ageMin !== undefined &&
          age < programme.ageMin) ||
        (programme.ageMax !== null &&
          programme.ageMax !== undefined &&
          age > programme.ageMax)
      )
        throw new AppError(
          409,
          "PROGRAMME_AGE_INELIGIBLE",
          "The child does not meet the selected programme age requirements.",
        );
    }
    await lockPotentialDuplicate(row, transaction);
    const candidates = (await playerCandidates(row, transaction)) as any[];
    let player: any;
    let created = false;
    if (input.existingPlayerId) {
      player = candidates.find(
        (candidate) => candidate.id === input.existingPlayerId,
      );
      if (!player || player.archived)
        throw new AppError(
          400,
          "INVALID_EXISTING_PLAYER",
          "The selected existing player does not match this registration or is archived.",
        );
    } else if (candidates.length && !input.confirmNewPlayer) {
      throw new AppError(
        409,
        "POSSIBLE_DUPLICATE_PLAYER",
        "A player with the same name and date of birth exists. Explicitly link a matching player or confirm creating a new record.",
        {
          candidates: candidates.map((candidate) => ({
            id: candidate.id,
            playerCode: candidate.playerCode,
            archived: candidate.archived,
          })),
        },
      );
    } else {
      if (input.confirmNewPlayer !== true && candidates.length)
        throw new AppError(
          409,
          "POSSIBLE_DUPLICATE_PLAYER",
          "Explicitly confirm creation when matching player records exist.",
        );
      player = (await models.Player.unscoped().create(
        {
          playerCode: await generateAcademyCode("player", transaction),
          fullName: row.childName.trim(),
          dateOfBirth: row.childDateOfBirth,
          ageGroup:
            row.ageGroup || ageGroupFor(ageOnDate(row.childDateOfBirth)),
          centreId: row.centreId,
          programmeId: row.programmeId,
          registrationStatus: "registered",
          scholarshipStatus:
            row.pathway === "scholarship_assessment" ? "applicant" : "none",
          documentVerification:
            row.documentStatus === "verified" ? "verified" : "pending",
          matchAppearances: 0,
          archived: false,
          registrationId: id,
        },
        { transaction },
      )) as any;
      created = true;
    }
    if (
      !player.registrationStatus ||
      ["prospective", "waitlisted"].includes(player.registrationStatus)
    )
      await player.update(
        { registrationStatus: "registered" },
        { transaction },
      );
    if (!player.centreId && row.centreId)
      await player.update({ centreId: row.centreId }, { transaction });
    if (!player.programmeId && row.programmeId)
      await player.update({ programmeId: row.programmeId }, { transaction });
    if (
      row.documentStatus === "verified" &&
      player.documentVerification === "pending"
    )
      await player.update(
        { documentVerification: "verified" },
        { transaction },
      );

    const guardian = await attachGuardian(row, player, transaction, actorId);
    const consentDate = new Date().toISOString().slice(0, 10);
    const consents: Array<[string, boolean]> = [
      ["media_photography", row.consentMedia],
      ["data_processing", row.consentData],
      ["medical", row.consentMedical],
    ];
    for (const [consentType, granted] of consents)
      if (granted)
        await models.ConsentRecord.create(
          {
            subjectType: "player",
            playerId: player.id,
            guardianId: null,
            consentType,
            status: "granted",
            grantedAt: consentDate,
            notes: `Recorded during registration ${row.reference}`,
          },
          { transaction },
        );
    await row.update(
      {
        status: "approved",
        linkedPlayerId: player.id,
        guardianId: guardian.id,
        assignedReviewerId: actorId,
        reviewedAt: new Date(),
      },
      { transaction },
    );
    await models.RegistrationStatusHistory.create(
      {
        registrationId: id,
        status: "approved",
        note:
          input.note?.slice(0, 1000) ??
          "Registration approved and player linked",
        actorId,
      },
      { transaction },
    );
    await writeAudit({
      actorId,
      action: "registration.approved",
      entityName: "Registration",
      recordId: id,
      transaction,
      ipAddress: ip,
    });
    await enqueueNotificationEvent("registration.approved", "registration", id, transaction);
    await writeAudit({
      actorId,
      action: created
        ? "player.created_from_registration"
        : "player.linked_to_registration",
      entityName: "Player",
      recordId: player.id,
      transaction,
      ipAddress: ip,
    });
    return {
      playerId: player.id,
      playerCode: player.playerCode,
      created,
      alreadyApproved: false,
    };
  });
  return result;
};
