import { format, isValid, parseISO } from 'date-fns';

export const ROLES = [
  { value: 'ceo', label: 'CEO / Management' },
  { value: 'admin', label: 'System Administrator' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations', label: 'Operations' },
  { value: 'coach', label: 'Coach' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sponsorship', label: 'Sponsorship Coordinator' },
];

export const roleLabel = (role) =>
  ROLES.find((r) => r.value === role)?.label || (role ? 'Staff' : 'Unassigned');

export const labelize = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const currency = (amount, code = 'NGN') => {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `₦${n.toLocaleString()}`;
  }
};

export const num = (value) => new Intl.NumberFormat('en-NG').format(Number(value || 0));

export const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
};

export const formatDate = (value, pattern = 'dd MMM yyyy') => {
  const d = toDate(value);
  return d ? format(d, pattern) : '—';
};

export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? format(d, 'dd MMM yyyy, HH:mm') : '—';
};

export const shortDate = (value) => {
  const d = toDate(value);
  return d ? format(d, 'dd MMM') : '—';
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const isOverdue = (dateString) => {
  if (!dateString) return false;
  const d = toDate(dateString);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

export const ageFromDob = (dob) => {
  const d = toDate(dob);
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

export const ageGroupFromAge = (age) => {
  if (age === null) return '';
  if (age <= 10) return '8-10';
  if (age <= 12) return '11-12';
  if (age <= 14) return '13-14';
  return 'other';
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export const STATUS_TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  navy: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  gold: 'bg-[#FBF5E6] text-[#8A6D20] ring-[#C2A24C]/30',
  purple: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export const PAYMENT_METHODS = ['paystack', 'bank_transfer', 'cash', 'pos', 'waiver'].map((v) => ({
  value: v,
  label: labelize(v),
}));

export const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];