import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createHmac } from "node:crypto";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET =
  "test_access_secret_at_least_thirty_two_characters_long";
process.env.JWT_REFRESH_SECRET =
  "test_refresh_secret_at_least_thirty_two_characters_long";
process.env.PAYSTACK_SECRET_KEY =
  "test_paystack_secret_for_signature_validation";
process.env.PAYSTACK_WEBHOOK_SECRET =
  "test_paystack_webhook_secret_for_signature_validation";
process.env.NOTIFICATIONS_ENABLED = "false";

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
const { isAllowedRegistrationTransition } =
  await import("../services/registrationService.js");
const { ageGroupFor, ageOnDate, normalizePhone, pageOptions } =
  await import("../services/academyShared.js");
const finance = await import("../services/paymentService.js");
const { manualPaymentBody } = await import("../validation/paymentSchemas.js");
const { models, sequelize } = await import("../models/index.js");
const notifications = await import("../services/notificationService.js");
const notificationTemplates =
  await import("../services/notificationTemplates.js");
const { originGuard } = await import("../middleware/originGuard.js");
const { env } = await import("../config/env.js");
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
  assert.equal(paths["/payments/initialize"], undefined);
  assert.equal(paths["/payments/manual"], undefined);
  assert.equal(paths["/registrations/{id}/balance"], undefined);
});

test("payment endpoints are temporarily disabled", async (context) => {
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  ));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/v1/payments`;
  for (const [path, method] of [["", "GET"], ["/initialize", "POST"], ["/manual", "POST"], ["/verify/reference", "POST"], ["/refunds/id/approve", "POST"], ["/webhook/paystack", "POST"]]) {
    const response = await fetch(`${base}${path}`, { method });
    assert.equal(response.status, 503, `${method} ${path} must be disabled`);
    const payload = await response.json() as { error?: { code?: string } };
    assert.equal(payload.error?.code, "FEATURE_DISABLED");
  }
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
    initializedAmount = "";
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
        programmeId: null,
        centreId: null,
      }) as never,
  );
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
      initializedAmount = JSON.parse(String(init?.body)).amount;
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
  };
  const first = await finance.initializePayment(input, "staff-id");
  const repeated = await finance.initializePayment(input, "staff-id");
  assert.equal(initializedAmount, "7550");
  assert.equal(first.authorizationUrl, "https://checkout.test/session");
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.authorizationUrl, first.authorizationUrl);
  assert.equal(providerCalls, 1);
  assert.equal(transactionCommits, 2);
});

test("server verification rejects mismatches and leaves pending responses unpaid until provider success", async (context) => {
  let providerState: Record<string, unknown> = {
    reference: "provider-ref",
    amount: 2000,
    currency: "NGN",
    status: "pending",
    customer: { email: "guardian@example.com" },
  };
  let commits = 0;
  const tx = {
    LOCK: { UPDATE: "UPDATE" },
    commit: async () => {
      commits++;
    },
    rollback: async () => undefined,
  };
  const payment = {
    id: "payment-id",
    reference: "internal-ref",
    gatewayReference: "provider-ref",
    amount: "25.00",
    currency: "NGN",
    payerEmail: "guardian@example.com",
    method: "paystack",
    status: "pending",
    refundAmount: "0.00",
    receiptNumber: null,
    registrationId: null,
    save: async () => undefined,
  };
  context.mock.method(sequelize, "transaction", async () => tx as never);
  context.mock.method(models.Payment, "unscoped", () => models.Payment);
  context.mock.method(models.Payment, "findOne", async () => payment as never);
  context.mock.method(models.Payment, "findByPk", async () => payment as never);
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
  providerState = { ...providerState, amount: 2500 };
  const pending = await finance.verifyPayment("provider-ref", "staff-id");
  assert.equal(pending.status, "pending");
  assert.equal(payment.status, "pending");
  providerState = { ...providerState, status: "success" };
  const successful = await finance.verifyPayment("provider-ref", "staff-id");
  assert.equal(successful.status, "successful");
  assert.ok(successful.receiptNumber);
  assert.equal(commits, 2);
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

test("Paystack webhook signature uses HMAC SHA-512 and provider checks bind reference, amount, currency, and payer", () => {
  const body = Buffer.from('{"event":"charge.success"}');
  const signature = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex");
  assert.equal(finance.verifyWebhookSignature(body, signature), true);
  assert.equal(finance.verifyWebhookSignature(body, "bad"), false);
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
      amount: 2500,
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
  assert.equal(
    ((await swagger.json()) as { paths: Record<string, unknown> }).paths[
      "/payments/webhook/paystack"
    ],
    undefined,
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
