'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE coaching_apprentice_applications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name varchar(160) NOT NULL,
        phone_number varchar(40) NOT NULL,
        email varchar(320) NOT NULL,
        location varchar(160) NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'under_review', 'shortlisted', 'accepted', 'declined')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_coaching_apprentice_applications_status_created
        ON coaching_apprentice_applications(status, created_at DESC);
      CREATE INDEX idx_coaching_apprentice_applications_email
        ON coaching_apprentice_applications(email);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS coaching_apprentice_applications;
    `);
  },
};
