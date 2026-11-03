'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
      ALTER TABLE centres
        ADD COLUMN slug varchar(180),
        ADD COLUMN city varchar(160),
        ADD COLUMN region varchar(160),
        ADD COLUMN map_embed text,
        ADD COLUMN image text,
        ADD COLUMN coming_soon boolean NOT NULL DEFAULT false;

      ALTER TABLE programmes
        ADD COLUMN slug varchar(180),
        ADD COLUMN tagline text,
        ADD COLUMN age_group varchar(80),
        ADD COLUMN training_days text[] NOT NULL DEFAULT '{}',
        ADD COLUMN duration varchar(160),
        ADD COLUMN price text,
        ADD COLUMN benefits text[] NOT NULL DEFAULT '{}',
        ADD COLUMN requirements text[] NOT NULL DEFAULT '{}',
        ADD COLUMN equipment text[] NOT NULL DEFAULT '{}',
        ADD COLUMN icon varchar(120),
        ADD COLUMN featured boolean NOT NULL DEFAULT false;
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM centres WHERE
            slug IS NOT NULL OR city IS NOT NULL OR region IS NOT NULL OR
            map_embed IS NOT NULL OR image IS NOT NULL OR coming_soon IS TRUE
        ) THEN
          RAISE EXCEPTION 'Cannot roll back Centre fields after non-default data has been stored.';
        END IF;
        IF EXISTS (
          SELECT 1 FROM programmes WHERE
            slug IS NOT NULL OR tagline IS NOT NULL OR age_group IS NOT NULL OR
            cardinality(training_days) > 0 OR duration IS NOT NULL OR price IS NOT NULL OR
            cardinality(benefits) > 0 OR cardinality(requirements) > 0 OR
            cardinality(equipment) > 0 OR icon IS NOT NULL OR featured IS TRUE
        ) THEN
          RAISE EXCEPTION 'Cannot roll back Programme fields after non-default data has been stored.';
        END IF;
      END $$;

      ALTER TABLE centres
        DROP COLUMN coming_soon,
        DROP COLUMN image,
        DROP COLUMN map_embed,
        DROP COLUMN region,
        DROP COLUMN city,
        DROP COLUMN slug;

      ALTER TABLE programmes
        DROP COLUMN featured,
        DROP COLUMN icon,
        DROP COLUMN equipment,
        DROP COLUMN requirements,
        DROP COLUMN benefits,
        DROP COLUMN price,
        DROP COLUMN duration,
        DROP COLUMN training_days,
        DROP COLUMN age_group,
        DROP COLUMN tagline,
        DROP COLUMN slug;
      `, { transaction });
    });
  },
};
