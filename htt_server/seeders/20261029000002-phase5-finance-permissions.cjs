"use strict";
const { randomUUID } = require("node:crypto");
const keys = [
  "payments.read",
  "payments.initialize",
  "payments.verify",
  "payments.record",
  "payments.refunds.request",
  "payments.refunds.approve",
  "payments.receipt.read",
  "reports.finance.read",
];
const grants = {
  admin: Object.fromEntries(keys.map((key) => [key, "full"])),
  ceo: Object.fromEntries(keys.map((key) => [key, "full"])),
  finance: Object.fromEntries(keys.map((key) => [key, "full"])),
  operations: {
    "payments.read": "view",
    "payments.initialize": "full",
    "payments.receipt.read": "view",
  },
};
module.exports = {
  async up(qi) {
    const now = new Date();
    const [permissions] = await qi.sequelize.query(
      "SELECT id, key FROM permissions",
    );
    const permissionIds = new Map(permissions.map((row) => [row.key, row.id]));
    for (const key of keys)
      if (!permissionIds.has(key)) {
        const id = randomUUID();
        await qi.bulkInsert("permissions", [
          {
            id,
            key,
            description: `Phase 5 ${key.replaceAll(".", " ")} permission`,
            created_at: now,
            updated_at: now,
          },
        ]);
        permissionIds.set(key, id);
      }
    const [roles] = await qi.sequelize.query("SELECT id, key FROM roles");
    for (const role of roles)
      for (const [key, level] of Object.entries(grants[role.key] ?? {})) {
        const [existing] = await qi.sequelize.query(
          "SELECT id FROM role_permissions WHERE role_id=:roleId AND permission_id=:permissionId",
          {
            replacements: {
              roleId: role.id,
              permissionId: permissionIds.get(key),
            },
          },
        );
        if (!existing.length)
          await qi.bulkInsert("role_permissions", [
            {
              id: randomUUID(),
              role_id: role.id,
              permission_id: permissionIds.get(key),
              access_level: level,
              created_at: now,
              updated_at: now,
            },
          ]);
      }
  },
  async down() {
    /* Non-destructive because permissions may be assigned after seeding. */
  },
};
