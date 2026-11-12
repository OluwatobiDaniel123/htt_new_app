'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE refunds
          ADD COLUMN provider_refund_reference varchar(160);
        CREATE UNIQUE INDEX uq_refunds_provider_refund_reference
          ON refunds(provider_refund_reference)
          WHERE provider_refund_reference IS NOT NULL;
      `, { transaction });
    });
  },
  async down(queryInterface) {
    // Rollback drops provider_refund_reference and permanently discards any stored references.
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS uq_refunds_provider_refund_reference;
        ALTER TABLE refunds DROP COLUMN IF EXISTS provider_refund_reference;
      `, { transaction });
    });
  },
};
