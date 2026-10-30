'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX uq_players_registration_id
          ON players(registration_id) WHERE registration_id IS NOT NULL;
        CREATE UNIQUE INDEX uq_guardians_normalized_phone
          ON guardians (regexp_replace(phone, '[^0-9]', '', 'g'))
          WHERE phone IS NOT NULL AND regexp_replace(phone, '[^0-9]', '', 'g') <> '';
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS uq_guardians_normalized_phone;
        DROP INDEX IF EXISTS uq_players_registration_id;
      `, { transaction });
    });
  },
};
