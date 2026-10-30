'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE refresh_sessions
          ADD COLUMN family_id uuid NOT NULL DEFAULT gen_random_uuid(),
          ADD COLUMN rotated_at timestamptz,
          ADD COLUMN replaced_by_session_id uuid REFERENCES refresh_sessions(id) ON DELETE SET NULL;

        CREATE INDEX idx_refresh_sessions_family ON refresh_sessions(family_id, revoked_at, rotated_at);

        ALTER TABLE password_reset_tokens
          ADD COLUMN purpose varchar(24) NOT NULL DEFAULT 'password_reset'
          CHECK (purpose IN ('password_reset','staff_invite'));

        CREATE UNIQUE INDEX uq_staff_email_case_insensitive ON staff_accounts (lower(email));
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        DROP INDEX IF EXISTS uq_staff_email_case_insensitive;
        ALTER TABLE password_reset_tokens DROP COLUMN purpose;
        DROP INDEX IF EXISTS idx_refresh_sessions_family;
        ALTER TABLE refresh_sessions
          DROP COLUMN replaced_by_session_id,
          DROP COLUMN rotated_at,
          DROP COLUMN family_id;
      `, { transaction });
    });
  },
};
