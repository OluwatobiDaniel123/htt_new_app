import { z } from "zod";

const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().max(max).optional().default("");
const email = z.string().trim().email().max(320).optional().or(z.literal(""));
const nonnegativeAmount = z.union([
  z.number().finite().min(0).max(1_000_000_000),
  z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number),
]).optional().default(0);

const registration = z.object({
  child_name: z.string().trim().min(1).max(120),
  guardian_name: z.string().trim().min(1).max(120),
  guardian_phone: z.string().trim().min(5).max(40).regex(/^[+0-9() .-]+$/),
  guardian_email: email,
  guardian_address: text(240),
  child_date_of_birth: z.string().date().optional().or(z.literal("")),
  centre_id: uuid.optional().or(z.literal("")),
  programme_id: uuid.optional().or(z.literal("")),
  age_group: z.enum(["8-10", "11-12", "13-14", "other"]).optional().or(z.literal("")),
  pathway: z.enum(["paid_academy", "scholarship_assessment"]).optional(),
  consent_media: z.boolean().optional(),
  consent_data: z.boolean().optional(),
  consent_medical: z.boolean().optional(),
}).strict();

export const publicIntakeBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reference_data") }).strict(),
  z.object({ action: z.literal("submit_registration"), registration }).strict(),
  z.object({
    action: z.literal("submit_enquiry"),
    contact_name: z.string().trim().min(1).max(120),
    email,
    phone: text(40),
    type: z.enum(["general", "registration", "assessment", "callback", "partnership", "sponsorship", "school_project"]).optional(),
    subject: text(160),
    message: text(2000),
    consent_to_contact: z.boolean().optional(),
  }).strict(),
  z.object({
    action: z.literal("submit_scholarship"),
    applicant_name: z.string().trim().min(1).max(120),
    guardian_name: z.string().trim().min(1).max(120),
    guardian_email: email,
    guardian_phone: text(40),
    centre_id: uuid.optional().or(z.literal("")),
    programme_id: uuid.optional().or(z.literal("")),
    notes: text(1000),
  }).strict(),
  z.object({
    action: z.literal("submit_sponsorship"),
    contact_name: z.string().trim().min(1).max(120),
    organisation: text(160),
    email,
    phone: text(40),
    category: z.enum(["individual_player", "scholarship_fund", "school_project", "corporate_partnership"]).optional(),
    proposed_amount: nonnegativeAmount,
    notes: text(1000),
  }).strict(),
]);

export type PublicIntakeInput = z.infer<typeof publicIntakeBody>;
