import { QueryTypes } from "sequelize";
import { readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { env } from "../config/env.js";
import { models, sequelize } from "../models/index.js";

const target = process.argv.find((argument) => argument.startsWith("--target="))?.slice("--target=".length);
const expectedTables: Record<string, string[]> = {
  staff_accounts: ["id", "email", "full_name", "password_hash", "active"],
  roles: ["id", "key", "name", "system_role"],
  permissions: ["id", "key"],
  staff_roles: ["staff_account_id", "role_id"],
  role_permissions: ["role_id", "permission_id", "access_level"],
};
interface AdminRoleInspection {
  id: string;
  permissions: Array<{ key: string; RolePermission?: { accessLevel?: string } }>;
}

try {
  if (target !== "development" || env.NODE_ENV !== "development") {
    throw new Error("Database inspection requires NODE_ENV=development and --target=development.");
  }

  await sequelize.authenticate();
  const columns = await sequelize.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN (:tableNames)
      ORDER BY table_name, ordinal_position`,
    { replacements: { tableNames: Object.keys(expectedTables) }, type: QueryTypes.SELECT },
  );
  const columnsByTable = new Map<string, Set<string>>();
  for (const row of columns) {
    const tableColumns = columnsByTable.get(row.table_name) ?? new Set<string>();
    tableColumns.add(row.column_name);
    columnsByTable.set(row.table_name, tableColumns);
  }
  const tableReport = Object.fromEntries(
    Object.entries(expectedTables).map(([table, required]) => {
      const actual = columnsByTable.get(table);
      const missingColumns = required.filter((column) => !actual?.has(column));
      return [table, { exists: Boolean(actual), missingColumns }];
    }),
  );

  const metaExists = await sequelize.query<{ exists: boolean }>(
    `SELECT to_regclass(format('%I.%I', current_schema(), 'SequelizeMeta')) IS NOT NULL AS exists`,
    { type: QueryTypes.SELECT },
  );
  const appliedMigrations = metaExists[0]?.exists
    ? await sequelize.query<{ name: string }>(
        `SELECT name FROM "SequelizeMeta" ORDER BY name`,
        { type: QueryTypes.SELECT },
      )
    : [];
  const migrationFiles = (await readdir(new URL("../../migrations/", import.meta.url)))
    .filter((name) => name.endsWith(".cjs"))
    .sort();
  const appliedNames = new Set(appliedMigrations.map((row) => row.name));
  const projectMigrationsPending = migrationFiles.filter((name) => !appliedNames.has(name));
  const existingTables = await sequelize.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    { type: QueryTypes.SELECT },
  );
  const initialMigration = await readFile(
    new URL("../../migrations/20261029000000-create-initial-schema.cjs", import.meta.url),
    "utf8",
  );
  const initialSchemaTables = [...initialMigration.matchAll(/CREATE TABLE\s+([a-z_][a-z0-9_]*)/gi)]
    .map((match) => match[1]!)
    .filter((name, index, names) => names.indexOf(name) === index);
  const existingTableNames = new Set(existingTables.map((row) => row.table_name));
  const initialMigrationCollisions = initialSchemaTables.filter((name) => existingTableNames.has(name));

  let adminRole: AdminRoleInspection | null = null;
  let permissionCount = 0;
  let allPermissionKeys: string[] = [];
  const roleSchemaReady = ["roles", "permissions", "role_permissions"].every(
    (table) => tableReport[table as keyof typeof tableReport]?.exists && tableReport[table as keyof typeof tableReport]?.missingColumns.length === 0,
  );
  if (roleSchemaReady) {
    adminRole = await models.Role.findOne({
      where: { key: "admin" },
      include: [{ model: models.Permission, as: "permissions", through: { attributes: ["accessLevel"] } }],
    }) as unknown as AdminRoleInspection | null;
    const permissionRows = await models.Permission.findAll({ attributes: ["key"] }) as unknown as Array<{ key: string }>;
    permissionCount = permissionRows.length;
    allPermissionKeys = permissionRows.map((permission) => permission.key);
  }

  const adminGrants = new Map(
    (adminRole?.permissions ?? []).map((permission) => [permission.key, permission.RolePermission?.accessLevel]),
  );
  const missingAdminGrants = adminRole
    ? [...new Set([
        ...["staff", "staff.create", "staff.update", "staff.deactivate", "staff.assign_roles", "roles", "roles.manage", "permissions", "permissions.manage"].filter((key) => adminGrants.get(key) !== "full"),
        ...allPermissionKeys,
      ])].filter((key) => adminGrants.get(key) !== "full")
    : [];
  const seedAdminRecord = tableReport.staff_accounts?.exists && tableReport.staff_accounts.missingColumns.length === 0 && env.SEED_ADMIN_EMAIL
    ? await models.StaffAccount.findOne({ where: { email: env.SEED_ADMIN_EMAIL.toLowerCase() } }) as unknown as { id: string } | null
    : null;
  const seedAdminHasAdminRole = seedAdminRecord && adminRole
    ? Boolean(await models.StaffRole.findOne({ where: { staffAccountId: seedAdminRecord.id, roleId: adminRole.id } }))
    : null;

  console.info(JSON.stringify({
    target: "confirmed-development",
    schema: (await sequelize.query<{ schema: string }>("SELECT current_schema() AS schema", { type: QueryTypes.SELECT }))[0]?.schema,
    tables: tableReport,
    existingTables: existingTables.map((row) => row.table_name),
    initialMigrationTableCollisions: initialMigrationCollisions,
    appliedMigrationCount: appliedMigrations.length,
    appliedMigrations: appliedMigrations.map((row) => row.name),
    projectMigrationsPending,
    roleSchemaReady,
    adminRoleExists: Boolean(adminRole),
    permissionCount,
    adminPermissionLevels: Object.fromEntries(
      ["payments.refund", "safeguarding.read", "audit.read_sensitive"].map((key) => [key, adminGrants.get(key) ?? "not_assigned"]),
    ),
    adminMissingFullPermissions: missingAdminGrants,
    seedAdminAccountExists: env.SEED_ADMIN_EMAIL ? Boolean(seedAdminRecord) : null,
    seedAdminHasAdminRole,
    readOnly: true,
  }, null, 2));
} catch (error) {
  console.error("Read-only development database inspection failed.");
  if (env.NODE_ENV === "development") {
    const safe = error instanceof Error ? error.message : "Unknown database inspection error.";
    console.error(`Diagnostic: ${safe}`);
  }
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
