'use strict';

module.exports = {
  async up(qi) {
    await qi.sequelize.query(`
      ALTER TABLE notifications ADD COLUMN event_key varchar(180) UNIQUE;
      ALTER TABLE notifications ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
      CREATE TABLE notification_outbox (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_key varchar(180) NOT NULL UNIQUE,
        event_type varchar(80) NOT NULL, aggregate_type varchar(40) NOT NULL, aggregate_id uuid NOT NULL,
        recipient_staff_id uuid REFERENCES staff_accounts(id) ON DELETE CASCADE,
        payload jsonb NOT NULL DEFAULT '{}', channels varchar(16)[] NOT NULL DEFAULT '{}',
        status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed')),
        available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        last_error_code varchar(80), processed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_notification_outbox_ready ON notification_outbox(status, available_at, created_at);
      CREATE INDEX idx_notification_outbox_aggregate ON notification_outbox(aggregate_type, aggregate_id, created_at DESC);
      CREATE TABLE notification_attempts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), outbox_id uuid NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
        channel varchar(16) NOT NULL CHECK (channel IN ('email','sms','in_app')), recipient_hash varchar(64) NOT NULL,
        status varchar(16) NOT NULL CHECK (status IN ('delivered','failed','skipped')),
        provider_message_id varchar(200), error_code varchar(80), attempted_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_notification_attempts_outbox ON notification_attempts(outbox_id, channel, attempted_at DESC);
      CREATE TABLE notification_preferences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_account_id uuid REFERENCES staff_accounts(id) ON DELETE CASCADE,
        guardian_id uuid REFERENCES guardians(id) ON DELETE CASCADE,
        email_enabled boolean NOT NULL DEFAULT true, sms_enabled boolean NOT NULL DEFAULT false, in_app_enabled boolean NOT NULL DEFAULT true,
        category_preferences jsonb NOT NULL DEFAULT '{}', sms_consent_at timestamptz, sms_revoked_at timestamptz, consent_source varchar(40),
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK ((staff_account_id IS NOT NULL) <> (guardian_id IS NOT NULL))
      );
      CREATE UNIQUE INDEX idx_notification_preferences_staff ON notification_preferences(staff_account_id) WHERE staff_account_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_notification_preferences_guardian ON notification_preferences(guardian_id) WHERE guardian_id IS NOT NULL;
    `);
  },
  async down(qi) {
    await qi.sequelize.query(`
      DROP TABLE IF EXISTS notification_preferences;
      DROP TABLE IF EXISTS notification_attempts;
      DROP TABLE IF EXISTS notification_outbox;
      ALTER TABLE notifications DROP COLUMN IF EXISTS metadata;
      ALTER TABLE notifications DROP COLUMN IF EXISTS event_key;
    `);
  },
};
