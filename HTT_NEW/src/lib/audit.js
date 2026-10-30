import { base44 } from '@/api/base44Client';

export const logAudit = async ({ action, entity_name, record_id, record_label, details, user }) => {
  try {
    await base44.entities.AuditLog.create({
      actor_email: user?.email || 'unknown',
      actor_name: user?.full_name || user?.email || 'Unknown user',
      action,
      entity_name,
      record_id: record_id || '',
      record_label: record_label || '',
      details: details || '',
    });
  } catch (error) {
    console.warn('Audit entry failed', error);
  }
};

export const pushHistory = (history, status, note, user) => [
  ...(history || []),
  {
    status,
    note: note || '',
    at: new Date().toISOString(),
    by: user?.email || 'system',
  },
];