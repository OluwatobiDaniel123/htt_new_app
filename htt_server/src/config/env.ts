import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  // FRONTEND_URL: z
  //   .string()
  //   .default("http://localhost:5173")
  //   .transform((value) => value.split(",").map((origin) => origin.trim()))
  //   .pipe(z.array(z.string().url())),
  // PUBLIC_SITE_URL: z
  //   .string()
  //   .default("")
  //   .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
  //   .pipe(z.array(z.string().url())),
  FRONTEND_URL: z
    .string()
    .default("http://localhost:5173")
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(z.string().url()))
    .transform((origins) => origins.map((origin) => new URL(origin).origin)),

  PUBLIC_SITE_URL: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()))
    .transform((origins) => origins.map((origin) => new URL(origin).origin)),
  PAYSTACK_CALLBACK_URL: z
    .string()
    .url()
    .default("http://localhost:5173/payment/callback"),
  DATABASE_URL: z.string().optional().default(""),
  PGHOST: z.string().default("localhost"),
  PGPORT: z.coerce.number().int().min(1).max(65535).default(5432),
  PGDATABASE: z.string().default("htt_academy"),
  PGUSER: z.string().default("postgres"),
  PGPASSWORD: z.string().default(""),
  DB_SSL: z
    .preprocess(
      (value) =>
        value === "false" || value === "0"
          ? false
          : value === "true" || value === "1"
            ? true
            : value,
      z.boolean(),
    )
    .default(true),
  DB_SSL_REJECT_UNAUTHORIZED: z
    .preprocess(
      (value) =>
        value === "false" || value === "0"
          ? false
          : value === "true" || value === "1"
            ? true
            : value,
      z.boolean(),
    )
    .default(true),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(0),
  DB_POOL_ACQUIRE_MS: z.coerce.number().int().positive().default(30000),
  DB_POOL_IDLE_MS: z.coerce.number().int().positive().default(10000),
  JWT_ACCESS_SECRET: z.string().min(32, "must contain at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "must contain at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  JWT_ISSUER: z.string().url().default("https://api.httacademy.local"),
  JWT_AUDIENCE: z.string().min(1).default("htt-academy-web"),
  PASSWORD_RESET_URL: z
    .string()
    .url()
    .default("http://localhost:5173/reset-password"),
  AUTH_COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).default("strict"),
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  PASSWORD_RESET_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_FROM_EMAIL: z.string().optional().default(""),
  PAYSTACK_SECRET_KEY: z.string().optional().default(""),
  // Optional while legacy x-paystack-signature remains enabled on existing accounts.
  PAYSTACK_WEBHOOK_SECRET: z.string().optional().default(""),
  PAYSTACK_API_BASE_URL: z.string().url().default("https://api.paystack.co"),
  PAYSTACK_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(60000)
    .default(10000),
  NOTIFICATIONS_ENABLED: z
    .preprocess((value) => value === "true" || value === "1", z.boolean())
    .default(false),
  SMS_API_URL: z
    .string()
    .default("")
    .refine(
      (value) => value === "" || z.string().url().safeParse(value).success,
      "must be a valid URL",
    ),
  SMS_API_KEY: z.string().optional().default(""),
  SMS_SENDER_ID: z.string().max(20).optional().default(""),
  NOTIFICATION_WORKER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(60000)
    .default(5000),
  SEED_ADMIN_NAME: z.string().trim().max(200).default(""),
  SEED_ADMIN_EMAIL: z
    .string()
    .trim()
    .max(320)
    .default("")
    .refine(
      (value) => value === "" || z.string().email().safeParse(value).success,
      "must be a valid email address",
    ),
  SEED_ADMIN_PASSWORD: z.string().max(128).default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${errors}`);
}

const callbackHost = new URL(parsed.data.PAYSTACK_CALLBACK_URL).hostname;
if (parsed.data.NODE_ENV !== "production") {
  if (!["localhost", "127.0.0.1", "::1"].includes(callbackHost)) {
    throw new Error(
      "PAYSTACK_CALLBACK_URL must use localhost during local development and tests.",
    );
  }
} else if (
  !process.env.PAYSTACK_CALLBACK_URL ||
  ["localhost", "127.0.0.1", "::1"].includes(callbackHost)
) {
  throw new Error(
    "PAYSTACK_CALLBACK_URL must be explicitly configured for production.",
  );
}

export const env = parsed.data;
