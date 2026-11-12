import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createHmac } from "node:crypto";
import type { Request, Response as ExpressResponse } from "express";

type RouteStackLayer = {
  route?: {
    path?: string;
    methods?: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};
type RegistrationFixture = Record<string, unknown> & {
  id: string;
  reference: string;
  status: string;
  centreId?: string;
  programmeId?: string;
  amountDue?: number;
  amountDueCurrency?: string;
  consentMedical?: boolean;
  consentData?: boolean;
  publicPayload?: { agreeTerms?: boolean; [key: string]: unknown };
  centreNameSnapshot?: string;
  programmeTitleSnapshot?: string;
  programmeBaseFeeSubmitted?: number;
  linkedPlayerId?: string;
  submissionFingerprint?: string;
  update: (changes: Record<string, unknown>) => Promise<unknown>;
};
type PaymentFixture = Record<string, unknown> & {
  id: string;
  reference?: string;
  registrationId?: string;
  amount?: string;
  currency?: string;
  status: string;
  metadata?: { checkoutUrl?: string; [key: string]: unknown };
  verificationDetails?: { status?: string; [key: string]: unknown };
  update?: (changes: Record<string, unknown>) => Promise<unknown>;
  save: () => Promise<unknown>;
};
type PaystackInitFixture = Record<string, unknown> & {
  amount?: string;
  currency?: string;
  callback_url?: string;
  metadata?: { registration_id?: string; [key: string]: unknown };
};
type PlayerFixture = Record<string, unknown> & {
  registrationStatus?: string;
  officialPlayerId?: string | null;
};
const stringOption = (options: { where: Record<string, unknown> }, key: string): string => {
  const value = options.where[key];
  return typeof value === "string" ? value : "";
};

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.PAYSTACK_CALLBACK_URL = "http://localhost:5173/payment/callback";
process.env.JWT_ACCESS_SECRET =
  "test_access_secret_at_least_thirty_two_characters_long";
process.env.JWT_REFRESH_SECRET =
  "test_refresh_secret_at_least_thirty_two_characters_long";
process.env.PAYSTACK_SECRET_KEY =
  "test_paystack_secret_for_signature_validation";
process.env.PAYSTACK_WEBHOOK_SECRET =
  "test_paystack_webhook_secret_for_signature_validation";
process.env.NOTIFICATIONS_ENABLED = "false";
process.env.CLOUDINARY_CLOUD_NAME = "htt-unit-test-cloud";
process.env.CLOUDINARY_API_KEY = "htt-unit-test-key";
process.env.CLOUDINARY_API_SECRET = "htt-unit-test-secret";

const [
  { passwordSchema, verifyPassword },
  tokens,
  { hasPermission },
  { app },
  { swaggerSpec },
] = await Promise.all([
  import("./password.js"),
  import("./tokens.js"),
  import("./permissionAccess.js"),
  import("../app.js"),
  import("../config/swagger.js"),
]);
const { isAllowedRegistrationTransition, approvalYearInLagos, formatOfficialPlayerId, listRegistrations } =
  await import("../services/registrationService.js");
const { ageGroupFor, ageOnDate, normalizePhone, pageOptions } =
  await import("../services/academyShared.js");
const finance = await import("../services/paymentService.js");
const publicIntakeService = await import("../services/publicIntakeService.js");
const playerService = await import("../services/playerService.js");
const adminResourceController = await import("../controllers/adminResourceController.js");
const { manualPaymentBody } = await import("../validation/paymentSchemas.js");
const { publicIntakeBody } = await import("../validation/publicIntakeSchemas.js");
const { attendanceMarksBody } = await import("../validation/adminResourceSchemas.js");
const { models, sequelize } = await import("../models/index.js");
const { paymentRoutes, paymentVerificationLimiter, paystackWebhookLimiter } = await import("../routes/paymentRoutes.js");
const { publicIntakeRoutes } = await import("../routes/publicIntakeRoutes.js");
const notifications = await import("../services/notificationService.js");
const notificationTemplates =
  await import("../services/notificationTemplates.js");
const { originGuard } = await import("../middleware/originGuard.js");
const { env } = await import("../config/env.js");
const paymentController = await import("../controllers/paymentController.js");
const { startNotificationOutboxWorker } = await import(
  "../services/notificationWorker.js"
);
const { AdminSeedError, seedAdminAccount } = await import(
  "../services/adminSeedService.js"
);
const { adminSeedErrorDetails } = await import(
  "../services/adminSeedDiagnostics.js"
);

const seedAdminPermissionKeys = [
  "dashboard", "players", "guardians", "registrations", "assessments",
  "attendance", "centres", "programmes", "scholarships", "funding",
  "finance", "league", "communications", "content", "staff", "roles",
  "permissions", "reports", "audit", "safeguarding", "settings",
  "staff.create", "staff.update", "staff.deactivate", "staff.assign_roles",
  "roles.manage", "permissions.manage", "payments.refund",
  "safeguarding.read", "audit.read_sensitive",
];
const fakeAdminRole = {
  id: "admin-role-id",
  key: "admin",
  permissions: seedAdminPermissionKeys.map((key) => ({
    key,
    RolePermission: { accessLevel: "full" },
  })),
};
const mockAdminSeedDatabase = (context: TestContext, existingStaff: unknown = null) => {
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  context.mock.method(sequelize, "transaction", async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction) as never);
  context.mock.method(models.Role, "findOne", async () => fakeAdminRole as never);
  context.mock.method(models.Permission, "findAll", async () => seedAdminPermissionKeys.map((key) => ({ key })) as never);
  context.mock.method(models.StaffAccount, "findOne", async () => existingStaff as never);
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);
  return transaction;
};

test("admin seeder creates an Argon2 account and assigns the existing full-permission admin role", async (context) => {
  mockAdminSeedDatabase(context);
  let createdAccount: Record<string, unknown> | undefined;
  let createdRoleLink: Record<string, unknown> | undefined;
  context.mock.method(models.StaffAccount, "create", async (values: Record<string, unknown>) => {
    createdAccount = { ...values, id: "seeded-staff-id" };
    return createdAccount as never;
  });
  context.mock.method(models.StaffRole, "create", async (values: Record<string, unknown>) => {
    createdRoleLink = values;
    return values as never;
  });

  const result = await seedAdminAccount({
    name: "  Academy Admin  ",
    email: "  ADMIN@example.com ",
    password: "ValidStrongPass1!",
  });

  assert.deepEqual(result, { created: true, email: "admin@example.com" });
  assert.equal(createdAccount?.fullName, "Academy Admin");
  assert.equal(createdAccount?.email, "admin@example.com");
  assert.equal(createdAccount?.active, true);
  assert.equal(typeof createdAccount?.passwordHash, "string");
  assert.equal(await verifyPassword(String(createdAccount?.passwordHash), "ValidStrongPass1!"), true);
  assert.equal(createdRoleLink?.staffAccountId, "seeded-staff-id");
  assert.equal(createdRoleLink?.roleId, "admin-role-id");
  const grants = Object.fromEntries(fakeAdminRole.permissions.map((grant) => [grant.key, grant.RolePermission.accessLevel])) as Record<string, "view" | "full">;
  assert.equal(hasPermission(grants, "staff.assign_roles", "full"), true);
  assert.equal(hasPermission(grants, "permissions.manage", "full"), true);
});

test("a seeded administrator can log in and reach a permission-protected admin route", async (context) => {
  const staff = {
    id: "seeded-admin-id",
    fullName: "Academy Admin",
    email: "admin@example.com",
    passwordHash: await (await import("./password.js")).hashPassword("ValidStrongPass1!"),
    active: true,
    suspendedAt: null,
    lastLoginAt: null,
    update: async (values: Record<string, unknown>) => Object.assign(staff, values),
  };
  const roleRows = [{
    role: {
      key: "admin",
      permissions: fakeAdminRole.permissions.map((permission) => ({
        ...permission,
        RolePermission: { accessLevel: "full" },
      })),
    },
  }];
  const session = {
    id: "seeded-admin-session",
    staffAccountId: staff.id,
    familyId: "seeded-admin-family",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    rotatedAt: null,
  };
  context.mock.method(models.StaffAccount, "scope", () => ({
    findOne: async () => staff,
  }) as never);
  context.mock.method(models.StaffRole, "findAll", async () => roleRows as never);
  context.mock.method(models.RefreshSession, "create", async () => session as never);
  context.mock.method(models.RefreshSession, "findByPk", async () => ({
    ...session,
    staffAccount: staff,
  }) as never);
  context.mock.method(models.Permission, "findAll", async () => seedAdminPermissionKeys.map((key) => ({ id: key, key })) as never);
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);

  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  ));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const login = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.com", password: "ValidStrongPass1!" }),
  });
  assert.equal(login.status, 200);
  const cookieHeader = login.headers.get("set-cookie") ?? "";
  const cookies = cookieHeader.split(/, (?=[^;]+=)/).map((cookie) => cookie.split(";")[0]).join("; ");
  assert.match(cookies, /htt_access=/);

  const permissions = await fetch(`${base}/api/v1/permissions`, {
    headers: { cookie: cookies },
  });
  assert.equal(permissions.status, 200);
});

test("admin seeder leaves an existing administrator and its password unchanged", async (context) => {
  const existing = { id: "existing-admin-id" };
  mockAdminSeedDatabase(context, existing);
  context.mock.method(models.StaffRole, "findOne", async () => ({ id: "existing-link" }) as never);
  let accountCreates = 0;
  context.mock.method(models.StaffAccount, "create", async () => {
    accountCreates += 1;
    return {} as never;
  });

  const result = await seedAdminAccount({
    name: "New Name Must Not Apply",
    email: "admin@example.com",
    password: "AnotherStrongPass2!",
  });

  assert.deepEqual(result, { created: false, email: "admin@example.com" });
  assert.equal(accountCreates, 0);
});

test("admin seeder refuses to promote an existing ordinary account", async (context) => {
  mockAdminSeedDatabase(context, { id: "ordinary-staff-id" });
  context.mock.method(models.StaffRole, "findOne", async () => null);
  let roleCreates = 0;
  context.mock.method(models.StaffRole, "create", async () => {
    roleCreates += 1;
    return {} as never;
  });

  await assert.rejects(
    seedAdminAccount({
      name: "Academy Admin",
      email: "ordinary@example.com",
      password: "ValidStrongPass1!",
    }),
    (error: unknown) => error instanceof AdminSeedError,
  );
  assert.equal(roleCreates, 0);
});

test("admin seeder refuses to create an account when the existing admin role lacks grants", async (context) => {
  mockAdminSeedDatabase(context);
  context.mock.method(models.Role, "findOne", async () => ({ ...fakeAdminRole, permissions: [] }) as never);
  let accountCreates = 0;
  context.mock.method(models.StaffAccount, "create", async () => {
    accountCreates += 1;
    return {} as never;
  });

  await assert.rejects(
    seedAdminAccount({
      name: "Academy Admin",
      email: "admin@example.com",
      password: "ValidStrongPass1!",
    }),
    (error: unknown) => error instanceof AdminSeedError,
  );
  assert.equal(accountCreates, 0);
});

test("admin seed diagnostics preserve database causes while redacting credentials", () => {
  const cause = Object.assign(
    new Error("Could not connect using postgres://dbuser:dbpassword@localhost/app; seed password unique-seed-password"),
    {
      code: "ECONNREFUSED",
      sql: "SELECT 'unique-seed-password' FROM staff_accounts",
      table: "staff_accounts",
    },
  );
  const wrapped = new AdminSeedError("The administrator seed database transaction failed.", { cause });
  const details = adminSeedErrorDetails(wrapped, [
    "unique-seed-password",
    "postgres://dbuser:dbpassword@localhost/app",
  ]);
  const serialized = JSON.stringify(details);

  assert.equal(details.postgresCode, null);
  assert.equal(details.systemCode, "ECONNREFUSED");
  assert.equal(details.table, "staff_accounts");
  assert.match(details.sql ?? "", /FROM staff_accounts/);
  assert.equal(serialized.includes("unique-seed-password"), false);
  assert.equal(serialized.includes("dbpassword"), false);
  assert.match(serialized, /Could not connect/);
});

test("notification outbox worker does not schedule or poll when disabled", () => {
  let schedules = 0;
  let polls = 0;
  const timer = startNotificationOutboxWorker({
    enabled: env.NOTIFICATIONS_ENABLED,
    intervalMs: 1000,
    processBatch: async () => { polls += 1; },
    schedule: () => {
      schedules += 1;
      return { unref() {} } as NodeJS.Timeout;
    },
  });

  assert.equal(timer, undefined);
  assert.equal(schedules, 0);
  assert.equal(polls, 0);
});

test("notification outbox worker schedules polling when enabled", async () => {
  let scheduledCallback: (() => void) | undefined;
  let scheduledInterval = 0;
  let polls = 0;
  let unrefCalls = 0;
  const fakeTimer = { unref: () => { unrefCalls += 1; } } as NodeJS.Timeout;
  const timer = startNotificationOutboxWorker({
    enabled: true,
    intervalMs: 2500,
    processBatch: async () => { polls += 1; },
    schedule: (callback, intervalMs) => {
      scheduledCallback = callback;
      scheduledInterval = intervalMs;
      return fakeTimer;
    },
  });

  assert.equal(timer, fakeTimer);
  assert.equal(scheduledInterval, 2500);
  assert.equal(unrefCalls, 1);
  assert.equal(polls, 0);
  scheduledCallback?.();
  assert.equal(polls, 1);
});

test("password policy accepts a strong password and rejects weak passwords", () => {
  assert.equal(passwordSchema.safeParse("ValidStrongPass1!").success, true);
  assert.equal(passwordSchema.safeParse("weakpassword").success, false);
});

test("access token validates signature, issuer, audience, and expiry", () => {
  const good = tokens.createAccessToken("staff-id", "session-id");
  assert.equal(tokens.verifyAccessToken(good).sub, "staff-id");
  const [header, payload, signature] = good.split(".");
  const sig = signature ?? "";
  const alteredSignature = `${sig[0] === "a" ? "b" : "a"}${sig.slice(1)}`;
  assert.throws(() =>
    tokens.verifyAccessToken(`${header}.${payload}.${alteredSignature}`),
  );
  const expired = jwt.sign(
    { sid: "session-id" },
    process.env.JWT_ACCESS_SECRET!,
    {
      algorithm: "HS256",
      subject: "staff-id",
      issuer: "https://api.httacademy.local",
      audience: "htt-academy-web",
      expiresIn: -1,
    },
  );
  assert.throws(() => tokens.verifyAccessToken(expired));
});

test("Swagger declares auth, academy, and finance routes", () => {
  const paths =
    (swaggerSpec as { paths?: Record<string, unknown> }).paths ?? {};
  for (const path of [
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
    "/auth/logout-all",
    "/auth/me",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/change-password",
    "/staff",
    "/staff/{id}",
    "/staff/{id}/status",
    "/roles",
    "/roles/{id}",
    "/permissions",
    "/roles/permissions",
    "/roles/{id}/permissions",
    "/players",
    "/players/{id}",
    "/players/{id}/status",
    "/guardians",
    "/guardians/{id}",
    "/guardians/{id}/players",
    "/players/{id}/guardians",
    "/players/{id}/guardians/{guardianId}",
    "/registrations",
    "/registrations/{id}",
    "/registrations/{id}/approve",
    "/registrations/{id}/reject",
    "/registrations/{id}/request-changes",
    "/registrations/{id}/documents",
    "/centres",
    "/centres/{id}",
    "/centres/{id}/status",
    "/programmes",
    "/programmes/{id}",
    "/programmes/{id}/status",
    "/notifications",
    "/notifications/unread-count",
    "/notifications/{id}",
    "/notifications/{id}/read",
    "/notifications/read-all",
    "/notifications/preferences",
    "/admin/notifications/deliveries",
    "/admin/notifications/deliveries/{id}/retry",
    "/admin/notifications/templates",
    "/admin/notifications/announcements",
    "/admin/notifications/guardians/{id}/sms-consent",
    "/attendance-sessions",
    "/attendance-sessions/{id}/records",
    "/assessments",
    "/scholarship-applications",
    "/scholarship-applications/{id}/approve",
    "/scholarship-awards",
    "/sponsors",
    "/funding-records",
    "/funding-summary",
    "/seasons",
    "/teams",
    "/fixtures",
    "/enquiries",
    "/follow-up-tasks",
    "/sponsorship-enquiries",
    "/stories",
    "/consent-records",
    "/settings",
    "/media/signature",
    "/media/assets",
    "/dashboard/summary",
    "/reports/academy",
    "/audit-logs",
  ]) {
    assert.ok(paths[path], `missing OpenAPI path ${path}`);
  }
  assert.ok(paths["/payments/initialize"]);
  assert.ok(paths["/payments/manual"]);
  assert.ok(paths["/registrations/{id}/profile-image"]);
});

test("payment verification is registered before authentication while administrative payment endpoints remain protected", async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  ));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/payments`;
  for (const [path, method] of [["", "GET"], ["/initialize", "POST"], ["/manual", "POST"], ["/refunds/id/approve", "POST"], ["/webhook/paystack", "POST"]]) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 401, `${method} ${path} must reject unauthenticated access`);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, path === "/webhook/paystack" ? "INVALID_WEBHOOK_SIGNATURE" : "UNAUTHENTICATED");
  }
  const routeStack = paymentRoutes.stack as unknown as RouteStackLayer[];
  const verifyIndex = routeStack.findIndex((layer) => layer.route?.path === "/verify/:reference");
  const authenticateIndex = routeStack.findIndex((layer) => !layer.route);
  const webhookRoute = routeStack.find((layer) => layer.route?.path === "/webhook/paystack");
  const verificationRoute = routeStack.find((layer) => layer.route?.path === "/verify/:reference");
  assert.ok(verifyIndex >= 0);
  assert.ok(authenticateIndex > verifyIndex);
  assert.ok(webhookRoute?.route);
  assert.ok(verificationRoute?.route);
  assert.ok(webhookRoute.route.stack.some((layer) => layer.handle === paystackWebhookLimiter));
  assert.ok(verificationRoute.route.stack.some((layer) => layer.handle === paymentVerificationLimiter));
});

test("Paystack webhook accepts exact raw-body signatures and never processes invalid signatures", async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  let eventWrites = 0;
  const tx = { LOCK: { UPDATE: "UPDATE" }, commit: async () => undefined, rollback: async () => undefined };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => null as never);
  context.mock.method(models.PaymentEvent, "create", async (values: Record<string, unknown>) => {
    eventWrites++;
    return { ...values, id: "webhook-event", save: async () => undefined } as never;
  });
  context.mock.method(models.AuditLog, "create", async () => ({} as never));
  const raw = '{ "event" : "charge.success", "data" : { "id" : 123, "reference" : "pay-ref" } }';
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac("sha512", process.env.PAYSTACK_WEBHOOK_SECRET!)
    .update(`${timestamp}.`)
    .update(Buffer.from(raw))
    .digest("hex");
  const url = `http://127.0.0.1:${address.port}/api/v1/payments/webhook/paystack`;
  const accepted = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json", "Paystack-Signature": `t=${timestamp},v1=whk_test-key:${signature}` }, body: raw,
  });
  assert.equal(accepted.status, 200);
  const rejected = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json", "Paystack-Signature": `t=${timestamp},v1=whk_test-key:${"0".repeat(128)}` }, body: raw,
  });
  assert.equal(rejected.status, 401);
  assert.equal(eventWrites, 1);
});

test("public payment verification rate limit permits normal traffic and rejects repeated requests", async (context) => {
  paymentVerificationLimiter.resetKey("::ffff:127.0.0.1");
  paymentVerificationLimiter.resetKey("127.0.0.1");
  paymentVerificationLimiter.resetKey("::1");
  const server = app.listen(0);
  context.after(() => {
    paymentVerificationLimiter.resetKey("::ffff:127.0.0.1");
    paymentVerificationLimiter.resetKey("127.0.0.1");
    paymentVerificationLimiter.resetKey("::1");
    return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  let verifications = 0;
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => {
    verifications++;
    return null as never;
  });
  const url = `http://127.0.0.1:${address.port}/api/v1/payments/verify/public-ref`;
  const responses: Response[] = [];
  for (let index = 0; index < 13; index++) responses.push(await fetch(url, { method: "POST" }));
  assert.equal(responses.slice(0, 12).every((response) => response.status === 404), true);
  assert.equal(responses[12]?.status, 429);
  assert.equal(verifications, 12);
});

test("official IDs use the Lagos approval year and six-digit sequence", () => {
  assert.equal(approvalYearInLagos(new Date("2026-12-31T23:30:00.000Z")), 2027);
  assert.equal(approvalYearInLagos(new Date("2027-01-01T00:00:00.000Z")), 2027);
  assert.equal(formatOfficialPlayerId(2027, 123), "HTT-2027-000123");
});

test("finance calculations use integer minor units and reject malformed amounts", () => {
  assert.equal(finance.moneyMinor("1234.56"), 123456n);
  assert.equal(finance.fromMinor(123456n), "1234.56");
  assert.throws(() => finance.moneyMinor("1.999"));
  assert.deepEqual(finance.balanceFor("100.00", "125.50"), {
    outstanding: "0.00",
    overpayment: "25.50",
  });
  assert.equal(finance.refundableMinor("100.00", "20.00", "30.00"), 5000n);
  assert.equal(
    finance.refundableMinor("100.00", "20.00", "30.00") <
      finance.moneyMinor("50.01"),
    true,
  );
  assert.equal(
    manualPaymentBody.safeParse({
      payerName: "A Guardian",
      amount: 0,
      method: "cash",
      idempotencyKey: "request-key-123",
      paidAt: "2026-10-29",
      playerId: "2d72b87c-42d6-40cf-a867-818ef75ec16e",
    }).success,
    false,
  );
});

test("Paystack API client sends server credentials and minor-unit amounts and safely handles provider failures", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const client = finance.createPaystackClient(
    {
      secretKey: "test-secret",
      baseUrl: "https://paystack.test",
      timeoutMs: 1000,
    },
    async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            authorization_url: "https://checkout.test/session",
            reference: "provider-ref",
          },
        }),
        { status: 200 },
      );
    },
  );
  const initialized = await client("/transaction/initialize", {
    email: "guardian@example.com",
    amount: "2500",
    reference: "provider-ref",
  });
  assert.equal(capturedUrl, "https://paystack.test/transaction/initialize");
  assert.equal(
    new Headers(capturedInit?.headers).get("authorization"),
    "Bearer test-secret",
  );
  assert.equal(JSON.parse(String(capturedInit?.body)).amount, "2500");
  assert.equal(initialized.reference, "provider-ref");
  const failingClient = finance.createPaystackClient(
    {
      secretKey: "test-secret",
      baseUrl: "https://paystack.test",
      timeoutMs: 1000,
    },
    async () => {
      throw new Error("network down");
    },
  );
  await assert.rejects(failingClient("/transaction/verify/ref"), {
    code: "PAYSTACK_UNAVAILABLE",
  });
});

test("payment initialization uses registration fees, returns checkout URL, and reuses the idempotent request", async (context) => {
  let existing: Record<string, unknown> | null = null;
  let transactionCommits = 0,
    providerCalls = 0,
    initializedAmount = "",
    initializedCallback = "";
  const tx = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => {
      transactionCommits++;
    },
    rollback: async () => undefined,
  };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => existing as never);
  context.mock.method(models.Payment, "findAll", async () => []);
  context.mock.method(
    models.Registration,
    "unscoped",
    () => models.Registration,
  );
  context.mock.method(
    models.Registration,
    "findByPk",
    async () =>
      ({
        id: "registration-id",
        amountDue: "75.50",
        guardianEmail: "guardian@example.com",
        guardianName: "Guardian",
        childName: "Player",
        linkedPlayerId: "player-id",
        guardianId: "guardian-id",
        programmeId: "programme-id",
        centreId: null,
      }) as never,
  );
  context.mock.method(models.Programme, "findByPk", async () => ({ id: "programme-uuid", approvedFee: "85000.00", currency: "NGN", status: "active", availability: "open" }) as never);
  context.mock.method(
    models.Payment,
    "create",
    async (data: Record<string, unknown>) => {
      existing = {
        ...data,
        id: "payment-id",
        metadata: {},
        update: async (changes: Record<string, unknown>) => {
          if (existing) Object.assign(existing, changes);
        },
      };
      return existing as never;
    },
  );
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);
  context.mock.method(
    models.NotificationOutbox,
    "create",
    async (values: Record<string, unknown>) => values as never,
  );
  context.mock.method(
    globalThis,
    "fetch",
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      providerCalls++;
      const requestBody = JSON.parse(String(init?.body));
      initializedAmount = requestBody.amount;
      initializedCallback = requestBody.callback_url;
      return new Response(
        JSON.stringify({
          status: true,
          data: { authorization_url: "https://checkout.test/session" },
        }),
        { status: 200 },
      );
    },
  );
  const input = {
    registrationId: "registration-id",
    idempotencyKey: "payment-request-001",
    purpose: "registration",
  } as const;
  const first = await finance.initializePayment(input, "staff-id");
  const repeated = await finance.initializePayment(input, "staff-id");
  assert.equal(initializedAmount, "7550");
  assert.equal(initializedCallback, "http://localhost:5173/payment/callback");
  assert.equal(first.authorizationUrl, "https://checkout.test/session");
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.authorizationUrl, first.authorizationUrl);
  assert.equal(providerCalls, 1);
  assert.equal(transactionCommits, 2);

  existing = null;
  const programmePayment = await finance.initializePayment({
    registrationId: "registration-id",
    idempotencyKey: "programme-fee-request-001",
    purpose: "programme_fee",
  }, "staff-id");
  assert.equal(programmePayment.payment.amount, "85000.00");
  assert.equal(programmePayment.payment.registrationId, "registration-id");
  assert.equal(initializedAmount, "8500000");
  assert.equal(initializedCallback, "http://localhost:5173/payment/callback");
  assert.equal(providerCalls, 2);
});

test("public registration resolves website slugs and creates one linked NGN 40,000 payment across retries", async (context) => {
  let registration: RegistrationFixture | null = null;
  let payment: PaymentFixture | null = null;
  let pendingPlayer: PlayerFixture | null = null;
  const registrationsByFingerprint = new Map<string, RegistrationFixture>();
  const paymentsByIdempotencyKey = new Map<string, PaymentFixture>();
  let registrationCreates = 0;
  let playerCreates = 0;
  let paymentCreates = 0;
  let cloudinaryUploads = 0;
  let paystackInitializations = 0;
  let failNextPaystackInitialization = false;
  let paystackRequest: unknown = null;
  const currentRegistration = (): RegistrationFixture => registration as RegistrationFixture;
  const currentPayment = (): PaymentFixture => payment as PaymentFixture;
  const currentPendingPlayer = (): PlayerFixture => pendingPlayer as PlayerFixture;
  const currentPaystackRequest = (): PaystackInitFixture => paystackRequest as PaystackInitFixture;
  let centreSlug: string | undefined;
  let programmeSlug: string | undefined;
  const tx = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => undefined,
    rollback: async () => undefined,
  };
  context.mock.method(sequelize, "transaction", async (...args: unknown[]) => {
    const callback = args[0];
    return typeof callback === "function" ? callback(tx) : tx;
  });
  context.mock.method(models.Registration, "unscoped", () => models.Registration);
  context.mock.method(models.Registration, "findOne", async (options: { where: Record<string, unknown> }) => registrationsByFingerprint.get(stringOption(options, "submissionFingerprint")) as never);
  context.mock.method(models.Registration, "findByPk", async () => registration as never);
  context.mock.method(models.Registration, "create", async (values: Record<string, unknown>) => {
    registrationCreates++;
    registration = {
      ...values,
      id: "registration-uuid",
      reference: "HTT-REG-TEST",
      status: "submitted",
      update: async (changes: Record<string, unknown>) => Object.assign(registration as RegistrationFixture, changes),
    } as RegistrationFixture;
    registrationsByFingerprint.set(String(values.submissionFingerprint), registration as RegistrationFixture);
    return registration as never;
  });
  context.mock.method(models.Centre, "findOne", async (options: { where: Record<string, unknown> }) => {
    const slug = options.where.slug;
    if (typeof slug === "string") centreSlug = slug;
    return { id: "centre-uuid", name: "Magodo Lagos Training Centre", status: "open_for_registration", reviewStatus: "approved", proposedArea: false } as never;
  });
  context.mock.method(models.Centre, "findByPk", async () => ({ id: "centre-uuid", name: "Magodo Lagos Training Centre", status: "open_for_registration", reviewStatus: "approved", proposedArea: false }) as never);
  context.mock.method(models.Programme, "findOne", async (options: { where: Record<string, unknown> }) => {
    const slug = options.where.slug;
    if (typeof slug === "string") programmeSlug = slug;
    return { id: "programme-uuid", name: "Beginners", approvedFee: "85000.00", currency: "NGN", status: "active" } as never;
  });
  context.mock.method(models.Programme, "findByPk", async () => ({ id: "programme-uuid", approvedFee: "85000.00", currency: "NGN", status: "active", availability: "open" }) as never);
  context.mock.method(models.CentreProgramme, "findOne", async () => ({ centreId: "centre-uuid", programmeId: "programme-uuid" }) as never);
  context.mock.method(models.ApplicationSettings, "findOne", async () => null as never);
  context.mock.method(models.MediaAsset, "create", async () => ({ id: "profile-asset-id" }) as never);
  context.mock.method(models.Player, "unscoped", () => models.Player);
  context.mock.method(models.Player, "create", async (values: Record<string, unknown>) => {
    playerCreates++;
    pendingPlayer = { ...values, id: "pending-player-id" } as PlayerFixture;
    return pendingPlayer as never;
  });
  context.mock.method(models.EmergencyContact, "create", async (values: Record<string, unknown>) => values as never);
  context.mock.method(models.RegistrationDocument, "create", async (values: Record<string, unknown>) => values as never);
  context.mock.method(models.RegistrationStatusHistory, "create", async (values: Record<string, unknown>) => values as never);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async (options: { where: Record<string, unknown> }) => paymentsByIdempotencyKey.get(stringOption(options, "idempotencyKey")) as never);
  context.mock.method(models.Payment, "findAll", async () => [] as never);
  context.mock.method(models.Payment, "create", async (values: Record<string, unknown>) => {
    paymentCreates++;
    payment = {
      ...values,
      id: "payment-uuid",
      metadata: {},
      update: async (changes: Record<string, unknown>) => Object.assign(payment as PaymentFixture, changes),
      save: async () => undefined,
    } as PaymentFixture;
    paymentsByIdempotencyKey.set(String(values.idempotencyKey), payment as PaymentFixture);
    return payment as never;
  });
  context.mock.method(models.AuditLog, "create", async (values: Record<string, unknown>) => values as never);
  context.mock.method(models.NotificationOutbox, "create", async (values: Record<string, unknown>) => values as never);
  context.mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const target = String(url);
    if (target.includes("api.cloudinary.com")) {
      cloudinaryUploads++;
      return new Response(JSON.stringify({
        public_id: "htt-academy-private/registration-profiles/test-image",
        secure_url: "https://res.cloudinary.com/htt-unit-test-cloud/image/authenticated/test-image",
        bytes: 5,
        type: "authenticated",
      }), { status: 200 });
    }
    if (target === "https://api.paystack.co/transaction/initialize") {
      paystackInitializations++;
      paystackRequest = JSON.parse(String(init?.body));
      if (failNextPaystackInitialization) {
        failNextPaystackInitialization = false;
        throw new Error("simulated provider timeout");
      }
      return new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.test/public-registration" } }), { status: 200 });
    }
    throw new Error(`Unexpected outbound request in test: ${target}`);
  });

  const input = {
    agreeTerms: true,
    centre: { name: "Centre label from website", uuid: "magodo" },
    programme: { title: "Programme label from website", uuid: "ogudu-programme-1", baseFee: 85000 },
    payment: { frequency: "registration", fee: 40000 },
    player: { name: "Public Player", gender: "female", dob: "2012-03-04", school: "", className: "", positionUuid: "" },
    guardian: { name: "Guardian", relationship: "mother", phone: "+2348012345678", email: "guardian@example.test", address: "", alternativePhone: "" },
    emergencyContact: { name: "Emergency", phone: "+2348098765432" },
    consentMedical: true,
  } as const;
  const image = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]), mimeType: "image/jpeg" as const, originalName: "player.jpg" };
  const first = await publicIntakeService.submitPublicRegistration(input, "127.0.0.1", image);
  const retry = await publicIntakeService.submitPublicRegistration(input, "127.0.0.1", image);

  assert.equal(centreSlug, "magodo");
  assert.equal(programmeSlug, "ogudu-programme-1");
  assert.equal(registrationCreates, 1);
  assert.equal(playerCreates, 1);
  assert.equal(paymentCreates, 1);
  assert.equal(cloudinaryUploads, 1);
  assert.equal(paystackInitializations, 1);
  assert.equal(currentRegistration().centreId, "centre-uuid");
  assert.equal(currentRegistration().programmeId, "programme-uuid");
  assert.equal(currentRegistration().amountDue, 40000);
  assert.equal(currentRegistration().amountDueCurrency, "NGN");
  assert.equal(currentRegistration().consentMedical, true);
  assert.equal(currentRegistration().consentData, false);
  assert.equal(currentRegistration().publicPayload?.agreeTerms, true);
  assert.equal(currentRegistration().centreNameSnapshot, "Magodo Lagos Training Centre");
  assert.equal(currentRegistration().programmeTitleSnapshot, "Beginners");
  assert.equal(currentRegistration().programmeBaseFeeSubmitted, 85000);
  assert.equal(currentRegistration().linkedPlayerId, "pending-player-id");
  assert.equal(currentPendingPlayer().registrationStatus, "pending");
  assert.equal(currentPendingPlayer().officialPlayerId, null);
  assert.equal(currentRegistration().submissionFingerprint?.length, 64);
  assert.equal(currentPayment().registrationId, "registration-uuid");
  assert.equal(currentPayment().amount, "40000.00");
  assert.equal(currentPayment().currency, "NGN");
  assert.equal(currentPayment().status, "pending");
  assert.equal(env.PAYSTACK_CALLBACK_URL, "http://localhost:5173/payment/callback");
  assert.equal(currentPaystackRequest().amount, "4000000");
  assert.equal(currentPaystackRequest().currency, "NGN");
  assert.equal(currentPaystackRequest().callback_url, "http://localhost:5173/payment/callback");
  assert.equal(currentPaystackRequest().metadata?.registration_id, "registration-uuid");
  assert.equal(first.registrationId, "registration-uuid");
  assert.equal(first.paymentReference, currentPayment().reference);
  assert.equal(first.payment.reference, currentPayment().reference);
  assert.equal(first.payment.authorizationUrl, "https://checkout.test/public-registration");
  assert.equal(retry.duplicate, true);
  assert.equal(retry.payment.duplicate, true);
  assert.equal(retry.payment.authorizationUrl, first.payment.authorizationUrl);

  const timedOutInput = { ...input, player: { ...input.player, name: "Timeout Retry Player" } };
  failNextPaystackInitialization = true;
  let timedOutDetails: Record<string, unknown> = {};
  await assert.rejects(
    publicIntakeService.submitPublicRegistration(timedOutInput, "127.0.0.1", image),
    (error: unknown) => {
      if (!error || typeof error !== "object") return false;
      const failure = error as { statusCode?: number; code?: string; details?: unknown };
      timedOutDetails = failure.details && typeof failure.details === "object" ? failure.details as Record<string, unknown> : {};
      return failure.statusCode === 503 && failure.code === "PAYMENT_INITIALIZATION_UNKNOWN";
    },
  );
  let recoveredDetails: Record<string, unknown> = {};
  await assert.rejects(
    publicIntakeService.submitPublicRegistration(timedOutInput, "127.0.0.1", image),
    (error: unknown) => {
      if (!error || typeof error !== "object") return false;
      const failure = error as { statusCode?: number; code?: string; details?: unknown };
      recoveredDetails = failure.details && typeof failure.details === "object" ? failure.details as Record<string, unknown> : {};
      return failure.statusCode === 503 && failure.code === "PAYMENT_INITIALIZATION_UNKNOWN";
    },
  );
  assert.equal(timedOutDetails.registrationId, "registration-uuid");
  assert.equal(timedOutDetails.paymentReference, currentPayment().reference);
  assert.equal(timedOutDetails.needsVerification, true);
  assert.equal(recoveredDetails.duplicate, true);
  assert.equal(recoveredDetails.registrationId, timedOutDetails.registrationId);
  assert.equal(recoveredDetails.paymentReference, timedOutDetails.paymentReference);
  assert.equal(recoveredDetails.needsVerification, true);
  assert.equal(registrationCreates, 2);
  assert.equal(playerCreates, 2);
  assert.equal(paymentCreates, 2);
  assert.equal(cloudinaryUploads, 2);
  assert.equal(paystackInitializations, 2);

  const legacyInput = {
    child_name: "Legacy Player", guardian_name: "Legacy Guardian", guardian_phone: "+2348012345678",
    guardian_email: "legacy@example.test", guardian_address: "", child_date_of_birth: "2013-02-01",
    centre_id: "550e8400-e29b-41d4-a716-446655440000", programme_id: "550e8400-e29b-41d4-a716-446655440001",
    age_group: "11-12", pathway: "paid_academy", consent_data: true,
  } as const;
  const legacyParsed = publicIntakeBody.safeParse({ action: "submit_registration", registration: legacyInput });
  assert.equal(legacyParsed.success, true);
  const legacyFirst = await publicIntakeService.submitPublicRegistration(legacyInput, "127.0.0.1");
  const legacyRetry = await publicIntakeService.submitPublicRegistration(legacyInput, "127.0.0.1");
  assert.equal(legacyFirst.payment.authorizationUrl, "https://checkout.test/public-registration");
  assert.equal(legacyRetry.duplicate, true);
  assert.equal(registrationCreates, 3);
  assert.equal(paymentCreates, 3);
  assert.equal(paystackInitializations, 3);

  const legacyTimeout = { ...legacyInput, child_name: "Legacy Timeout Player" };
  failNextPaystackInitialization = true;
  await assert.rejects(publicIntakeService.submitPublicRegistration(legacyTimeout, "127.0.0.1"), { statusCode: 503, code: "PAYMENT_INITIALIZATION_UNKNOWN" });
  await assert.rejects(publicIntakeService.submitPublicRegistration(legacyTimeout, "127.0.0.1"), { statusCode: 503, code: "PAYMENT_INITIALIZATION_UNKNOWN" });
  assert.equal(registrationCreates, 4);
  assert.equal(paymentCreates, 4);
  assert.equal(paystackInitializations, 4);
});

test("public payment summary reloads the existing checkout details without exposing contact data or creating payments", async (context) => {
  assert.ok((publicIntakeRoutes.stack as unknown as RouteStackLayer[]).some((layer) => layer.route?.path === "/payments/:reference" && layer.route.methods?.get));
  const payment = {
    id: "payment-uuid",
    reference: "HTT-PAY-TEST-REFERENCE-123456",
    registrationId: "registration-uuid",
    method: "paystack",
    purpose: "registration",
    amount: "40000.00",
    currency: "NGN",
    status: "pending",
    providerStatus: "initialized",
    verifiedAt: null,
    metadata: { checkoutUrl: "https://checkout.test/existing-session", guardianEmail: "private@example.test" },
  };
  let paymentCreates = 0;
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => payment as never);
  context.mock.method(models.Payment, "create", async () => { paymentCreates++; return payment as never; });
  context.mock.method(models.Registration, "unscoped", () => models.Registration);
  context.mock.method(models.Registration, "findByPk", async () => ({
    id: "registration-uuid", childName: "Player Name", centreId: "centre-uuid", programmeId: "programme-uuid",
    guardianEmail: "private@example.test", guardianPhone: "+2348000000000",
  }) as never);
  context.mock.method(models.Centre, "findByPk", async () => ({ name: "Magodo Lagos Training Centre" }) as never);
  context.mock.method(models.Programme, "findByPk", async () => ({ name: "Beginners" }) as never);

  const summary = await publicIntakeService.getPublicPaymentSummary(payment.reference);
  assert.deepEqual(summary, {
    registration: { id: "registration-uuid", playerName: "Player Name", centreName: "Magodo Lagos Training Centre", programmeName: "Beginners" },
    payment: { reference: payment.reference, amount: "40000.00", currency: "NGN", status: "pending", providerStatus: "initialized", verifiedAt: null, authorizationUrl: "https://checkout.test/existing-session" },
  });
  assert.equal(JSON.stringify(summary).includes("private@example.test"), false);
  assert.equal(JSON.stringify(summary).includes("+2348000000000"), false);
  assert.equal(paymentCreates, 0);
  await assert.rejects(publicIntakeService.getPublicPaymentSummary("short"), { code: "INVALID_PAYMENT_REFERENCE" });
});

test("public selection resolver rejects unknown centre and programme slugs", async (context) => {
  let centreResult: { id: string; name: string } | null = { id: "centre-uuid", name: "Magodo Lagos Training Centre" };
  let programmeResult: { id: string; availability: string } | null = null;
  context.mock.method(models.Centre, "findOne", async () => centreResult as never);
  context.mock.method(models.Programme, "findOne", async () => programmeResult as never);
  context.mock.method(models.CentreProgramme, "findOne", async () => ({ centreId: "centre-uuid", programmeId: "programme-uuid" }) as never);

  centreResult = null;
  await assert.rejects(publicIntakeService.resolvePublicSelections("unknown-centre", "ogudu-programme-1"), { code: "INVALID_CENTRE" });
  centreResult = { id: "centre-uuid", name: "Magodo Lagos Training Centre" };
  await assert.rejects(publicIntakeService.resolvePublicSelections("magodo", "unknown-programme"), { code: "INVALID_PROGRAMME" });
  programmeResult = { id: "programme-uuid", availability: "closed" };
  await assert.rejects(publicIntakeService.resolvePublicSelections("magodo", "ogudu-programme-1"), { code: "PROGRAMME_UNAVAILABLE" });
  programmeResult = { id: "programme-uuid", availability: "open" };
  assert.deepEqual(await publicIntakeService.resolvePublicSelections("magodo", "ogudu-programme-1"), { centreId: "centre-uuid", programmeId: "programme-uuid" });
});

test("both public registration request shapes require approval fields and payer details", () => {
  const legacy = {
    child_name: "Legacy Player", guardian_name: "Guardian", guardian_phone: "+2348012345678",
    guardian_email: "guardian@example.test", child_date_of_birth: "2012-03-04",
    centre_id: "550e8400-e29b-41d4-a716-446655440000", programme_id: "550e8400-e29b-41d4-a716-446655440001",
  };
  assert.equal(publicIntakeBody.safeParse({ action: "submit_registration", registration: legacy }).success, true);
  assert.equal(publicIntakeBody.safeParse({ action: "submit_registration", registration: { ...legacy, child_date_of_birth: undefined } }).success, false);
  assert.equal(publicIntakeBody.safeParse({ action: "submit_registration", registration: { ...legacy, guardian_email: "" } }).success, false);
  assert.equal(publicIntakeBody.safeParse({ action: "submit_registration", registration: { ...legacy, programme_id: "" } }).success, false);
});

test("registration verification matches NGN naira records to Paystack kobo and keeps unsuccessful payments unpaid", async (context) => {
  let providerState: Record<string, unknown> = {
    id: 987654,
    reference: "provider-ref",
    amount: 2000,
    currency: "NGN",
    status: "pending",
    customer: { email: "guardian@example.com" },
  };
  let commits = 0;
  let paymentCreates = 0;
  const tx = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => {
      commits++;
    },
    rollback: async () => undefined,
  };
  const payment: PaymentFixture & {
    gatewayReference: string; amount: string; currency: string; payerEmail: string;
    method: string; refundAmount: string; receiptNumber: string | null;
    registrationId: string; providerTransactionId?: string; verifiedAmount?: string;
    verifiedCurrency?: string;
  } = {
    id: "payment-id",
    reference: "internal-ref",
    gatewayReference: "provider-ref",
    amount: "40000.00",
    currency: "NGN",
    payerEmail: "guardian@example.com",
    method: "paystack",
    status: "pending",
    refundAmount: "0.00",
    receiptNumber: null,
    registrationId: "registration-id",
    save: async () => undefined,
  };
  const registration = {
    id: "registration-id",
    amountDue: "40000.00",
    amountDueCurrency: "NGN",
    paymentStatus: "unpaid",
    save: async () => undefined,
    toJSON: () => ({ id: registration.id, paymentStatus: registration.paymentStatus }),
  };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => payment as never);
  context.mock.method(models.Payment, "findByPk", async () => payment as never);
  context.mock.method(models.Payment, "findAll", async () => [payment] as never);
  context.mock.method(models.Payment, "create", async () => { paymentCreates++; return payment as never; });
  context.mock.method(models.Registration, "unscoped", () => models.Registration);
  context.mock.method(models.Registration, "findByPk", async () => registration as never);
  context.mock.method(models.Registration, "findAndCountAll", async () => ({ rows: [registration], count: 1 }) as never);
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);
  context.mock.method(
    models.NotificationOutbox,
    "create",
    async (values: Record<string, unknown>) => values as never,
  );
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ status: true, data: providerState }), {
        status: 200,
      }),
  );
  await assert.rejects(finance.verifyPayment("provider-ref", "staff-id"), {
    code: "AMOUNT_MISMATCH",
  });
  providerState = { ...providerState, amount: 4_000_000 };
  const pending = await finance.verifyPayment("provider-ref", "staff-id");
  assert.equal(pending.status, "pending");
  assert.equal(payment.status, "pending");
  assert.equal(registration.paymentStatus, "unpaid");
  providerState = { ...providerState, status: "failed" };
  const failed = await finance.verifyPayment("provider-ref", "staff-id");
  assert.equal(failed.status, "failed");
  assert.equal(registration.paymentStatus, "unpaid");
  payment.status = "pending";
  providerState = { ...providerState, status: "abandoned" };
  const abandoned = await finance.verifyPayment("provider-ref", "staff-id");
  assert.equal(abandoned.status, "cancelled");
  assert.equal(payment.status, "cancelled");
  payment.status = "pending";
  const unpaidAdminRegistrations = await listRegistrations({}, { playerData: false, guardianData: false, internal: false });
  assert.equal(unpaidAdminRegistrations.items[0]?.paymentStatus, "unpaid");
  providerState = { ...providerState, status: "success" };
  const successful = await finance.verifyPayment("provider-ref", "staff-id");
  assert.equal(successful.status, "successful");
  assert.equal(successful.status, "successful", "the verification data.status contract is the public callback's success signal");
  assert.ok(successful.receiptNumber);
  assert.equal(payment.providerTransactionId, "987654");
  assert.equal(payment.verifiedAmount, "40000.00");
  assert.equal(payment.verifiedCurrency, "NGN");
  assert.equal(payment.verificationDetails?.status, "success");
  assert.equal(registration.paymentStatus, "paid");
  let verifyResponse: { success?: unknown; data?: { status?: unknown } } | undefined;
  await new Promise<void>((resolve, reject) => {
    paymentController.verify(
      { params: { reference: "provider-ref" }, ip: "127.0.0.1" } as unknown as Request,
      { json: (body: unknown) => { verifyResponse = body as { success?: unknown; data?: { status?: unknown } }; resolve(); } } as unknown as ExpressResponse,
      reject,
    );
  });
  assert.equal(verifyResponse?.success, true);
  assert.equal(verifyResponse?.data?.status, "successful");
  const adminRegistrations = await listRegistrations({}, { playerData: false, guardianData: false, internal: false });
  assert.equal(adminRegistrations.items[0]?.paymentStatus, "paid");
  await finance.verifyPayment("provider-ref", "staff-id");
  assert.equal(paymentCreates, 0);
  assert.equal(registration.paymentStatus, "paid");
  assert.equal(commits, 6);
});

test("refund requests reserve amounts and reject excessive retries", async (context) => {
  let commits = 0,
    rollbacks = 0;
  const tx = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => {
      commits++;
    },
    rollback: async () => {
      rollbacks++;
    },
  };
  const payment = {
    id: "payment-id",
    amount: "100.00",
    refundAmount: "20.00",
    currency: "NGN",
    status: "partially_refunded",
  };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "findByPk", async () => payment as never);
  context.mock.method(models.Refund, "findAll", async () => []);
  context.mock.method(
    models.Refund,
    "create",
    async (data: Record<string, unknown>) =>
      ({ ...data, id: "refund-id" }) as never,
  );
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);
  context.mock.method(
    models.NotificationOutbox,
    "create",
    async (values: Record<string, unknown>) => values as never,
  );
  const requested = await finance.requestRefund(
    payment.id,
    { amount: "50.00", reason: "Approved refund request" },
    "staff-id",
  );
  assert.equal(requested.status, "requested");
  await assert.rejects(
    finance.requestRefund(
      payment.id,
      { amount: "80.01", reason: "Excessive refund request" },
      "staff-id",
    ),
    { code: "REFUND_EXCEEDS_REMAINDER" },
  );
  assert.equal(commits, 1);
  assert.equal(rollbacks, 1);
});

test("duplicate provider webhook delivery is acknowledged once", async (context) => {
  let delivered = false,
    commits = 0,
    rollbacks = 0;
  const tx = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => {
      commits++;
    },
    rollback: async () => {
      rollbacks++;
    },
  };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => null);
  context.mock.method(models.PaymentEvent, "create", async () => {
    if (delivered) {
      const error = new Error("duplicate event");
      error.name = "SequelizeUniqueConstraintError";
      throw error;
    }
    delivered = true;
    return { save: async () => undefined } as never;
  });
  const event = { event: "test.event", data: { id: "event-1" } };
  assert.deepEqual(await finance.processPaystackWebhook(event), {
    received: true,
    duplicate: false,
  });
  assert.deepEqual(await finance.processPaystackWebhook(event), {
    received: true,
    duplicate: true,
  });
  assert.equal(commits, 1);
  assert.equal(rollbacks, 1);
});

test("webhook event identities are stable, distinguish payload changes, and reject sparse events", () => {
  const first = { event: "refund.pending", data: { transaction_reference: "transaction-1", amount: "500", status: "pending" } };
  assert.equal(finance.paystackWebhookEventId(first), finance.paystackWebhookEventId(JSON.parse(JSON.stringify(first))));
  assert.notEqual(finance.paystackWebhookEventId(first), finance.paystackWebhookEventId({ ...first, data: { ...first.data, amount: "600" } }));
  assert.equal(finance.paystackWebhookEventId({ event: "charge.success", data: { id: 123 } }), "charge.success:123");
  assert.equal(finance.paystackWebhookEventId({ event: "ping" }), "ping");
  assert.throws(() => finance.paystackWebhookEventId({ event: "charge.success" }), { code: "INVALID_WEBHOOK" });
  assert.throws(() => finance.paystackWebhookEventId({ event: "charge.success", data: {} }), { code: "WEBHOOK_IDENTITY_MISSING" });
});

test("refund webhook matching uses provider references and quarantines ambiguous amounts", () => {
  const candidates = [
    { id: "refund-a", reference: "HTT-REF-A", gatewayReference: "101", providerRefundReference: "provider-a", amount: "5.00" },
    { id: "refund-b", reference: "HTT-REF-B", gatewayReference: "102", providerRefundReference: "provider-b", amount: "5.00" },
  ];
  assert.equal(finance.matchPaystackRefund(candidates, { refund_reference: "provider-b", amount: "500" }).refund?.id, "refund-b");
  assert.deepEqual(finance.matchPaystackRefund(candidates, { amount: "500" }), { refund: null, ambiguous: true });
  assert.deepEqual(finance.matchPaystackRefund(candidates, { refund_reference: "unknown", amount: "500" }), { refund: null, ambiguous: false });
  assert.deepEqual(finance.matchPaystackRefund(candidates, { amount: "invalid" }), { refund: null, ambiguous: true });
});

test("unmatched refund webhooks are retained for reconciliation without changing a refund", async (context) => {
  let eventRecord: { processingStatus: string; payload: Record<string, unknown> } | undefined;
  let delivered = false;
  let auditWrites = 0;
  let commits = 0;
  let rollbacks = 0;
  const tx = { LOCK: { UPDATE: "UPDATE" }, commit: async () => { commits++; }, rollback: async () => { rollbacks++; } };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => null as never);
  context.mock.method(models.PaymentEvent, "create", async (values: Record<string, unknown>) => {
    if (delivered) {
      const error = new Error("duplicate webhook identity");
      error.name = "SequelizeUniqueConstraintError";
      throw error;
    }
    delivered = true;
    eventRecord = { ...values, id: "event-row", save: async () => undefined } as unknown as { processingStatus: string; payload: Record<string, unknown> };
    return eventRecord as never;
  });
  context.mock.method(models.AuditLog, "create", async () => { auditWrites++; return {} as never; });
  const result = await finance.processPaystackWebhook({
    event: "refund.pending",
    data: { transaction_reference: "missing-payment", refund_reference: null, amount: "500", currency: "NGN", status: "pending" },
  });
  assert.equal(result.received, true);
  assert.equal((await finance.processPaystackWebhook({
    event: "refund.pending",
    data: { transaction_reference: "missing-payment", refund_reference: null, amount: "500", currency: "NGN", status: "pending" },
  })).duplicate, true);
  assert.equal(eventRecord?.processingStatus, "needs_reconciliation");
  assert.equal(eventRecord?.payload.reference, "missing-payment");
  assert.equal(auditWrites, 1);
  assert.equal(commits, 1);
  assert.equal(rollbacks, 1);
});

test("attendance rejects duplicate player IDs and counts persisted unique records", async (context) => {
  type AttendanceRecordMock = {
    playerId: string;
    status: string;
    sessionId?: string;
    notes?: string | null;
    update: (data: Record<string, unknown>) => Promise<unknown>;
  };
  type AttendanceSessionMock = {
    id: string;
    centreId: string;
    status: string;
    presentCount?: number;
    absentCount?: number;
    update: (data: Record<string, unknown>) => Promise<unknown>;
  };
  const playerOne = "550e8400-e29b-41d4-a716-446655440001";
  const playerTwo = "550e8400-e29b-41d4-a716-446655440002";
  const playerThree = "550e8400-e29b-41d4-a716-446655440003";
  const validInput = { records: [
    { playerId: playerTwo, status: "present" },
    { playerId: playerThree, status: "late" },
  ] };
  assert.equal(attendanceMarksBody.safeParse(validInput).success, true);
  assert.equal(attendanceMarksBody.safeParse({ records: [...validInput.records, { playerId: playerTwo, status: "absent" }] }).success, false);

  const persisted = new Map<string, AttendanceRecordMock>();
  const existing: AttendanceRecordMock = { playerId: playerOne, status: "absent", update: async (data) => Object.assign(existing, data) };
  persisted.set(playerOne, existing);
  const session: AttendanceSessionMock = {
    id: "session-id", centreId: "centre-id", status: "scheduled",
    update: async (data) => Object.assign(session, data),
  };
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  context.mock.method(sequelize, "transaction", async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
  context.mock.method(models.AttendanceSession, "findByPk", async () => session as never);
  context.mock.method(models.Player, "findAll", async () => [playerTwo, playerThree].map((id) => ({ id })) as never);
  context.mock.method(models.AttendanceRecord, "findOrCreate", async (options: { where: { playerId: string }; defaults: { playerId: string; status: string; sessionId: string; notes?: string | null } }) => {
    let row = persisted.get(options.where.playerId);
    const created = !row;
    if (!row) {
      const createdRow: AttendanceRecordMock = {
        playerId: options.defaults.playerId,
        status: options.defaults.status,
        sessionId: options.defaults.sessionId,
        notes: options.defaults.notes,
        update: async (data) => Object.assign(createdRow, data),
      };
      row = createdRow;
      persisted.set(options.where.playerId, row);
    }
    if (!created) await row.update(options.defaults);
    return [row, created] as never;
  });
  context.mock.method(models.AttendanceRecord, "findAll", async () => [...persisted.values()] as never);
  context.mock.method(models.AuditLog, "create", async () => ({} as never));
  const req = { params: { id: "session-id" }, body: validInput, auth: { staffId: "staff-id" }, ip: "127.0.0.1", get: () => "test" } as unknown as Request;
  await new Promise<void>((resolve, reject) => {
    const response = { json: () => { resolve(); return response; } } as unknown as ExpressResponse;
    adminResourceController.saveAttendanceMarks(req, response, reject);
  });
  assert.equal(session.presentCount, 2);
  assert.equal(session.absentCount, 1);
  assert.equal(persisted.size, 3);
});

test("attendance deletion rolls back if its required audit record cannot be written", async (context) => {
  let destroyed = false;
  let committed = false;
  let rolledBack = false;
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  context.mock.method(sequelize, "transaction", async (callback: (transaction: typeof tx) => Promise<unknown>) => {
    try {
      const result = await callback(tx as never);
      committed = true;
      return result;
    } catch (error) {
      rolledBack = true;
      throw error;
    }
  });
  context.mock.method(models.AttendanceSession, "findByPk", async () => ({ destroy: async () => { destroyed = true; } }) as never);
  context.mock.method(models.AuditLog, "create", async () => { throw new Error("audit storage unavailable"); });
  const req = { params: { id: "session-id" }, auth: { staffId: "staff-id" }, ip: "127.0.0.1", get: () => "test" } as unknown as Request;
  await assert.rejects(new Promise<void>((resolve, reject) => {
    const response = { json: () => { resolve(); return response; } } as unknown as ExpressResponse;
    adminResourceController.deleteAdminResource("AttendanceSession")(req, response, reject);
  }));
  assert.equal(destroyed, true);
  assert.equal(committed, false);
  assert.equal(rolledBack, true);
});

test("authorized manual player creation is audited separately and does not claim payment verification", async (context) => {
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  let createdValues: Record<string, unknown> = {};
  let auditValues: Record<string, unknown> = {};
  const createdPlayer: Record<string, unknown> = {
    id: "manual-player-id", playerCode: "HTT-P-TEST", fullName: "Manual Player", dateOfBirth: "2012-01-01",
    ageGroup: "11-12", registrationStatus: "registered", archived: false, registrationId: null,
  };
  context.mock.method(sequelize, "transaction", async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
  context.mock.method(sequelize, "query", async () => [] as never);
  context.mock.method(models.ApplicationSettings, "findOne", async () => null as never);
  context.mock.method(models.Player, "unscoped", () => models.Player);
  context.mock.method(models.Player, "findOne", async () => null as never);
  context.mock.method(models.Player, "create", async (values: Record<string, unknown>) => {
    createdValues = values;
    return createdPlayer as never;
  });
  context.mock.method(models.Player, "findByPk", async () => createdPlayer as never);
  context.mock.method(models.PlayerGuardian, "findAll", async () => [] as never);
  context.mock.method(models.Registration, "unscoped", () => models.Registration);
  context.mock.method(models.Registration, "findAll", async () => [] as never);
  context.mock.method(models.AuditLog, "create", async (values: Record<string, unknown>) => {
    auditValues = values;
    return {} as never;
  });
  const created = await playerService.createPlayer({ fullName: "Manual Player", dateOfBirth: "2012-01-01", registrationStatus: "registered" }, "staff-id", true);
  assert.equal(createdValues.registrationStatus, "registered");
  assert.equal(createdValues.registrationId, undefined);
  assert.equal(created.registrationId, null);
  assert.equal(auditValues.action, "player.manually_created");
  assert.match(String(auditValues.details), /paymentVerification:not_performed/);
});

test("player status transitions block unapproved registration-linked changes and unlinked activation", async (context) => {
  type PlayerStatusMock = {
    id: string;
    registrationId: string | null;
    registrationStatus: string;
    archived?: boolean;
    archivedReason?: string | null;
    update: (data: Record<string, unknown>) => Promise<unknown>;
  };
  const tx = { LOCK: { UPDATE: "UPDATE" } };
  let player: PlayerStatusMock = { id: "player-id", registrationId: "registration-id", registrationStatus: "pending", update: async (data) => Object.assign(player, data) };
  context.mock.method(sequelize, "transaction", async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx));
  context.mock.method(models.Player, "findByPk", async () => player as never);
  context.mock.method(models.Registration, "findByPk", async () => ({ status: "submitted" }) as never);
  await assert.rejects(playerService.updatePlayerStatus("player-id", { registrationStatus: "registered" }, "staff-id"), { code: "INVALID_PLAYER_STATUS_TRANSITION" });
  await assert.rejects(playerService.updatePlayerStatus("player-id", { registrationStatus: "archived" }, "staff-id"), { code: "INVALID_PLAYER_STATUS_TRANSITION" });
  player = { id: "player-id", registrationId: null, registrationStatus: "prospective", update: async (data) => Object.assign(player, data) };
  await assert.rejects(playerService.updatePlayerStatus("player-id", { registrationStatus: "registered" }, "staff-id"), { code: "REGISTRATION_APPROVAL_REQUIRED" });
  context.mock.method(models.AuditLog, "create", async () => ({} as never));
  const changed = await playerService.updatePlayerStatus("player-id", { registrationStatus: "waitlisted" }, "staff-id");
  assert.equal(changed.registrationStatus, "waitlisted");
  assert.equal(player.archived, false);
});

test("receipt data omits payer and player names without their sensitive permissions", async (context) => {
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(
    models.Payment,
    "findByPk",
    async () =>
      ({
        id: "payment-id",
        status: "successful",
        receiptNumber: "receipt-1",
        reference: "payment-ref",
        amount: "20.00",
        currency: "NGN",
        paidAt: new Date(),
        method: "cash",
        payerName: "Guardian",
        playerName: "Player",
        refundAmount: "0.00",
      }) as never,
  );
  const restricted = await finance.getReceipt("payment-id", false, false);
  assert.equal("payerName" in restricted, false);
  assert.equal("playerName" in restricted, false);
  const permitted = await finance.getReceipt("payment-id", true, true);
  assert.equal(permitted.payerName, "Guardian");
  assert.equal(permitted.playerName, "Player");
});

test("notification templates require variables and HTML-escape untrusted registration text", () => {
  assert.throws(
    () =>
      notificationTemplates.renderNotificationTemplate(
        "registration.approved",
        {},
      ),
    { code: "INVALID_TEMPLATE_VARIABLES" },
  );
  const rendered = notificationTemplates.renderNotificationTemplate(
    "registration.rejected",
    {
      guardianName: "<script>x</script>",
      childName: "A Child",
      reference: "REG-1",
      note: "<img src=x onerror=alert(1)>",
    },
  );
  assert.match(rendered.html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(rendered.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(rendered.html, /<img src=x/);
});

test("notification preferences require SMS consent and honor event-category choices", () => {
  assert.equal(
    notifications.isNotificationChannelEnabled(
      "email",
      "payment.confirmed",
      {},
    ),
    true,
  );
  assert.equal(
    notifications.isNotificationChannelEnabled("email", "payment.confirmed", {
      emailEnabled: false,
    }),
    false,
  );
  assert.equal(
    notifications.isNotificationChannelEnabled("sms", "registration.received", {
      smsEnabled: true,
    }),
    false,
  );
  assert.equal(
    notifications.isNotificationChannelEnabled("sms", "registration.received", {
      smsEnabled: true,
      smsConsentAt: new Date(),
      smsRevokedAt: null,
    }),
    true,
  );
  assert.equal(
    notifications.isNotificationChannelEnabled("sms", "registration.received", {
      smsEnabled: true,
      smsConsentAt: new Date(),
      smsRevokedAt: new Date(),
    }),
    false,
  );
  assert.equal(
    notifications.isNotificationChannelEnabled("in_app", "announcement", {
      inAppEnabled: true,
      categoryPreferences: { announcement: false },
    }),
    false,
  );
});

test("SMS provider contract is mockable and classifies retryable failures without logging recipient data", async () => {
  let requestBody = "";
  const sms = notifications.createSmsClient(
    {
      enabled: true,
      url: "https://sms.example/messages",
      apiKey: "mock-key",
      senderId: "HTT",
    },
    async (_url, init) => {
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ id: "provider-message-id" }), {
        status: 503,
      });
    },
  );
  const result = await sms("2348000000000", "Registration update");
  assert.equal(result.delivered, false);
  assert.equal(result.retryable, true);
  assert.equal(result.errorCode, "sms_http_503");
  assert.equal(JSON.parse(requestBody).to, "2348000000000");
  const disabled = notifications.createSmsClient({
    enabled: false,
    url: "",
    apiKey: "",
    senderId: "",
  });
  assert.equal(
    (await disabled("2348000000000", "message")).errorCode,
    "external_notifications_disabled",
  );
});

test("notification outbox events use stable idempotency keys and the caller transaction", async (context) => {
  let captured: Record<string, unknown> | undefined;
  const transaction = { LOCK: { UPDATE: "UPDATE" } };
  context.mock.method(
    models.NotificationOutbox,
    "create",
    async (
      values: Record<string, unknown>,
      options: Record<string, unknown>,
    ) => {
      captured = { ...values, transaction: options.transaction };
      return values as never;
    },
  );
  await notifications.enqueueNotificationEvent(
    "registration.received",
    "registration",
    "registration-id",
    transaction as never,
  );
  assert.equal(captured?.eventKey, "registration.received:registration-id");
  assert.equal(captured?.status, "pending");
  assert.equal(captured?.transaction, transaction);
});

test("notification event creation and administrative actions require authentication", async (context) => {
  const server = app.listen(0);
  context.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/api/v1/notifications`)).status, 401);
  assert.equal(
    (await fetch(`${base}/api/v1/admin/notifications/deliveries`)).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${base}/api/v1/admin/notifications/announcements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: "announcement-key-01",
          title: "Update",
          body: "Text",
        }),
      })
    ).status,
    401,
  );
});

test('unsafe browser requests reject untrusted origins without database access', () => {
  const checkOrigin = (origin: string) => {
    let error: unknown;
    originGuard({ method: 'POST', path: '/api/v1/auth/login', get: () => origin } as never, {} as never, (nextError) => { error = nextError; });
    return error as { code?: string } | undefined;
  };
  assert.equal(checkOrigin('http://localhost:5173'), undefined);
  assert.equal(checkOrigin('https://attacker.example')?.code, 'UNTRUSTED_ORIGIN');
});

test("notification listing and read operations are scoped to the authenticated staff owner", async (context) => {
  let whereClause: Record<string, unknown> | undefined;
  const notification = {
    id: "notification-id",
    forStaffId: "staff-id",
    read: false,
    update: async (values: Record<string, unknown>) => {
      Object.assign(notification, values);
    },
  };
  context.mock.method(
    models.Notification,
    "findAndCountAll",
    async (options: { where: Record<string, unknown> }) => {
      whereClause = options.where;
      return { rows: [notification], count: 1 } as never;
    },
  );
  context.mock.method(
    models.Notification,
    "findOne",
    async (options: { where: Record<string, unknown> }) => {
      whereClause = options.where;
      return options.where.forStaffId === notification.forStaffId
        ? (notification as never)
        : null;
    },
  );
  const result = await notifications.getMyNotifications("staff-id", {
    page: 1,
    limit: 10,
  });
  assert.equal(whereClause?.forStaffId, "staff-id");
  assert.equal(result.total, 1);
  assert.equal(
    (
      (await notifications.markRead(
        "staff-id",
        notification.id,
      )) as typeof notification
    ).read,
    true,
  );
  await assert.rejects(
    notifications.getMyNotification("another-staff", notification.id),
    { code: "NOTIFICATION_NOT_FOUND" },
  );
});

test("manual payments commit once and roll back if allocation persistence fails", async (context) => {
  let commits = 0,
    rollbacks = 0;
  let failAllocation = false;
  const tx = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => {
      commits++;
    },
    rollback: async () => {
      rollbacks++;
    },
  };
  const registration = {
    id: "registration-id",
    amountDue: "100.00",
    linkedPlayerId: "player-id",
    childName: "Player",
    guardianId: "guardian-id",
    guardianEmail: "guardian@example.com",
    centreId: "centre-id",
    programmeId: null,
    save: async () => undefined,
  };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "findOne", async () => null);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(
    models.Registration,
    "unscoped",
    () => models.Registration,
  );
  context.mock.method(
    models.Registration,
    "findByPk",
    async () => registration as never,
  );
  context.mock.method(models.Payment, "findAll", async () => []);
  context.mock.method(
    models.Payment,
    "create",
    async (data: Record<string, unknown>) =>
      ({ ...data, id: "payment-id" }) as never,
  );
  context.mock.method(models.PaymentAllocation, "create", async () => {
    if (failAllocation) throw new Error("simulated allocation failure");
    return {} as never;
  });
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);
  context.mock.method(
    models.NotificationOutbox,
    "create",
    async (values: Record<string, unknown>) => values as never,
  );

  const data = await finance.recordManualPayment(
    {
      registrationId: registration.id,
      payerName: "Guardian",
      amount: "25.00",
      method: "cash",
      currency: "NGN",
      paidAt: "2026-10-29",
      idempotencyKey: "manual-request-001",
    },
    "staff-id",
  );
  assert.equal(data.status, "successful");
  assert.equal(data.amount, "25.00");
  assert.equal(commits, 1);

  failAllocation = true;
  await assert.rejects(
    finance.recordManualPayment(
      {
        registrationId: registration.id,
        payerName: "Guardian",
        amount: "25.00",
        method: "cash",
        currency: "NGN",
        paidAt: "2026-10-29",
        idempotencyKey: "manual-request-002",
      },
      "staff-id",
    ),
  );
  assert.equal(rollbacks, 1);
});

test("Paystack accepts only valid legacy and timestamped signatures and binds provider payment details", () => {
  const body = Buffer.from('{ "event" : "charge.success", "data" : {"reference":"pay-ref"} }');
  const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");
  assert.equal(finance.verifyWebhookSignature(body, signature), true);
  assert.equal(finance.verifyWebhookSignature(body, "bad"), false);
  assert.equal(finance.verifyWebhookSignature(body, `0x${signature}`), false);
  const timestamp = 1_800_000_000;
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET!;
  const makeSignature = (time: number) => createHmac("sha512", webhookSecret)
    .update(`${time}.`)
    .update(body)
    .digest("hex");
  const verifyHeaders = (time: number, header: string, currentTime = time) =>
    finance.verifyWebhookSignature(body, undefined, header, currentTime);
  const modernSignature = `t=${timestamp},v1=whk_test-key:${makeSignature(timestamp)}`;
  assert.equal(verifyHeaders(timestamp, modernSignature), true);
  assert.equal(verifyHeaders(timestamp, `t=${timestamp},v1=whk_old-key:${"0".repeat(128)},v1=whk_test-key:${makeSignature(timestamp)}`), true);
  assert.equal(verifyHeaders(timestamp, `t=${timestamp},v1=whk_test-key:${"0".repeat(128)}`), false);
  assert.equal(verifyHeaders(timestamp, `t=${timestamp - 301},v1=whk_test-key:${makeSignature(timestamp - 301)}`, timestamp), false);
  assert.equal(verifyHeaders(timestamp, `t=${timestamp + 301},v1=whk_test-key:${makeSignature(timestamp + 301)}`, timestamp), false);
  assert.equal(verifyHeaders(timestamp, `t=${timestamp},v1=broken`), false);
  assert.equal(finance.verifyWebhookSignature(body, undefined, undefined), false);
  assert.equal(finance.verifyWebhookSignature(undefined, signature), false);
  const savedSecret = env.PAYSTACK_WEBHOOK_SECRET;
  env.PAYSTACK_WEBHOOK_SECRET = "";
  try {
    assert.equal(verifyHeaders(timestamp, modernSignature), false);
    assert.equal(finance.verifyWebhookSignature(body, signature), true);
  } finally {
    env.PAYSTACK_WEBHOOK_SECRET = savedSecret;
  }
  const payment = {
    gatewayReference: "pay-ref",
    reference: "internal-ref",
    amount: "25.00",
    currency: "NGN",
    payerEmail: "guardian@example.com",
  };
  assert.doesNotThrow(() =>
    finance.assertProviderTransactionMatches(payment, {
      reference: "pay-ref",
      amount: 2571,
      requested_amount: 2500,
      currency: "NGN",
      customer: { email: "guardian@example.com" },
    }),
  );
  assert.throws(() =>
    finance.assertProviderTransactionMatches(payment, {
      reference: "pay-ref",
      amount: 250,
      currency: "NGN",
      customer: { email: "guardian@example.com" },
    }),
  );
  assert.throws(() =>
    finance.assertProviderTransactionMatches(payment, {
      reference: "pay-ref",
      amount: 2571,
      requested_amount: 2501,
      currency: "NGN",
      customer: { email: "guardian@example.com" },
    }),
  );
  assert.throws(() =>
    finance.assertProviderTransactionMatches(payment, {
      reference: "pay-ref", amount: 2499, requested_amount: 2500,
      currency: "NGN", customer: { email: "guardian@example.com" },
    }),
  );
  assert.throws(() =>
    finance.assertProviderTransactionMatches(payment, {
      reference: "pay-ref",
      amount: 2500,
      currency: "USD",
      customer: { email: "guardian@example.com" },
    }),
  );
  assert.throws(() =>
    finance.assertProviderTransactionMatches(payment, {
      reference: "other",
      amount: 2500,
      currency: "NGN",
      customer: { email: "guardian@example.com" },
    }),
  );
});

test("permission checks deny absent and insufficient grants", () => {
  assert.equal(hasPermission({}, "safeguarding.manage", "full"), false);
  assert.equal(hasPermission({ players: "view" }, "players", "full"), false);
  assert.equal(hasPermission({ players: "full" }, "players", "view"), true);
});

test("academy validation helpers preserve current age bands, pagination limits, and registration state rules", () => {
  assert.equal(ageGroupFor(10), "8-10");
  assert.equal(ageGroupFor(11), "11-12");
  assert.equal(ageGroupFor(15), "other");
  assert.equal(ageOnDate("2015-10-29", new Date("2026-10-29T12:00:00Z")), 11);
  assert.equal(normalizePhone("+234 (801) 234-5678"), "2348012345678");
  assert.deepEqual(pageOptions({ page: 2, limit: 10 }), {
    page: 2,
    limit: 10,
    offset: 10,
  });
  assert.throws(() => pageOptions({ page: 0 }));
  assert.equal(isAllowedRegistrationTransition("submitted", "approved"), true);
  assert.equal(isAllowedRegistrationTransition("rejected", "approved"), false);
  assert.equal(
    isAllowedRegistrationTransition("approved", "under_review"),
    false,
  );
});

test("health responds and protected auth endpoints reject anonymous requests", async (context) => {
  const server = app.listen(0);
  context.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await new Promise<void>((resolve) =>
    server.once("listening", () => resolve()),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${base}/api/v1/health`);
  assert.equal(health.status, 200);
  const swagger = await fetch(`${base}/api-docs/swagger.json`);
  assert.equal(swagger.status, 200);
  assert.ok(
    ((await swagger.json()) as { paths: Record<string, unknown> }).paths[
      "/payments/webhook/paystack"
    ],
  );
  const me = await fetch(`${base}/api/v1/auth/me`);
  assert.equal(me.status, 401);
  for (const path of [
    "/api/v1/players",
    "/api/v1/guardians",
    "/api/v1/registrations",
    "/api/v1/centres",
    "/api/v1/programmes",
    "/api/v1/notifications",
    "/api/v1/notifications/preferences",
    "/api/v1/admin/notifications/deliveries",
    "/api/v1/attendance-sessions",
    "/api/v1/assessments",
    "/api/v1/scholarship-applications",
    "/api/v1/sponsors",
    "/api/v1/funding-records",
    "/api/v1/seasons",
    "/api/v1/teams",
    "/api/v1/fixtures",
    "/api/v1/enquiries",
    "/api/v1/follow-up-tasks",
    "/api/v1/sponsorship-enquiries",
    "/api/v1/stories",
    "/api/v1/consent-records",
    "/api/v1/settings",
    "/api/v1/media/signature",
    "/api/v1/dashboard/summary",
    "/api/v1/reports/academy",
    "/api/v1/audit-logs",
  ]) {
    assert.equal(
      (await fetch(`${base}${path}`)).status,
      401,
      `${path} must reject anonymous access`,
    );
  }
});
