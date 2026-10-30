export const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'players', label: 'Players' },
  { key: 'guardians', label: 'Parents & Guardians' },
  { key: 'registrations', label: 'Registrations' },
  { key: 'assessments', label: 'Assessments' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'centres', label: 'Centres' },
  { key: 'programmes', label: 'Programmes' },
  { key: 'scholarships', label: 'Scholarships' },
  { key: 'funding', label: 'Sponsors & Funding' },
  { key: 'finance', label: 'Finance' },
  { key: 'league', label: 'League' },
  { key: 'communications', label: 'Communications' },
  { key: 'content', label: 'Content & Media' },
  { key: 'staff', label: 'Staff & Users' },
  { key: 'roles', label: 'Roles & Permissions' },
  { key: 'reports', label: 'Reports' },
  { key: 'audit', label: 'Audit Logs' },
  { key: 'safeguarding', label: 'Safeguarding' },
  { key: 'settings', label: 'System Settings' },
];

const ALL_FULL = MODULES.reduce((acc, m) => ({ ...acc, [m.key]: 'full' }), {});

export const DEFAULT_ROLE_PERMISSIONS = {
  admin: { ...ALL_FULL },
  ceo: { ...ALL_FULL, settings: 'full' },
  operations: {
    dashboard: 'view',
    players: 'full',
    guardians: 'full',
    registrations: 'full',
    assessments: 'full',
    attendance: 'full',
    centres: 'full',
    programmes: 'full',
    scholarships: 'full',
    funding: 'view',
    finance: 'view',
    league: 'full',
    communications: 'full',
    content: 'view',
    staff: 'view',
    reports: 'view',
    safeguarding: 'full',
    settings: 'view',
  },
  finance: {
    dashboard: 'view',
    players: 'view',
    registrations: 'view',
    scholarships: 'view',
    funding: 'full',
    finance: 'full',
    reports: 'view',
    settings: 'view',
  },
  coach: {
    dashboard: 'view',
    players: 'view',
    assessments: 'full',
    attendance: 'full',
    centres: 'view',
    programmes: 'view',
    league: 'view',
    safeguarding: 'view',
    reports: 'view',
    settings: 'view',
  },
  marketing: {
    dashboard: 'view',
    centres: 'view',
    programmes: 'view',
    communications: 'full',
    content: 'full',
    reports: 'view',
    settings: 'view',
  },
  sponsorship: {
    dashboard: 'view',
    scholarships: 'view',
    funding: 'full',
    communications: 'full',
    reports: 'view',
    settings: 'view',
  },
  user: { dashboard: 'view', settings: 'view' },
};

export const permissionsForRole = (role, overrides) => {
  const key = role || 'user';
  const base = DEFAULT_ROLE_PERMISSIONS[key] || DEFAULT_ROLE_PERMISSIONS.user;
  const override = overrides?.[key] || {};
  return { ...base, ...override };
};

export const can = (permissions, moduleKey, level = 'view') => {
  const granted = permissions?.[moduleKey];
  if (level === 'view') return granted === 'view' || granted === 'full';
  return granted === 'full';
};