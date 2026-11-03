import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildPermissionMatrixRows,
  matrixCellLevel,
  orderRolesForMatrix,
  readRolePermissionLevels,
  roleMatrixLabel,
  rolePermissionPayload,
  setMatrixCellLevel,
} from './rolePermissionMatrix.js';

test('matrix roles put the requested six columns first and retain additional roles', () => {
  const roles = orderRolesForMatrix([
    { key: 'ceo', name: 'CEO' },
    { key: 'sponsorship', name: 'Sponsorship' },
    { key: 'marketing', name: 'Marketing' },
    { key: 'coach', name: 'Coach' },
    { key: 'operations', name: 'Operations' },
    { key: 'finance', name: 'Finance' },
    { key: 'admin', name: 'Admin' },
    { key: 'user', name: 'User' },
  ]);

  assert.deepEqual(roles.map((role) => role.key), [
    'admin', 'finance', 'operations', 'coach', 'marketing', 'sponsorship', 'ceo', 'user',
  ]);
  assert.equal(roleMatrixLabel(roles[0]), 'System Administrator');
  assert.equal(roleMatrixLabel(roles[5]), 'Sponsorship Coordinator');
});

test('matrix retains the original modules and groups the added recruitment permission', () => {
  const rows = buildPermissionMatrixRows([
    { id: 'players-base', key: 'players' },
    { id: 'players-read', key: 'players.read' },
    { id: 'payments-read', key: 'payments.read' },
    { id: 'permissions-manage', key: 'permissions.manage' },
    { id: 'recruitment', key: 'coaching_apprentices' },
  ]);

  assert.ok(rows.some((row) => row.key === 'players' && row.permissionIds.length === 2));
  assert.ok(rows.some((row) => row.key === 'finance' && row.permissionIds.includes('payments-read')));
  assert.ok(rows.some((row) => row.key === 'roles' && row.permissionIds.includes('permissions-manage')));
  assert.ok(rows.some((row) => row.key === 'coaching_apprentices' && row.label === 'Coaching Apprentices'));
  assert.ok(rows.some((row) => row.key === 'settings'));
});

test('matrix loads assignments, preserves mixed granular access, and updates only the chosen module', () => {
  const assigned = readRolePermissionLevels([
    { id: 'players-base', RolePermission: { accessLevel: 'full' } },
    { id: 'players-read', role_permissions: { access_level: 'view' } },
  ]);
  const row = { permissionIds: ['players-base', 'players-read'] };

  assert.equal(matrixCellLevel(row, assigned), 'custom');
  const changed = setMatrixCellLevel(assigned, row, 'view');
  assert.equal(changed['players-base'], 'view');
  assert.equal(changed['players-read'], 'view');
  assert.equal(assigned['players-base'], 'full');
  assert.deepEqual(rolePermissionPayload(changed), {
    permissions: [
      { permissionId: 'players-base', accessLevel: 'view' },
      { permissionId: 'players-read', accessLevel: 'view' },
    ],
  });
});
