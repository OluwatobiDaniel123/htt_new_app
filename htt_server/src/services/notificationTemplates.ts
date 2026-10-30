import { z } from 'zod';
import { AppError } from '../errors/AppError.js';

const common = z.object({ guardianName: z.string().min(1).max(200) });
const schemas: Record<string, z.ZodType> = {
  'registration.received': common.extend({ childName: z.string().min(1).max(200), reference: z.string().min(1).max(80) }),
  'registration.approved': common.extend({ childName: z.string().min(1).max(200), reference: z.string().min(1).max(80) }),
  'registration.rejected': common.extend({ childName: z.string().min(1).max(200), reference: z.string().min(1).max(80), note: z.string().max(1000).default('') }),
  'registration.information_required': common.extend({ childName: z.string().min(1).max(200), reference: z.string().min(1).max(80), note: z.string().max(1000).default('') }),
  'payment.initiated': common.extend({ amount: z.string().min(1).max(30), currency: z.string().length(3), reference: z.string().min(1).max(100) }),
  'payment.confirmed': common.extend({ amount: z.string().min(1).max(30), currency: z.string().length(3), reference: z.string().min(1).max(100), receiptNumber: z.string().max(100).default('') }),
  'payment.failed': common.extend({ amount: z.string().min(1).max(30), currency: z.string().length(3), reference: z.string().min(1).max(100) }),
  'refund.requested': common.extend({ amount: z.string().min(1).max(30), currency: z.string().length(3), reference: z.string().min(1).max(100) }),
  'refund.completed': common.extend({ amount: z.string().min(1).max(30), currency: z.string().length(3), reference: z.string().min(1).max(100) }),
  'refund.failed': common.extend({ amount: z.string().min(1).max(30), currency: z.string().length(3), reference: z.string().min(1).max(100) }),
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const copy: Record<string, (value: Record<string, string>) => { subject: string; text: string }> = {
  'registration.received': (v) => ({ subject: `Registration received — ${v.reference}`, text: `Hello ${v.guardianName},\n\nWe received ${v.childName}'s registration (${v.reference}). Our team will review it and contact you with updates.` }),
  'registration.approved': (v) => ({ subject: `Registration approved — ${v.reference}`, text: `Hello ${v.guardianName},\n\n${v.childName}'s registration (${v.reference}) has been approved. Welcome to HTT Academy.` }),
  'registration.rejected': (v) => ({ subject: `Registration update — ${v.reference}`, text: `Hello ${v.guardianName},\n\nWe are unable to approve ${v.childName}'s registration (${v.reference}).${v.note ? `\n\nNote: ${v.note}` : ''}\n\nPlease contact HTT Academy if you need clarification.` }),
  'registration.information_required': (v) => ({ subject: `More information needed — ${v.reference}`, text: `Hello ${v.guardianName},\n\nWe need additional information for ${v.childName}'s registration (${v.reference}).${v.note ? `\n\nRequested information: ${v.note}` : ''}` }),
  'payment.initiated': (v) => ({ subject: `Payment started — ${v.reference}`, text: `Hello ${v.guardianName},\n\nA ${v.currency} ${v.amount} payment was started for reference ${v.reference}. It is not confirmed until provider verification is complete.` }),
  'payment.confirmed': (v) => ({ subject: `Payment confirmed — ${v.reference}`, text: `Hello ${v.guardianName},\n\nYour ${v.currency} ${v.amount} payment (${v.reference}) has been verified successfully.${v.receiptNumber ? ` Receipt: ${v.receiptNumber}.` : ''}` }),
  'payment.failed': (v) => ({ subject: `Payment update — ${v.reference}`, text: `Hello ${v.guardianName},\n\nThe ${v.currency} ${v.amount} payment (${v.reference}) was not completed. You may contact HTT Academy for assistance.` }),
  'refund.requested': (v) => ({ subject: `Refund request received — ${v.reference}`, text: `Hello ${v.guardianName},\n\nWe received a refund request for ${v.currency} ${v.amount} (${v.reference}). We will update you when the outcome is confirmed.` }),
  'refund.completed': (v) => ({ subject: `Refund completed — ${v.reference}`, text: `Hello ${v.guardianName},\n\nA refund of ${v.currency} ${v.amount} for ${v.reference} has been confirmed.` }),
  'refund.failed': (v) => ({ subject: `Refund update — ${v.reference}`, text: `Hello ${v.guardianName},\n\nThe refund of ${v.currency} ${v.amount} for ${v.reference} could not be completed. Please contact HTT Academy.` }),
};

export const renderNotificationTemplate = (key: string, variables: unknown) => {
  const schema = schemas[key];
  const message = copy[key];
  if (!schema || !message) throw new AppError(400, 'UNKNOWN_NOTIFICATION_TEMPLATE', 'Notification template is not available.');
  const parsed = schema.safeParse(variables);
  if (!parsed.success) throw new AppError(400, 'INVALID_TEMPLATE_VARIABLES', 'Required notification template values are missing or invalid.');
  const content = message(parsed.data as Record<string, string>);
  const html = `<!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;color:#18212f;line-height:1.6"><main style="max-width:600px;margin:auto;padding:24px"><header style="font-weight:700;color:#0b6b45">HTT Academy</header>${content.text.split('\n\n').map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')}</main></body></html>`;
  return { ...content, html };
};

export const notificationTemplateCatalog = () => Object.keys(schemas).map((key) => ({ key, channels: ['email', 'sms'], editable: false }));
export const escapeNotificationHtml = escapeHtml;
