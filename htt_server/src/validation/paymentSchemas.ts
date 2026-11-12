import { z } from 'zod';

const uuid = z.string().uuid();
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
}, 'Expected calendar date.');
const money = z.union([z.number(), z.string()]).refine((v) => /^\d+(\.\d{1,2})?$/.test(String(v)) && Number(v) > 0, 'Expected positive amount with up to two decimal places.');
export const initializePaymentBody = z.object({ registrationId: uuid, idempotencyKey: z.string().min(8).max(120), purpose: z.enum(['registration','programme_fee']).default('registration') }).strict();
export const manualPaymentBody = z.object({
  registrationId: uuid.optional(), playerId: uuid.optional(), guardianId: uuid.optional(), programmeId: uuid.optional(), centreId: uuid.optional(),
  playerName: z.string().max(200).optional(), payerName: z.string().min(1).max(200), payerEmail: z.string().email().max(320).optional(),
  amount: money, currency: z.literal('NGN').default('NGN'), method: z.enum(['bank_transfer','cash','pos']), idempotencyKey: z.string().min(8).max(120),
  purpose: z.enum(['registration','programme_fee','assessment','scholarship_contribution','other']).default('registration'), paidAt: z.string().datetime().or(dateOnly),
  gatewayReference: z.string().max(160).optional(), notes: z.string().max(1000).optional(),
}).strict().refine((v) => Boolean(v.registrationId || v.playerId), 'A registration or player is required.');
export const paymentListQuery = z.object({
  page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(25),
  playerId: uuid.optional(), registrationId: uuid.optional(), programmeId: uuid.optional(), centreId: uuid.optional(),
  method: z.enum(['paystack','bank_transfer','cash','pos','waiver']).optional(), status: z.enum(['pending','successful','failed','cancelled','expired','refunded','partially_refunded']).optional(), from: dateOnly.optional(), to: dateOnly.optional(),
}).strict().refine((q) => !q.from || !q.to || q.from <= q.to, 'from must be on or before to.');
export const refundBody = z.object({ amount: money, reason: z.string().min(3).max(1000) }).strict();
export const financeSummaryQuery = z.object({ from: dateOnly.optional(), to: dateOnly.optional(), programmeId: uuid.optional(), centreId: uuid.optional() }).strict().refine((q) => !q.from || !q.to || q.from <= q.to, 'from must be on or before to.');
export const manualRefundBody = z.object({ outcome: z.enum(['successful','failed']) }).strict();
