"use strict";
const { randomUUID } = require("node:crypto");

const modules = [
  "dashboard",
  "players",
  "guardians",
  "registrations",
  "assessments",
  "attendance",
  "centres",
  "programmes",
  "scholarships",
  "funding",
  "finance",
  "league",
  "communications",
  "content",
  "staff",
  "roles",
  "permissions",
  "reports",
  "audit",
  "safeguarding",
  "settings",
];
const matrix = {
  admin: Object.fromEntries(modules.map((key) => [key, "full"])),
  ceo: Object.fromEntries(modules.map((key) => [key, "full"])),
  operations: {
    dashboard: "view",
    players: "full",
    guardians: "full",
    registrations: "full",
    assessments: "full",
    attendance: "full",
    centres: "full",
    programmes: "full",
    scholarships: "full",
    funding: "view",
    finance: "view",
    league: "full",
    communications: "full",
    content: "view",
    staff: "view",
    reports: "view",
    safeguarding: "full",
    settings: "view",
  },
  finance: {
    dashboard: "view",
    players: "view",
    registrations: "view",
    scholarships: "view",
    funding: "full",
    finance: "full",
    reports: "view",
    settings: "view",
  },
  coach: {
    dashboard: "view",
    players: "view",
    assessments: "full",
    attendance: "full",
    centres: "view",
    programmes: "view",
    league: "view",
    safeguarding: "view",
    reports: "view",
    settings: "view",
  },
  marketing: {
    dashboard: "view",
    centres: "view",
    programmes: "view",
    communications: "full",
    content: "full",
    reports: "view",
    settings: "view",
  },
  sponsorship: {
    dashboard: "view",
    scholarships: "view",
    funding: "full",
    communications: "full",
    reports: "view",
    settings: "view",
  },
  user: { dashboard: "view", settings: "view" },
};
const roleNames = {
  ceo: "CEO",
  admin: "Admin",
  operations: "Operations",
  finance: "Finance",
  coach: "Coach",
  marketing: "Marketing",
  sponsorship: "Sponsorship",
  user: "User",
};
const sensitive = [
  "staff.create",
  "staff.update",
  "staff.deactivate",
  "staff.assign_roles",
  "roles.manage",
  "permissions.manage",
  "players.read_sensitive",
  "guardians.read_contact",
  "registrations.approve",
  "payments.record",
  "payments.refund",
  "safeguarding.read",
  "safeguarding.manage",
  "audit.read_sensitive",
];
const elevated = {
  admin: {
    "staff.create": "full",
    "staff.update": "full",
    "staff.deactivate": "full",
    "staff.assign_roles": "full",
    "roles.manage": "full",
    "permissions.manage": "full",
    "payments.refund": "full",
    "safeguarding.read": "full",
    "audit.read_sensitive": "full",
  },
  ceo: {
    "staff.create": "full",
    "staff.update": "full",
    "staff.deactivate": "full",
    "staff.assign_roles": "full",
    "roles.manage": "full",
    "permissions.manage": "full",
  },
  finance: { "payments.record": "full" },
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id, key FROM roles",
    );
    const [permissions] = await queryInterface.sequelize.query(
      "SELECT id, key FROM permissions",
    );
    const roleByKey = new Map(roles.map((role) => [role.key, role.id]));
    const permissionByKey = new Map(
      permissions.map((permission) => [permission.key, permission.id]),
    );
    for (const [key, name] of Object.entries(roleNames)) {
      if (!roleByKey.has(key)) {
        const id = randomUUID();
        await queryInterface.bulkInsert("roles", [
          {
            id,
            key,
            name,
            system_role: true,
            created_at: now,
            updated_at: now,
          },
        ]);
        roleByKey.set(key, id);
      }
    }
    const descriptions = Object.fromEntries(
      modules.map((key) => [key, `${key} module access`]),
    );
    for (const key of sensitive)
      descriptions[key] = `${key} restricted permission`;
    for (const [key, description] of Object.entries(descriptions)) {
      if (!permissionByKey.has(key)) {
        const id = randomUUID();
        await queryInterface.bulkInsert("permissions", [
          { id, key, description, created_at: now, updated_at: now },
        ]);
        permissionByKey.set(key, id);
      }
    }
    for (const [roleKey, baseGrants] of Object.entries(matrix)) {
      const grants = { ...baseGrants, ...(elevated[roleKey] ?? {}) };
      for (const [permissionKey, accessLevel] of Object.entries(grants)) {
        const roleId = roleByKey.get(roleKey);
        const permissionId = permissionByKey.get(permissionKey);
        const [existing] = await queryInterface.sequelize.query(
          "SELECT id FROM role_permissions WHERE role_id = :roleId AND permission_id = :permissionId",
          { replacements: { roleId, permissionId } },
        );
        if (!existing.length)
          await queryInterface.bulkInsert("role_permissions", [
            {
              id: randomUUID(),
              role_id: roleId,
              permission_id: permissionId,
              access_level: accessLevel,
              created_at: now,
              updated_at: now,
            },
          ]);
      }
    }
  },
  async down() {
    // Intentionally no-op: seeded roles may have acquired staff assignments and edits.
  },
};
