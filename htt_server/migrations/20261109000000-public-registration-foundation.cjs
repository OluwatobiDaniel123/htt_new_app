'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE players
          ADD COLUMN official_player_id varchar(40),
          ADD COLUMN gender varchar(40),
          ADD COLUMN class_name varchar(80),
          ADD COLUMN position_uuid uuid,
          ADD COLUMN profile_image_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
        ALTER TABLE guardians ADD COLUMN alternative_phone varchar(40);
        CREATE UNIQUE INDEX uq_players_official_player_id
          ON players(official_player_id) WHERE official_player_id IS NOT NULL;
        ALTER TABLE players DROP CONSTRAINT IF EXISTS players_registration_status_check;
        ALTER TABLE players ADD CONSTRAINT players_registration_status_check
          CHECK (registration_status IN ('pending','prospective','registered','waitlisted','archived','rejected'));

        ALTER TABLE registrations
          ADD COLUMN child_gender varchar(40),
          ADD COLUMN child_school varchar(180),
          ADD COLUMN child_class_name varchar(80),
          ADD COLUMN child_position_uuid uuid,
          ADD COLUMN guardian_relationship varchar(40),
          ADD COLUMN guardian_alternative_phone varchar(40),
          ADD COLUMN emergency_contact_name varchar(200),
          ADD COLUMN emergency_contact_phone varchar(40),
          ADD COLUMN centre_name_snapshot varchar(180),
          ADD COLUMN programme_title_snapshot varchar(180),
          ADD COLUMN programme_base_fee_submitted numeric(12,2),
          ADD COLUMN payment_frequency varchar(40),
          ADD COLUMN payment_fee_submitted numeric(12,2),
          ADD COLUMN public_payload jsonb,
          ADD COLUMN submission_fingerprint varchar(64),
          ADD COLUMN amount_due_currency char(3) NOT NULL DEFAULT 'NGN',
          ADD COLUMN profile_image_asset_id uuid REFERENCES media_assets(id) ON DELETE SET NULL;
        CREATE UNIQUE INDEX uq_registrations_submission_fingerprint
          ON registrations(submission_fingerprint) WHERE submission_fingerprint IS NOT NULL;

        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
        ALTER TABLE payments ADD CONSTRAINT payments_status_check
          CHECK (status IN ('pending','successful','failed','cancelled','expired','refunded','partially_refunded'));
        ALTER TABLE payments
          ADD COLUMN expires_at timestamptz,
          ADD COLUMN verified_at timestamptz,
          ADD COLUMN verified_amount numeric(12,2),
          ADD COLUMN verified_currency char(3),
          ADD COLUMN provider_transaction_id varchar(120),
          ADD COLUMN verification_details jsonb NOT NULL DEFAULT '{}';

        CREATE TABLE emergency_contacts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          registration_id uuid NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE RESTRICT,
          player_id uuid REFERENCES players(id) ON DELETE SET NULL,
          full_name varchar(200) NOT NULL,
          phone varchar(40) NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX idx_emergency_contacts_player ON emergency_contacts(player_id);

        CREATE TABLE player_id_counters (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          approval_year integer NOT NULL UNIQUE CHECK (approval_year BETWEEN 2000 AND 9999),
          last_sequence integer NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `, { transaction });
    });
  },
  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM payments WHERE status = 'expired') THEN
            RAISE EXCEPTION 'Cannot rollback registration foundation while expired payment records exist';
          END IF;
          IF EXISTS (SELECT 1 FROM players WHERE registration_status IN ('pending','rejected')) THEN
            RAISE EXCEPTION 'Cannot rollback registration foundation while pending/rejected player records exist';
          END IF;
          IF EXISTS (SELECT 1 FROM players WHERE official_player_id IS NOT NULL) THEN
            RAISE EXCEPTION 'Cannot rollback registration foundation after official player IDs have been assigned';
          END IF;
          IF EXISTS (SELECT 1 FROM registrations WHERE submission_fingerprint IS NOT NULL) THEN
            RAISE EXCEPTION 'Cannot rollback registration foundation after public registrations have been stored';
          END IF;
          IF EXISTS (SELECT 1 FROM emergency_contacts) THEN
            RAISE EXCEPTION 'Cannot rollback registration foundation while emergency contact records exist';
          END IF;
        END $$;
      `, { transaction });
      await queryInterface.sequelize.query(`
        DROP TABLE IF EXISTS emergency_contacts;
        DROP TABLE IF EXISTS player_id_counters;
        ALTER TABLE registrations
          DROP COLUMN IF EXISTS profile_image_asset_id,
          DROP COLUMN IF EXISTS public_payload,
          DROP COLUMN IF EXISTS submission_fingerprint,
          DROP COLUMN IF EXISTS payment_fee_submitted,
          DROP COLUMN IF EXISTS amount_due_currency,
          DROP COLUMN IF EXISTS payment_frequency,
          DROP COLUMN IF EXISTS programme_base_fee_submitted,
          DROP COLUMN IF EXISTS programme_title_snapshot,
          DROP COLUMN IF EXISTS centre_name_snapshot,
          DROP COLUMN IF EXISTS guardian_alternative_phone,
          DROP COLUMN IF EXISTS guardian_relationship,
          DROP COLUMN IF EXISTS emergency_contact_phone,
          DROP COLUMN IF EXISTS emergency_contact_name,
          DROP COLUMN IF EXISTS child_position_uuid,
          DROP COLUMN IF EXISTS child_class_name,
          DROP COLUMN IF EXISTS child_school,
          DROP COLUMN IF EXISTS child_gender;
        DROP INDEX IF EXISTS uq_registrations_submission_fingerprint;
        ALTER TABLE guardians DROP COLUMN IF EXISTS alternative_phone;
        ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
        ALTER TABLE payments ADD CONSTRAINT payments_status_check
          CHECK (status IN ('pending','successful','failed','cancelled','refunded','partially_refunded'));
        ALTER TABLE payments
          DROP COLUMN IF EXISTS verification_details,
          DROP COLUMN IF EXISTS provider_transaction_id,
          DROP COLUMN IF EXISTS verified_currency,
          DROP COLUMN IF EXISTS verified_amount,
          DROP COLUMN IF EXISTS verified_at,
          DROP COLUMN IF EXISTS expires_at;
        DROP INDEX IF EXISTS uq_players_official_player_id;
        ALTER TABLE players
          DROP CONSTRAINT IF EXISTS players_registration_status_check,
          ADD CONSTRAINT players_registration_status_check
            CHECK (registration_status IN ('prospective','registered','waitlisted','archived')),
          DROP COLUMN IF EXISTS profile_image_asset_id,
          DROP COLUMN IF EXISTS position_uuid,
          DROP COLUMN IF EXISTS class_name,
          DROP COLUMN IF EXISTS gender,
          DROP COLUMN IF EXISTS official_player_id;
      `, { transaction });
    });
  },
};
