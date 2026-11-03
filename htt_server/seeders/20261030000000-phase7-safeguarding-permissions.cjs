'use strict';

const { randomUUID } = require('node:crypto');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [permissions] = await queryInterface.sequelize.query('SELECT id FROM permissions WHERE key = :key', { replacements: { key: 'safeguarding.manage' } });
    const permissionId = permissions[0]?.id || randomUUID();
    if (!permissions.length) await queryInterface.bulkInsert('permissions', [{ id: permissionId, key: 'safeguarding.manage', description: 'Approve child-related content and manage safeguarding records', created_at: now, updated_at: now }]);
    const [roles] = await queryInterface.sequelize.query("SELECT id FROM roles WHERE key IN ('admin','ceo','operations')");
    for (const role of roles) {
      const [existing] = await queryInterface.sequelize.query('SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId', { replacements: { roleId: role.id, permissionId } });
      if (!existing.length) await queryInterface.bulkInsert('role_permissions', [{ id: randomUUID(), role_id: role.id, permission_id: permissionId, access_level: 'full', created_at: now, updated_at: now }]);
    }
  },
  async down() { /* Keep this permission because administrators may assign it after seeding. */ },
};
