'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
      UPDATE payments SET status = 'successful' WHERE status = 'paid';
      ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending','successful','failed','cancelled','refunded','partially_refunded'));
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
      ALTER TABLE payments ADD CONSTRAINT payments_purpose_check CHECK (purpose IN ('registration','programme_fee','assessment','scholarship_contribution','other'));
      ALTER TABLE payments ADD COLUMN registration_id uuid REFERENCES registrations(id) ON DELETE SET NULL;
      ALTER TABLE payments ADD COLUMN guardian_id uuid REFERENCES guardians(id) ON DELETE SET NULL;
      ALTER TABLE payments ADD COLUMN programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL;
      ALTER TABLE payments ADD COLUMN centre_id uuid REFERENCES centres(id) ON DELETE SET NULL;
      ALTER TABLE payments ADD COLUMN payer_email varchar(320);
      ALTER TABLE payments ADD COLUMN idempotency_key varchar(120) UNIQUE;
      ALTER TABLE payments ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE payments ADD COLUMN provider_status varchar(40);
      ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0) NOT VALID;
      CREATE INDEX idx_payments_registration_created ON payments(registration_id, created_at DESC);
      CREATE INDEX idx_payments_programme_centre_created ON payments(programme_id, centre_id, created_at DESC);
      CREATE INDEX idx_payments_paid_at ON payments(paid_at DESC) WHERE status IN ('successful','partially_refunded','refunded');
      CREATE TABLE refunds (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
        reference varchar(100) NOT NULL UNIQUE, gateway_reference varchar(160) UNIQUE,
        amount numeric(12,2) NOT NULL CHECK (amount > 0), currency char(3) NOT NULL DEFAULT 'NGN', reason text NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','pending','processing','needs_attention','successful','failed','cancelled')),
        requested_by_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
        approved_by_id uuid REFERENCES staff_accounts(id) ON DELETE SET NULL,
        processed_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_refunds_payment_status ON refunds(payment_id, status);
      CREATE INDEX idx_refunds_created ON refunds(created_at DESC);
    `);
  },
  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS refunds;
      DROP INDEX IF EXISTS idx_payments_paid_at;
      DROP INDEX IF EXISTS idx_payments_programme_centre_created;
      DROP INDEX IF EXISTS idx_payments_registration_created;
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_positive;
      ALTER TABLE payments DROP COLUMN IF EXISTS provider_status;
      ALTER TABLE payments DROP COLUMN IF EXISTS metadata;
      ALTER TABLE payments DROP COLUMN IF EXISTS idempotency_key;
      ALTER TABLE payments DROP COLUMN IF EXISTS payer_email;
      ALTER TABLE payments DROP COLUMN IF EXISTS centre_id;
      ALTER TABLE payments DROP COLUMN IF EXISTS programme_id;
      ALTER TABLE payments DROP COLUMN IF EXISTS guardian_id;
      ALTER TABLE payments DROP COLUMN IF EXISTS registration_id;
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
      UPDATE payments SET purpose = 'registration' WHERE purpose = 'programme_fee';
      ALTER TABLE payments ADD CONSTRAINT payments_purpose_check CHECK (purpose IN ('registration','assessment','scholarship_contribution','other'));
      UPDATE payments SET status = 'failed' WHERE status = 'cancelled';
      UPDATE payments SET status = 'paid' WHERE status = 'successful';
      ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (status IN ('pending','paid','failed','refunded','partially_refunded'));
    `);
  },
};
