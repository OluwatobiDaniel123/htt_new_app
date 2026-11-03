import { z } from "zod";

export const coachingApprenticeStatuses = [
  "pending",
  "under_review",
  "shortlisted",
  "accepted",
  "declined",
] as const;

export const coachingApprenticeApplicationBody = z
  .object({
    fullName: z.string().trim().min(1).max(160),
    phoneNumber: z
      .string()
      .trim()
      .min(5)
      .max(40)
      .regex(/^[+0-9() .-]+$/),
    email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
    location: z.string().trim().min(1).max(160),
  })
  .strict();

export const coachingApprenticeStatusBody = z
  .object({
    status: z.enum(coachingApprenticeStatuses),
  })
  .strict();

export const coachingApprenticeIdParams = z
  .object({ id: z.string().uuid() })
  .strict();

export const coachingApprenticeListQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(coachingApprenticeStatuses).optional(),
  })
  .strict();

export type CoachingApprenticeApplicationInput = z.infer<
  typeof coachingApprenticeApplicationBody
>;
