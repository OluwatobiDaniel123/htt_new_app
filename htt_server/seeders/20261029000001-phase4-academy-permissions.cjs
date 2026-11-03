"use strict";
const { randomUUID } = require("node:crypto");

const moduleKeys = [
  "players",
  "guardians",
  "registrations",
  "centres",
  "programmes",
];
const sensitiveRoleGrants = {
  players: ["admin", "ceo", "operations", "coach"],
  guardians: ["admin", "ceo", "operations"],
};
const names = {
  players: "Players",
  guardians: "Guardians",
  registrations: "Registrations",
  centres: "Centres",
  programmes: "Programmes",
};

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [roles] = await queryInterface.sequelize.query(
      "SELECT id, key FROM roles",
    );
    const [permissions] = await queryInterface.sequelize.query(
      "SELECT id, key FROM permissions",
    );
    const roleIds = new Map(roles.map((row) => [row.key, row.id]));
    const permissionIds = new Map(permissions.map((row) => [row.key, row.id]));
    const [rolePermissionRows] = await queryInterface.sequelize.query(
      "SELECT role_id, permission_id, access_level FROM role_permissions",
    );
    const moduleLevel = new Map(
      rolePermissionRows.map((row) => [
        `${row.role_id}:${row.permission_id}`,
        row.access_level,
      ]),
    );

    const inventory = [];
    for (const module of moduleKeys) {
      inventory.push(
        `${module}.read`,
        `${module}.create`,
        `${module}.update`,
        `${module}.delete`,
      );
    }
    inventory.push(
      "players.read_sensitive",
      "guardians.read_contact",
      "registrations.approve",
    );
    for (const key of inventory) {
      if (!permissionIds.has(key)) {
        const id = randomUUID();
        await queryInterface.bulkInsert("permissions", [
          {
            id,
            key,
            description: `${names[key.split(".")[0]] ?? "Restricted"} ${key.split(".").slice(1).join(" ")} permission`,
            created_at: now,
            updated_at: now,
          },
        ]);
        permissionIds.set(key, id);
      }
    }

    const grants = [];
    const baseModuleRoles = [
      "admin",
      "ceo",
      "operations",
      "finance",
      "coach",
      "marketing",
      "sponsorship",
    ];
    for (const roleKey of baseModuleRoles) {
      const roleId = roleIds.get(roleKey);
      if (!roleId) continue;
      for (const module of moduleKeys) {
        const modulePermissionId = permissionIds.get(module);
        const moduleAccess = moduleLevel.get(`${roleId}:${modulePermissionId}`);
        if (!moduleAccess) continue;
        grants.push([
          roleId,
          permissionIds.get(`${module}.read`),
          moduleAccess,
        ]);
        if (moduleAccess === "full") {
          for (const action of ["create", "update", "delete"])
            grants.push([
              roleId,
              permissionIds.get(`${module}.${action}`),
              "full",
            ]);
        }
      }
    }
    for (const [module, allowedRoles] of Object.entries(sensitiveRoleGrants)) {
      for (const roleKey of allowedRoles) {
        const roleId = roleIds.get(roleKey);
        if (roleId)
          grants.push([
            roleId,
            permissionIds.get(
              module === "players"
                ? "players.read_sensitive"
                : "guardians.read_contact",
            ),
            "full",
          ]);
      }
    }
    for (const roleKey of ["admin", "ceo", "operations"]) {
      const roleId = roleIds.get(roleKey);
      if (roleId)
        grants.push([
          roleId,
          permissionIds.get("registrations.approve"),
          "full",
        ]);
    }

    for (const [roleId, permissionId, accessLevel] of grants) {
      if (!permissionId) continue;
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
  },
  async down() {
    // Non-destructive by design: administrators may edit permissions after seeding.
  },
};
