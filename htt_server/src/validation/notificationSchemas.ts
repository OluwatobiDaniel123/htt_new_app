import { z } from 'zod';

const uuid = z.string().uuid();
const pageQuery = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const notificationListQuery = pageQuery.strict();
export const deliveryQuery = pageQuery.extend({ channel: z.enum(['email','sms','in_app']).optional(), status: z.enum(['delivered','failed','skipped']).optional(), eventType: z.string().max(80).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict().refine((q) => !q.from || !q.to || q.from <= q.to, 'from must be on or before to.');
export const notificationPreferencesBody = z.object({ emailEnabled: z.boolean().optional(), smsEnabled: z.boolean().optional(), inAppEnabled: z.boolean().optional(), categoryPreferences: z.object({ registration: z.boolean().optional(), payment: z.boolean().optional(), refund: z.boolean().optional(), announcement: z.boolean().optional() }).strict().optional() }).strict().refine((value) => Object.keys(value).length > 0, 'At least one preference is required.');
export const guardianSmsConsentBody = z.object({ granted: z.boolean(), source: z.enum(['in_person','signed_form','phone_confirmation']) }).strict();
export const announcementBody = z.object({ idempotencyKey: z.string().min(8).max(100), title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(3000), roleKeys: z.array(z.enum(['admin','ceo','operations','finance','coach','marketing','sponsorship','user'])).max(8).optional(), link: z.string().max(300).regex(/^\/(?!\/)[^\s]*$/).optional() }).strict();
export const notificationIdParam = z.object({ id: uuid }).strict();
export const outboxIdParam = z.object({ id: uuid }).strict();
