/* eslint-disable @typescript-eslint/no-explicit-any */
import { Op, col, fn, where, type Transaction } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import { writeAudit } from "./auditService.js";
import { enqueueNotificationEvent } from "./notificationService.js";
import { moneyMinor } from "./paymentService.js";
import { signedRegistrationImageUrl } from "./mediaService.js";
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
    attributes: ["id", "playerCode", "officialPlayerId", "fullName", "dateOfBirth", "ageGroup", "gender", "school", "className", "positionUuid", "registrationStatus"],
  },
  {
    model: models.Guardian.unscoped(),
    as: "guardian",
    attributes: ["id", "fullName", "email", "phone", "alternativePhone"],
  },
];
const registrationDetailIncludes = [
  ...registrationIncludes,
  {
    model: models.EmergencyContact,
    as: "emergencyContact",
    attributes: ["id", "fullName", "phone"],
    required: false,
  },
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
    model: models.Payment,
    as: "paymentRecords",
    attributes: ["id", "reference", "amount", "currency", "status", "providerStatus", "verifiedAt", "verifiedAmount", "verifiedCurrency", "paidAt", "expiresAt", "createdAt"],
    required: false,
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
  "childGender", "childSchool", "childClassName", "childPositionUuid",
  "guardianRelationship", "guardianAlternativePhone", "emergencyContactName", "emergencyContactPhone",
  "internalNotes",
];
const registrationFieldAccess = (field: string, access: { playerData: boolean; guardianData: boolean; internal?: boolean }) => {
  if (field.startsWith("child")) return access.playerData;
  if (field.startsWith("guardian") || field.startsWith("emergency")) return access.guardianData;
  return access.internal === true;
};
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
    for (const field of ["childGender", "childSchool", "childClassName", "childPositionUuid"]) json[field] = undefined;
    if (json.player) for (const field of ["fullName", "dateOfBirth", "gender", "school", "className", "positionUuid"]) json.player[field] = undefined;
  }
  if (!canSeeGuardian) {
    json.guardianName = undefined;
    json.guardianEmail = undefined;
    json.guardianPhone = undefined;
    json.guardianAddress = undefined;
    json.guardianRelationship = undefined;
    json.guardianAlternativePhone = undefined;
    json.emergencyContactName = undefined;
    json.emergencyContactPhone = undefined;
  }
  if (!canSeeInternal) json.internalNotes = undefined;
  if (!canSeeInternal) json.publicPayload = undefined;
  delete json.submissionFingerprint;
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
    json.guardian.alternativePhone = undefined;
  }
  if (json.emergencyContact && !canSeeGuardian) json.emergencyContact = undefined;
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

export const approvalYearInLagos = (date = new Date()) => Number(new Intl.DateTimeFormat("en", { timeZone: "Africa/Lagos", year: "numeric" }).format(date));
export const formatOfficialPlayerId = (year: number, sequence: number) => `HTT-${year}-${String(sequence).padStart(6, "0")}`;

const allocateOfficialPlayerId = async (transaction: Transaction) => {
  const year = approvalYearInLagos();
  await sequelize.query(
    "INSERT INTO player_id_counters (approval_year, last_sequence) VALUES (:year, 0) ON CONFLICT (approval_year) DO NOTHING",
    { replacements: { year }, transaction },
  );
  const counter = await models.PlayerIdCounter.findOne({ where: { approvalYear: year }, transaction, lock: transaction.LOCK.UPDATE }) as any;
  if (!counter) throw new AppError(500, "PLAYER_ID_COUNTER_FAILED", "Player ID sequence could not be allocated.");
  const sequence = Number(counter.lastSequence) + 1;
  await counter.update({ lastSequence: sequence }, { transaction });
  return formatOfficialPlayerId(year, sequence);
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
  const attributes = fullPersonalFields.filter((field) => registrationFieldAccess(field, access));
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
      "amountDueCurrency",
      "paymentReference",
      "assignedReviewerId",
      "submittedAt",
      "reviewedAt",
      "status",
      "source",
      "linkedPlayerId",
      "guardianId",
      "centreNameSnapshot", "programmeTitleSnapshot", "programmeBaseFeeSubmitted", "paymentFrequency", "paymentFeeSubmitted",
      "profileImageAssetId",
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
  const attributes = fullPersonalFields.filter((field) => registrationFieldAccess(field, access));
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
      "amountDueCurrency",
      "paymentReference",
      "assignedReviewerId",
      "submittedAt",
      "reviewedAt",
      "status",
      "source",
      "linkedPlayerId",
      "guardianId",
      "centreNameSnapshot", "programmeTitleSnapshot", "programmeBaseFeeSubmitted", "paymentFrequency", "paymentFeeSubmitted",
      "profileImageAssetId",
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

export const getRegistrationProfileImageUrl = async (id: string) => {
  const registration = await models.Registration.unscoped().findByPk(id, { attributes: ["id", "profileImageAssetId"] }) as any;
  if (!registration?.profileImageAssetId) throw new AppError(404, "PROFILE_IMAGE_NOT_FOUND", "The profile image is unavailable.");
  const asset = await models.MediaAsset.findByPk(registration.profileImageAssetId, { attributes: ["providerAssetId", "secureUrl", "access"] }) as any;
  if (!asset || asset.access !== "private") throw new AppError(404, "PROFILE_IMAGE_NOT_FOUND", "The profile image is unavailable.");
  return signedRegistrationImageUrl(asset.secureUrl, asset.providerAssetId);
};

export const createRegistration = async (
  input: any,
  actorId: string | null,
  ip?: string,
  source = "admin",
  submissionFingerprint?: string,
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
    if (source === "public_website") {
      if (!programme || moneyMinor(programme.approvedFee ?? 0) <= 0n)
        throw new AppError(409, "PAYMENT_AMOUNT_NOT_CONFIGURED", "A positive programme fee must be configured before public registration.");
      if (String(programme.currency || "NGN").trim().toUpperCase() !== "NGN")
        throw new AppError(409, "PAYMENT_CURRENCY_UNSUPPORTED", "Public registration payments currently support NGN only.");
    }
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
        amountDueCurrency: programme?.currency ?? "NGN",
        status,
        source,
        ...(submissionFingerprint ? { submissionFingerprint } : {}),
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
      updates.amountDueCurrency = programme?.currency ?? "NGN";
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
    if (nextStatus === "rejected" && row.linkedPlayerId) {
      const pendingPlayer = await models.Player.unscoped().findByPk(row.linkedPlayerId, { transaction, lock: transaction.LOCK.UPDATE }) as any;
      if (pendingPlayer && pendingPlayer.registrationStatus === "pending")
        await pendingPlayer.update({ registrationStatus: "rejected" }, { transaction });
    }
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
        alternativePhone: row.guardianAlternativePhone ?? null,
        preferredContact: "phone",
        accountStatus: "active",
        consentStatus: row.consentData ? "granted" : "pending",
      },
      { transaction },
    );
  } else if (!guardian.alternativePhone && row.guardianAlternativePhone) {
    await guardian.update({ alternativePhone: row.guardianAlternativePhone }, { transaction });
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
      { relationship: row.guardianRelationship || "guardian", isPrimary: true, isEmergencyContact: false },
      { transaction },
    );
  else
    await models.PlayerGuardian.create(
      {
        playerId: player.id,
        guardianId: guardian.id,
        relationship: row.guardianRelationship || "guardian",
        isPrimary: true,
        isEmergencyContact: false,
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
    if (row.status === "approved" && row.linkedPlayerId)
      return {
        playerId: row.linkedPlayerId,
        officialPlayerId: ((await models.Player.unscoped().findByPk(row.linkedPlayerId, { transaction })) as any)?.officialPlayerId ?? null,
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
    const due = moneyMinor(row.amountDue ?? 0);
    if (due <= 0n) throw new AppError(409, "PAYMENT_AMOUNT_NOT_CONFIGURED", "A positive registration charge must be configured before approval.");
    const verifiedPayments = await models.Payment.findAll({
      where: { registrationId: id, status: { [Op.in]: ["successful", "partially_refunded"] } },
      attributes: ["amount", "currency", "refundAmount"], transaction, lock: transaction.LOCK.UPDATE,
    }) as any[];
    const currencyMismatch = verifiedPayments.some((payment) => String(payment.currency).trim().toUpperCase() !== String(row.amountDueCurrency || "NGN").trim().toUpperCase());
    if (currencyMismatch) throw new AppError(409, "PAYMENT_CURRENCY_MISMATCH", "Confirmed payments are not in the registration charge currency.");
    const amountPaid = verifiedPayments.reduce((sum, payment) => sum + moneyMinor(payment.amount) - moneyMinor(payment.refundAmount ?? 0), 0n);
    if (amountPaid < due) throw new AppError(409, "PAYMENT_NOT_CONFIRMED", "Confirmed payments do not cover the registration charge.");
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
    if (row.linkedPlayerId) {
      player = await models.Player.unscoped().findByPk(row.linkedPlayerId, { transaction, lock: transaction.LOCK.UPDATE }) as any;
      if (!player) throw new AppError(409, "LINKED_PLAYER_MISSING", "The linked pending player record could not be found.");
    } else if (input.existingPlayerId) {
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
          officialPlayerId: null,
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
          school: row.childSchool ?? null,
          gender: row.childGender ?? null,
          className: row.childClassName ?? null,
          positionUuid: row.childPositionUuid ?? null,
          profileImageAssetId: row.profileImageAssetId ?? null,
          matchAppearances: 0,
          archived: false,
          registrationId: id,
        },
        { transaction },
      )) as any;
      created = true;
    }
    if (
      player.registrationStatus !== "registered" ||
      player.archived ||
      player.archivedReason
    )
      await player.update(
        { registrationStatus: "registered", archived: false, archivedReason: null },
        { transaction },
      );
    if (!player.centreId && row.centreId)
      await player.update({ centreId: row.centreId }, { transaction });
    if (!player.programmeId && row.programmeId)
      await player.update({ programmeId: row.programmeId }, { transaction });
    if (!player.officialPlayerId)
      await player.update({ officialPlayerId: await allocateOfficialPlayerId(transaction) }, { transaction });
    if (
      row.documentStatus === "verified" &&
      player.documentVerification === "pending"
    )
      await player.update(
        { documentVerification: "verified" },
        { transaction },
      );

    const guardian = await attachGuardian(row, player, transaction, actorId);
    const emergency = await models.EmergencyContact.findOne({ where: { registrationId: id }, transaction, lock: transaction.LOCK.UPDATE }) as any;
    if (emergency) await emergency.update({ playerId: player.id }, { transaction });
    else if (row.emergencyContactName && row.emergencyContactPhone)
      await models.EmergencyContact.create({ registrationId: id, playerId: player.id, fullName: row.emergencyContactName, phone: row.emergencyContactPhone }, { transaction });
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
      officialPlayerId: player.officialPlayerId,
      created,
      alreadyApproved: false,
    };
  });
  return result;
};
