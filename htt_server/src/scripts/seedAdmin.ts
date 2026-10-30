import { env } from "../config/env.js";
import { AdminSeedError, seedAdminAccount } from "../services/adminSeedService.js";
import { adminSeedErrorDetails } from "../services/adminSeedDiagnostics.js";
import { sequelize } from "../models/index.js";

const target = process.argv.find((argument) => argument.startsWith("--target="))?.slice("--target=".length);
const secrets = [
  env.SEED_ADMIN_PASSWORD,
  env.DATABASE_URL,
  env.PGPASSWORD,
  env.JWT_ACCESS_SECRET,
  env.JWT_REFRESH_SECRET,
  env.CLOUDINARY_API_SECRET,
  env.RESEND_API_KEY,
  env.PAYSTACK_SECRET_KEY,
  env.PAYSTACK_WEBHOOK_SECRET,
  env.SMS_API_KEY,
];

const reportFailure = (error: unknown) => {
  const cause = error instanceof Error ? error.cause : undefined;
  const message =
    error instanceof AdminSeedError && !cause
      ? error.message
      : "Administrator seeding failed. No credentials were logged.";
  console.error(`Admin seed failed: ${message}`);
  if (env.NODE_ENV === "development") {
    console.error(
      "Admin seed development diagnostics:",
      JSON.stringify(adminSeedErrorDetails(error, secrets), null, 2),
    );
  }
};

try {
  if (env.NODE_ENV === "production") {
    throw new AdminSeedError("Refusing to seed an administrator when NODE_ENV=production.");
  }
  if ((target !== "development" && target !== "test") || target !== env.NODE_ENV) {
    throw new AdminSeedError(
      "Confirm the isolated database target with --target=development or --target=test matching NODE_ENV.",
    );
  }
  if (!env.SEED_ADMIN_NAME || !env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
    throw new AdminSeedError(
      "Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD in htt_server/.env before seeding.",
    );
  }

  const result = await seedAdminAccount({
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
  });
  console.info(
    result.created
      ? `Administrator account created for ${result.email}.`
      : `Administrator account already exists for ${result.email}; no changes made.`,
  );
} catch (error) {
  reportFailure(error);
  process.exitCode = 1;
} finally {
  try {
    await sequelize.close();
  } catch (error) {
    reportFailure(error);
    process.exitCode = 1;
  }
}
