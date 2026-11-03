import { MODULES } from './permissions.js';

const COLUMN_ORDER = ['admin', 'finance', 'operations', 'coach', 'marketing', 'sponsorship'];
const ROLE_LABELS = {
  admin: 'System Administrator',
  sponsorship: 'Sponsorship Coordinator',
  ceo: 'CEO / Management',
};

const EXTRA_MODULES = [
  { key: 'notifications', label: 'Notifications' },
  { key: 'coaching_apprentices', label: 'Coaching Apprentices' },
];

const groupForPermission = (permissionKey, knownModules) => {
  const root = permissionKey.split('.')[0];
  if (root === 'payments' || root === 'finance') return 'finance';
  if (root === 'permissions') return 'roles';
  if (root === 'notifications') return 'notifications';
  if (permissionKey === 'coaching_apprentices' || root === 'coaching_apprentices') return 'coaching_apprentices';
  if (knownModules.has(root)) return root;
  return `permission:${permissionKey}`;
};

const titleForPermission = (key) => key
  .replace(/^permission:/, '')
  .replace(/[._-]+/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const orderRolesForMatrix = (roles) => {
  const rank = new Map(COLUMN_ORDER.map((key, index) => [key, index]));
  return [...roles].sort((left, right) => {
    const leftRank = rank.get(left.key) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.key) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return String(left.name).localeCompare(String(right.name));
  });
};

export const roleMatrixLabel = (role) => ROLE_LABELS[role.key] || role.name;

export const buildPermissionMatrixRows = (permissions) => {
  const knownModules = new Set(MODULES.map(({ key }) => key));
  const rows = [
    ...MODULES.map((module) => ({ ...module, permissionIds: [] })),
    ...EXTRA_MODULES.map((module) => ({ ...module, permissionIds: [] })),
  ];
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));

  for (const permission of permissions) {
    const key = groupForPermission(permission.key, knownModules);
    let row = rowsByKey.get(key);
    if (!row) {
      row = { key, label: titleForPermission(key), permissionIds: [] };
      rows.push(row);
      rowsByKey.set(key, row);
    }
    row.permissionIds.push(permission.id);
  }

  return rows;
};

export const readRolePermissionLevels = (assignedPermissions) => {
  const levels = {};
  for (const permission of assignedPermissions || []) {
    const join = permission.RolePermission || permission.rolePermission || permission.role_permissions || {};
    levels[permission.id] = join.accessLevel || join.access_level || permission.accessLevel || 'view';
  }
  return levels;
};

export const matrixCellLevel = (row, roleLevels = {}) => {
  if (!row.permissionIds.length) return 'unavailable';
  const levels = new Set(row.permissionIds.map((permissionId) => roleLevels[permissionId] || 'none'));
  return levels.size === 1 ? [...levels][0] : 'custom';
};

export const setMatrixCellLevel = (roleLevels, row, level) => {
  const next = { ...roleLevels };
  for (const permissionId of row.permissionIds) next[permissionId] = level;
  return next;
};

export const rolePermissionPayload = (roleLevels = {}) => ({
  permissions: Object.entries(roleLevels)
    .filter(([, accessLevel]) => accessLevel !== 'none')
    .map(([permissionId, accessLevel]) => ({ permissionId, accessLevel })),
});

