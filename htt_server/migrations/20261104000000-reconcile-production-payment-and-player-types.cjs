// 'use strict';

// // Repairs the known schema drift on a cleared production database. This migration
// // intentionally refuses to run if payment data exists or an unreviewed FK points
// // at payments.id. It preserves the tables and reinstates the three declared FKs.
// module.exports = {
//   async up(queryInterface) {
//     await queryInterface.sequelize.transaction(async (transaction) => {
//       await queryInterface.sequelize.query(`
//         DO $$
//         DECLARE
//           payment_rows bigint;
//           allocation_rows bigint;
//           event_rows bigint;
//           refund_rows bigint;
//           fk record;
//           payment_pk text;
//         BEGIN
//           SELECT count(*) INTO payment_rows FROM payments;
//           SELECT count(*) INTO allocation_rows FROM payment_allocations;
//           SELECT count(*) INTO event_rows FROM payment_events;
//           SELECT count(*) INTO refund_rows FROM refunds;
//           IF payment_rows <> 0 OR allocation_rows <> 0 OR event_rows <> 0 OR refund_rows <> 0 THEN
//             RAISE EXCEPTION 'Refusing schema reconciliation: payments and dependent tables must be empty (payments %, allocations %, events %, refunds %)',
//               payment_rows, allocation_rows, event_rows, refund_rows;
//           END IF;

//           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payments' AND column_name = 'id' AND data_type = 'integer') THEN
//             RAISE EXCEPTION 'Expected payments.id to be PostgreSQL integer before reconciliation';
//           END IF;
//           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'players' AND column_name = 'school' AND data_type = 'character varying') THEN
//             RAISE EXCEPTION 'Expected players.school to be PostgreSQL character varying before reconciliation';
//           END IF;
//           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'players' AND column_name = 'school' AND character_maximum_length = 255)
//             OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payments' AND column_name = 'reference' AND data_type = 'character varying' AND character_maximum_length = 255)
//             OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payments' AND column_name = 'amount' AND data_type = 'numeric' AND numeric_precision = 10 AND numeric_scale = 2)
//             OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payments' AND column_name = 'currency' AND data_type = 'character varying' AND character_maximum_length = 255)
//             OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'payments' AND column_name = 'status' AND data_type = 'character varying' AND character_maximum_length = 255) THEN
//             RAISE EXCEPTION 'Reported schema drift does not match the reviewed source definitions; no columns were changed';
//           END IF;

//           -- Only the three references declared by the initial and Phase 5 migrations
//           -- are reviewed here. Unexpected dependencies stop the operation.
//           FOR fk IN
//             SELECT constraint_row.conname, child.relname AS child_table,
//               child_attribute.attname AS child_column,
//               parent_attribute.attname AS parent_column,
//               array_length(constraint_row.conkey, 1) AS child_column_count,
//               array_length(constraint_row.confkey, 1) AS parent_column_count
//             FROM pg_constraint AS constraint_row
//             JOIN pg_class AS parent ON parent.oid = constraint_row.confrelid
//             JOIN pg_class AS child ON child.oid = constraint_row.conrelid
//             JOIN pg_namespace AS parent_schema ON parent_schema.oid = parent.relnamespace
//             JOIN pg_namespace AS child_schema ON child_schema.oid = child.relnamespace
//             JOIN pg_attribute AS child_attribute
//               ON child_attribute.attrelid = child.oid AND child_attribute.attnum = constraint_row.conkey[1]
//             JOIN pg_attribute AS parent_attribute
//               ON parent_attribute.attrelid = parent.oid AND parent_attribute.attnum = constraint_row.confkey[1]
//             WHERE constraint_row.contype = 'f'
//               AND parent_schema.nspname = current_schema()
//               AND child_schema.nspname = current_schema()
//               AND parent.relname = 'payments'
//           LOOP
//             IF fk.child_table NOT IN ('payment_allocations', 'payment_events', 'refunds')
//               OR fk.child_column <> 'payment_id' OR fk.parent_column <> 'id'
//               OR fk.child_column_count <> 1 OR fk.parent_column_count <> 1 THEN
//               RAISE EXCEPTION 'Unreviewed foreign key %.% (%.% -> payments.%) references payments; migration stopped',
//                 fk.child_table, fk.conname, fk.child_table, fk.child_column, fk.parent_column;
//             END IF;
//             EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', fk.child_table, fk.conname);
//           END LOOP;

//           IF EXISTS (
//             SELECT 1 FROM information_schema.columns
//             WHERE table_schema = current_schema()
//               AND ((table_name = 'payment_allocations' AND column_name = 'payment_id')
//                 OR (table_name = 'payment_events' AND column_name = 'payment_id')
//                 OR (table_name = 'refunds' AND column_name = 'payment_id'))
//               AND data_type <> 'uuid'
//           ) THEN
//             RAISE EXCEPTION 'Expected payment_allocations.payment_id, payment_events.payment_id, and refunds.payment_id to be UUID';
//           END IF;

//           SELECT constraint_row.conname INTO payment_pk
//           FROM pg_constraint AS constraint_row
//           JOIN pg_class AS relation ON relation.oid = constraint_row.conrelid
//           JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
//           WHERE constraint_row.contype = 'p' AND relation.relname = 'payments'
//             AND namespace.nspname = current_schema();
//           IF payment_pk IS NULL THEN
//             RAISE EXCEPTION 'Could not find payments primary key constraint';
//           END IF;
//           EXECUTE format('ALTER TABLE payments DROP CONSTRAINT %I', payment_pk);
//           ALTER TABLE payments ALTER COLUMN id DROP DEFAULT;
//           ALTER TABLE payments ALTER COLUMN id TYPE uuid USING gen_random_uuid();
//           ALTER TABLE payments ALTER COLUMN id SET DEFAULT gen_random_uuid();
//           ALTER TABLE payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

//           ALTER TABLE payments ALTER COLUMN reference TYPE varchar(100);
//           ALTER TABLE payments ALTER COLUMN amount TYPE numeric(12,2);
//           ALTER TABLE payments ALTER COLUMN currency TYPE varchar(3);
//           ALTER TABLE payments ALTER COLUMN status TYPE varchar(32);
//           ALTER TABLE players ALTER COLUMN school TYPE varchar(180);

//           ALTER TABLE payment_allocations
//             ADD CONSTRAINT payment_allocations_payment_id_fkey
//             FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;
//           ALTER TABLE payment_events
//             ADD CONSTRAINT payment_events_payment_id_fkey
//             FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
//           ALTER TABLE refunds
//             ADD CONSTRAINT refunds_payment_id_fkey
//             FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT;
//         END $$;
//       `, { transaction });
//     });
//   },

//   async down() {
//     throw new Error('This production schema reconciliation is intentionally irreversible: integer payment IDs cannot be restored after UUID assignment.');
//   },
// };

"use strict";

// The initial schema and Phase 5 finance migration already create
// the correct UUID-based payment schema.
// No reconciliation is required for fresh databases.
module.exports = {
  async up() {
    // Intentionally empty.
  },

  async down() {
    // Intentionally empty.
  },
};
