/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash, randomUUID } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import type { PublicIntakeInput, PublicRegistration } from "../validation/publicIntakeSchemas.js";
import { ageGroupFor, ageOnDate, generateAcademyCode } from "./academyShared.js";
import { writeAudit } from "./auditService.js";
import { enqueueNotificationEvent } from "./notificationService.js";
import { createRegistration } from "./registrationService.js";
import type { RegistrationImage } from "../middleware/publicRegistrationUpload.js";
import { uploadRegistrationProfileImage, deleteRegistrationProfileImage } from "./mediaService.js";
import { initializePayment } from "./paymentService.js";

const activeCentreStates = ["open_for_registration", "assessments_open"];
export const PUBLIC_REGISTRATION_FEE = 40_000;
const publicPaymentReferencePattern = /^[A-Za-z0-9=.-]{20,160}$/;
const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
};

const isDatabaseUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const resolvePublicSelections = async (centreRef?: string, programmeRef?: string, transaction?: Transaction) => {
  const centre = centreRef
    ? await models.Centre.findOne({
        where: {
          [isDatabaseUuid(centreRef) ? "id" : "slug"]: centreRef,
          status: { [Op.in]: activeCentreStates }, reviewStatus: "approved", proposedArea: false,
        },
        attributes: ["id", "name"], transaction,
      })
    : null;
  if (centreRef && !centre) throw new AppError(400, "INVALID_CENTRE", "That centre is not open for registration.");

  const programme = programmeRef
    ? await models.Programme.findOne({
        where: { [isDatabaseUuid(programmeRef) ? "id" : "slug"]: programmeRef, status: "active" },
        attributes: ["id", "name", "approvedFee", "currency", "availability"], transaction,
      })
    : null;
  if (programmeRef && !programme) throw new AppError(400, "INVALID_PROGRAMME", "That programme is not available.");
  if (programme?.availability === "closed") throw new AppError(400, "PROGRAMME_UNAVAILABLE", "The selected programme is closed for registration.");
  if (centre && programme && !(await models.CentreProgramme.findOne({
    where: { centreId: centre.id, programmeId: programme.id }, transaction,
  }))) {
    throw new AppError(400, "PROGRAMME_NOT_AT_CENTRE", "That programme is not available at the selected centre.");
  }
  return { centreId: centre?.id, programmeId: programme?.id };
};

export const getPublicPaymentSummary = async (reference: string) => {
  if (!publicPaymentReferencePattern.test(reference))
    throw new AppError(400, "INVALID_PAYMENT_REFERENCE", "A valid payment reference is required.");
  const payment = await models.Payment.unscoped().findOne({
    where: { [Op.or]: [{ reference }, { gatewayReference: reference }] },
    attributes: ["id", "reference", "registrationId", "method", "purpose", "amount", "currency", "status", "providerStatus", "verifiedAt", "metadata"],
  }) as any;
  if (!payment || payment.method !== "paystack" || payment.purpose !== "registration" || !payment.registrationId)
    throw new AppError(404, "PUBLIC_PAYMENT_NOT_FOUND", "The registration payment was not found.");
  const registration = await models.Registration.unscoped().findByPk(payment.registrationId, {
    attributes: ["id", "childName", "centreId", "programmeId", "amountDue", "amountDueCurrency"],
  }) as any;
  if (!registration)
    throw new AppError(404, "PUBLIC_PAYMENT_NOT_FOUND", "The registration payment was not found.");
  const [centre, programme] = await Promise.all([
    registration.centreId ? models.Centre.findByPk(registration.centreId, { attributes: ["name"] }) : null,
    registration.programmeId ? models.Programme.findByPk(registration.programmeId, { attributes: ["name"] }) : null,
  ]);
  return {
    registration: {
      id: registration.id,
      playerName: registration.childName,
      centreName: (centre as any)?.name ?? null,
      programmeName: (programme as any)?.name ?? null,
    },
    payment: {
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      providerStatus: payment.providerStatus ?? null,
      verifiedAt: payment.verifiedAt ?? null,
      authorizationUrl: payment.status === "pending" ? payment.metadata?.checkoutUrl ?? null : null,
    },
  };
};

export const getPublicReferenceData = async () => {
  const [centres, programmes, stories] = await Promise.all([
    models.Centre.findAll({
      where: { status: { [Op.in]: activeCentreStates }, reviewStatus: "approved", proposedArea: false },
      attributes: ["id", "name", "code", "area", "address", "mapLink", "schedule", "ageGroups", "capacity", "status"],
      order: [["name", "ASC"]],
      limit: 100,
    }),
    models.Programme.findAll({
      where: { status: "active", availability: { [Op.ne]: "closed" } },
      attributes: ["id", "name", "code", "description", "ageGroupLabel", "approvedFee", "schedule", "availability"],
      order: [["name", "ASC"]],
      limit: 50,
    }),
    models.Story.findAll({
      where: { status: "published" },
      attributes: ["id", "title", "category", "description", "publicationDate"],
      include: [{ model: models.Centre, as: "centre", attributes: ["name"], required: false }],
      order: [["publicationDate", "DESC"]],
      limit: 20,
    }),
  ]);
  return {
    centres: centres.map((centre) => ({
      id: centre.id, name: centre.name, code: centre.code, area: centre.area,
      address: centre.address || "", map_link: centre.mapLink || "",
      schedule: centre.schedule || "", age_groups: centre.ageGroups || [],
      capacity: centre.capacity || null, status: centre.status,
    })),
    programmes: programmes.map((programme) => ({
      id: programme.id, name: programme.name, code: programme.code || "",
      description: programme.description || "", age_group_label: programme.ageGroupLabel,
      approved_fee: programme.approvedFee || null, schedule: programme.schedule || "",
      availability: programme.availability,
    })),
    stories: stories.map((story) => ({
      id: story.id, title: story.title, category: story.category,
      description: story.description || "", publication_date: story.publicationDate || null,
      centre_name: story.centre?.name || "",
    })),
  };
};

export const submitPublicRegistration = async (
  input: Extract<PublicIntakeInput, { action: "submit_registration" }>["registration"],
  ip?: string,
  image?: RegistrationImage,
) => {
  if ("centre" in input) {
    if (!image) throw new AppError(400, "PROFILE_IMAGE_REQUIRED", "A profile picture is required.");
    return submitAcademyRegistration(input, image, ip);
  }
  const fingerprint = createHash("sha256").update(stableJson(input)).digest("hex");
  const prior = await models.Registration.unscoped().findOne({ where: { submissionFingerprint: fingerprint } }) as any;
  if (prior) return initializePublicPayment(prior, fingerprint, ip, true);
  const selected = await resolvePublicSelections(input.centre_id, input.programme_id);
  const centreId = selected.centreId;
  const programmeId = selected.programmeId;
  const ageGroup = input.age_group || (input.child_date_of_birth
    ? ageGroupFor(ageOnDate(input.child_date_of_birth))
    : undefined);
  let created: any;
  try {
    const createdSummary = await createRegistration({
    guardianName: input.guardian_name,
    guardianEmail: input.guardian_email || undefined,
    guardianPhone: input.guardian_phone,
    guardianAddress: input.guardian_address,
    childName: input.child_name,
    childDateOfBirth: input.child_date_of_birth || undefined,
    centreId,
    programmeId,
    ageGroup: ageGroup || undefined,
    pathway: input.pathway || "paid_academy",
    consentMedia: input.consent_media === true,
    consentData: input.consent_data === true,
    consentMedical: input.consent_medical === true,
    }, null, ip, "public_website", fingerprint);
    created = await models.Registration.unscoped().findByPk(createdSummary.id);
    if (!created) throw new AppError(500, "REGISTRATION_RELOAD_FAILED", "The public registration was created but could not be loaded for payment setup.");
  } catch (error) {
    if ((error as any)?.name === "SequelizeUniqueConstraintError") {
      const duplicate = await models.Registration.unscoped().findOne({ where: { submissionFingerprint: fingerprint } }) as any;
      if (duplicate) return initializePublicPayment(duplicate, fingerprint, ip, true);
    }
    throw error;
  }
  return initializePublicPayment(created, fingerprint, ip, false);
};

const submitAcademyRegistration = async (input: PublicRegistration, image: RegistrationImage, ip?: string) => {
  const fingerprint = createHash("sha256").update(stableJson(input)).update(image.buffer).digest("hex");
  const previous = await models.Registration.unscoped().findOne({ where: { submissionFingerprint: fingerprint } }) as any;
  if (previous) return initializePublicPayment(previous, fingerprint, ip, true);

  const selected = await resolvePublicSelections(input.centre.uuid, input.programme.uuid);
  const centreId = selected.centreId;
  const programmeId = selected.programmeId;
  if (!centreId || !programmeId) throw new AppError(400, "INVALID_SELECTION", "A centre and programme are required.");
  const uploaded = await uploadRegistrationProfileImage(image);
  let registration: any;
  try {
    registration = await sequelize.transaction(async (transaction) => {
      const centre = await models.Centre.findOne({
        where: { id: centreId, status: { [Op.in]: activeCentreStates }, reviewStatus: "approved", proposedArea: false },
        transaction, lock: transaction.LOCK.UPDATE,
      }) as any;
      const programme = await models.Programme.findOne({
        where: { id: programmeId, status: "active" }, transaction, lock: transaction.LOCK.UPDATE,
        attributes: ["id", "name", "approvedFee", "currency", "availability"],
      }) as any;
      if (!centre) throw new AppError(400, "INVALID_CENTRE", "That centre is not open for registration.");
      if (!programme) throw new AppError(400, "INVALID_PROGRAMME", "That programme is not available.");
      if (programme.availability === "closed") throw new AppError(400, "PROGRAMME_UNAVAILABLE", "The selected programme is closed for registration.");
      if (String(programme.currency || "NGN").trim().toUpperCase() !== "NGN")
        throw new AppError(409, "PAYMENT_CURRENCY_UNSUPPORTED", "Public registration payments currently support NGN only.");
      const link = await models.CentreProgramme.findOne({ where: { centreId, programmeId }, transaction });
      if (!link) throw new AppError(400, "PROGRAMME_NOT_AT_CENTRE", "That programme is not available at the selected centre.");
      const asset = await models.MediaAsset.create({
        ownerId: null, storageProvider: "cloudinary", providerAssetId: uploaded.providerAssetId,
        secureUrl: uploaded.secureUrl, resourceType: "image", mimeType: image.mimeType,
        byteSize: uploaded.byteSize, originalName: image.originalName, access: "private",
        metadata: { purpose: "player_profile", accessType: "authenticated" },
      }, { transaction }) as any;
      const amountDue = PUBLIC_REGISTRATION_FEE;
      const row = await models.Registration.unscoped().create({
        reference: await generateAcademyCode("registration", transaction),
        guardianName: input.guardian.name.trim(), guardianEmail: input.guardian.email.trim().toLowerCase() || null,
        guardianPhone: input.guardian.phone.trim(), guardianAddress: input.guardian.address || null,
        guardianRelationship: input.guardian.relationship, guardianAlternativePhone: input.guardian.alternativePhone || null,
        emergencyContactName: input.emergencyContact.name.trim(), emergencyContactPhone: input.emergencyContact.phone.trim(),
        childName: input.player.name.trim(), childDateOfBirth: input.player.dob, childGender: input.player.gender,
        childSchool: input.player.school || null, childClassName: input.player.className || null, childPositionUuid: input.player.positionUuid || null,
        centreId, programmeId, centreNameSnapshot: centre.name,
        programmeTitleSnapshot: programme.name, programmeBaseFeeSubmitted: input.programme.baseFee,
        paymentFrequency: input.payment.frequency, paymentFeeSubmitted: input.payment.fee, publicPayload: input,
        submissionFingerprint: fingerprint, profileImageAssetId: asset.id, amountDueCurrency: String(programme.currency || "NGN").trim().toUpperCase(),
        amountDue, paymentStatus: "unpaid", documentStatus: "pending", pathway: "paid_academy",
        status: "submitted", source: "public_website", submittedAt: new Date(), consentData: false,
        consentMedical: input.consentMedical ?? false,
      }, { transaction }) as any;
      const player = await models.Player.unscoped().create({
        playerCode: await generateAcademyCode("player", transaction), officialPlayerId: null,
        fullName: input.player.name.trim(), dateOfBirth: input.player.dob,
        ageGroup: ageGroupFor(ageOnDate(input.player.dob)), centreId, programmeId,
        registrationStatus: "pending", scholarshipStatus: "none", documentVerification: "pending",
        school: input.player.school || null, gender: input.player.gender, className: input.player.className || null,
        positionUuid: input.player.positionUuid || null, profileImageAssetId: asset.id,
        matchAppearances: 0, archived: false, registrationId: row.id,
      }, { transaction }) as any;
      await row.update({ linkedPlayerId: player.id }, { transaction });
      await models.EmergencyContact.create({ registrationId: row.id, playerId: player.id, fullName: input.emergencyContact.name.trim(), phone: input.emergencyContact.phone.trim() }, { transaction });
      await models.RegistrationDocument.create({ registrationId: row.id, mediaAssetId: asset.id, name: "Player profile picture", status: "pending" }, { transaction });
      await models.RegistrationStatusHistory.create({ registrationId: row.id, status: "submitted", note: "Submitted through the public website", actorId: null }, { transaction });
      await writeAudit({ actorId: null, action: "registration.public_submitted", entityName: "Registration", recordId: row.id, transaction, ipAddress: ip });
      await enqueuePublicRegistrationNotification(row.id, transaction);
      return row;
    });
  } catch (error) {
    await deleteRegistrationProfileImage(uploaded.providerAssetId);
    if ((error as any)?.name === "SequelizeUniqueConstraintError") {
      const duplicate = await models.Registration.unscoped().findOne({ where: { submissionFingerprint: fingerprint } }) as any;
      if (duplicate) return initializePublicPayment(duplicate, fingerprint, ip, true);
    }
    throw error;
  }
  return initializePublicPayment(registration, fingerprint, ip, false);
};

const enqueuePublicRegistrationNotification = async (registrationId: string, transaction: Transaction) => {
  await enqueueNotificationEvent("registration.received", "registration", registrationId, transaction);
};

const initializePublicPayment = async (registration: any, fingerprint: string, ip: string | undefined, duplicate: boolean) => {
  if (!(Number(registration.amountDue ?? 0) > 0) || !registration.guardianEmail) {
    throw new AppError(409, "REGISTRATION_PAYMENT_NOT_CONFIGURED", "A valid payer email and positive registration fee are required before registration can be submitted.");
  }
  let initialized: any;
  try {
    initialized = await initializePayment({ registrationId: registration.id, purpose: "registration", idempotencyKey: `public-registration-${fingerprint}` }, null, ip);
  } catch (error) {
    throw new AppError(503, error instanceof AppError ? error.code : "PAYMENT_INITIALIZATION_FAILED", "Registration was recorded, but payment setup did not complete. Retry the same submission to recover its payment status.", { registrationId: registration.id, registrationReference: registration.reference, duplicate });
  }
  const needsVerification = initialized.needsVerification === true || initialized.payment.providerStatus === "initialization_unknown";
  if (needsVerification || !initialized.authorizationUrl) {
    throw new AppError(503, needsVerification ? "PAYMENT_INITIALIZATION_UNKNOWN" : "AUTHORIZATION_URL_UNAVAILABLE", "Registration was recorded, but no checkout link is available yet. Retry the same submission to recover its payment status; do not submit a different registration.", {
      registrationId: registration.id,
      registrationReference: registration.reference,
      paymentReference: initialized.payment.reference,
      needsVerification,
      duplicate,
    });
  }
  const payment = {
    reference: initialized.payment.reference,
    amount: initialized.payment.amount,
    currency: initialized.payment.currency,
    status: initialized.payment.status,
    providerStatus: initialized.payment.providerStatus,
    authorizationUrl: initialized.authorizationUrl,
    duplicate: initialized.duplicate,
    needsVerification: false,
  };
  return {
    id: registration.id, registrationId: registration.id, reference: registration.reference, status: registration.status,
    playerId: registration.linkedPlayerId,
    paymentReference: payment.reference,
    payment,
    duplicate,
  };
};

export const submitPublicEnquiry = async (
  input: Extract<PublicIntakeInput, { action: "submit_enquiry" }>,
  ip?: string,
) => sequelize.transaction(async (transaction) => {
  const enquiry = await models.Enquiry.create({
    contactName: input.contact_name,
    email: input.email || null,
    phone: input.phone || null,
    type: input.type || "general",
    source: "website",
    status: "new",
    priority: "medium",
    subject: input.subject || null,
    message: input.message || null,
    consentToContact: input.consent_to_contact !== false,
  }, { transaction });
  await writeAudit({ actorId: null, action: "enquiry.public_submitted", entityName: "Enquiry", recordId: enquiry.id, ipAddress: ip, transaction });
  return { id: enquiry.id, status: enquiry.status };
});

export const submitPublicScholarship = async (
  input: Extract<PublicIntakeInput, { action: "submit_scholarship" }>,
  ip?: string,
) => {
  const centreId = input.centre_id || undefined;
  const programmeId = input.programme_id || undefined;
  await resolvePublicSelections(centreId, programmeId);
  return sequelize.transaction(async (transaction) => {
    const application = await models.ScholarshipApplication.create({
      reference: `HTT-SCH-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
      applicantName: input.applicant_name,
      guardianName: input.guardian_name,
      guardianEmail: input.guardian_email || null,
      guardianPhone: input.guardian_phone || null,
      centreId: centreId || null,
      programmeId: programmeId || null,
      notes: input.notes || null,
      status: "received",
    }, { transaction });
    await writeAudit({ actorId: null, action: "scholarship.public_submitted", entityName: "ScholarshipApplication", recordId: application.id, ipAddress: ip, transaction });
    return { reference: application.reference, status: application.status };
  });
};

export const submitPublicSponsorship = async (
  input: Extract<PublicIntakeInput, { action: "submit_sponsorship" }>,
  ip?: string,
) => sequelize.transaction(async (transaction) => {
  const enquiry = await models.SponsorshipEnquiry.create({
    contactName: input.contact_name,
    organisation: input.organisation || null,
    email: input.email || null,
    phone: input.phone || null,
    category: input.category || "corporate_partnership",
    proposedAmount: input.proposed_amount || 0,
    status: "new",
    priority: "medium",
    notes: input.notes || null,
    source: "public_website",
  }, { transaction });
  await writeAudit({ actorId: null, action: "sponsorship.public_submitted", entityName: "SponsorshipEnquiry", recordId: enquiry.id, ipAddress: ip, transaction });
  return { id: enquiry.id, status: enquiry.status };
});
