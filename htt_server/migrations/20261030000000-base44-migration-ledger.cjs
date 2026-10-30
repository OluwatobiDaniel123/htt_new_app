'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('data_migration_ledger', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.literal('gen_random_uuid()') },
      source_system: { type: Sequelize.STRING(40), allowNull: false },
      source_entity: { type: Sequelize.STRING(100), allowNull: false },
      source_id: { type: Sequelize.STRING(255), allowNull: false },
      target_entity: { type: Sequelize.STRING(100), allowNull: false },
      target_id: { type: Sequelize.UUID, allowNull: false },
      source_checksum: { type: Sequelize.STRING(64), allowNull: false },
      imported_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('now()') },
    });
    await queryInterface.addConstraint('data_migration_ledger', {
      fields: ['source_system', 'source_entity', 'source_id'],
      type: 'unique',
      name: 'uq_data_migration_source_identity',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('data_migration_ledger');
  },
};
