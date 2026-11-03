'use strict';
const { randomUUID } = require('node:crypto');
const permissions = {
  'notifications.admin.read': ['admin','ceo','operations','finance'],
  'notifications.retry': ['admin','ceo','operations'],
  'notifications.announce': ['admin','ceo'],
  'notifications.templates.read': ['admin','ceo','operations','finance'],
  'notifications.preferences.manage': ['admin','ceo','operations'],
};
module.exports = {
  async up(qi) {
    const now = new Date();
    const [roles] = await qi.sequelize.query('SELECT id, key FROM roles');
    const [existing] = await qi.sequelize.query('SELECT id, key FROM permissions');
    const byKey = new Map(existing.map((item) => [item.key, item.id]));
    for (const key of Object.keys(permissions)) if (!byKey.has(key)) {
      const id = randomUUID();
      await qi.bulkInsert('permissions', [{ id, key, description: `Phase 6 ${key.replaceAll('.', ' ')} permission`, created_at: now, updated_at: now }]);
      byKey.set(key, id);
    }
    const [links] = await qi.sequelize.query('SELECT role_id, permission_id FROM role_permissions');
    const assigned = new Set(links.map((link) => `${link.role_id}:${link.permission_id}`));
    for (const role of roles) for (const [key, allowedRoles] of Object.entries(permissions)) {
      if (!allowedRoles.includes(role.key)) continue;
      const permissionId = byKey.get(key);
      if (!assigned.has(`${role.id}:${permissionId}`)) await qi.bulkInsert('role_permissions', [{ id: randomUUID(), role_id: role.id, permission_id: permissionId, access_level: 'full', created_at: now, updated_at: now }]);
    }
  },
  async down() { /* Non-destructive; assigned permissions may be customized after seeding. */ },
};
