'use strict';

const { randomUUID } = require('node:crypto');

module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM permissions WHERE key = 'coaching_apprentices'",
    );
    if (existing.length) return;

    const now = new Date();
    await queryInterface.bulkInsert('permissions', [{
      id: randomUUID(),
      key: 'coaching_apprentices',
      description: 'Coaching apprentice recruitment application access',
      created_at: now,
      updated_at: now,
    }]);
  },

  async down() {
    // Intentionally no-op: an administrator may have assigned this permission.
  },
};
