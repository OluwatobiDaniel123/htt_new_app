import { randomUUID } from "node:crypto";
import { Op } from "sequelize";
import { AppError } from "../errors/AppError.js";
import { models, sequelize } from "../models/index.js";
import type { PublicIntakeInput } from "../validation/publicIntakeSchemas.js";
import { ageGroupFor, ageOnDate } from "./academyShared.js";
import { writeAudit } from "./auditService.js";
import { createRegistration } from "./registrationService.js";

const activeCentreStates = ["open_for_registration", "assessments_open"];

const assertPublicSelections = async (centreId?: string, programmeId?: string) => {
  if (centreId) {
    const centre = await models.Centre.findOne({
      where: { id: centreId, status: { [Op.in]: activeCentreStates }, reviewStatus: "approved", proposedArea: false },
      attributes: ["id"],
    });
    if (!centre) throw new AppError(400, "INVALID_CENTRE", "That centre is not open for registration.");
  }
  if (programmeId) {
    const programme = await models.Programme.findOne({
      where: { id: programmeId, status: "active" },
      attributes: ["id"],
    });
    if (!programme) throw new AppError(400, "INVALID_PROGRAMME", "That programme is not available.");
    if (centreId && !(await models.CentreProgramme.findOne({ where: { centreId, programmeId } }))) {
      throw new AppError(400, "PROGRAMME_NOT_AT_CENTRE", "That programme is not available at the selected centre.");
    }
  }
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
      where: { status: "active" },
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
) => {
  const centreId = input.centre_id || undefined;
  const programmeId = input.programme_id || undefined;
  await assertPublicSelections(centreId, programmeId);
  const ageGroup = input.age_group || (input.child_date_of_birth
    ? ageGroupFor(ageOnDate(input.child_date_of_birth))
    : undefined);
  return createRegistration({
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
  }, null, ip, "public_website");
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
  await assertPublicSelections(centreId, programmeId);
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
