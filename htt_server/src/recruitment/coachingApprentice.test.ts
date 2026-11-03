import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { app } from "../app.js";
import { createAccessToken } from "../auth/tokens.js";
import { coachingApprenticeApplication, models } from "../models/index.js";
import { coachingApprenticeApplicationBody } from "../validation/coachingApprenticeSchemas.js";

const validApplication = {
  fullName: "Taylor Example",
  phoneNumber: "+234 801 234 5678",
  email: "TAYLOR@example.com",
  location: "Lagos",
};

const startServer = async (
  context: TestContext,
  permission?: "view" | "full",
) => {
  let cookie: string | undefined;
  if (permission) {
    const staffId = "83e5ef86-7d45-4f43-bae2-c0da10d8f1d2";
    const sessionId = "adfd3b79-d001-40ca-97ab-0ed0234bc2ac";
    const session = {
      id: sessionId,
      staffAccountId: staffId,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      rotatedAt: null,
      staffAccount: {
        id: staffId,
        email: "reviewer@example.com",
        fullName: "Recruitment Reviewer",
        active: true,
        suspendedAt: null,
      },
    };
    context.mock.method(
      models.RefreshSession,
      "findByPk",
      async () => session as never,
    );
    context.mock.method(
      models.StaffRole,
      "findAll",
      async () =>
        [
          {
            role: {
              key: "recruitment_reviewer",
              permissions: [
                {
                  key: "coaching_apprentices",
                  RolePermission: { accessLevel: permission },
                },
              ],
            },
          },
        ] as never,
    );
    cookie = `htt_access=${createAccessToken(staffId, sessionId)}`;
  }

  const server = app.listen(0);
  context.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    base: `http://127.0.0.1:${address.port}/api/v1/coaching-apprentices`,
    cookie,
  };
};

test("coaching apprentice application validation trims and normalizes valid input", () => {
  const parsed = coachingApprenticeApplicationBody.parse({
    ...validApplication,
    fullName: " Taylor Example ",
    location: " Lagos ",
  });
  assert.equal(parsed.fullName, "Taylor Example");
  assert.equal(parsed.location, "Lagos");
  assert.equal(parsed.email, "taylor@example.com");
  assert.equal(
    coachingApprenticeApplicationBody.safeParse({ ...validApplication, phoneNumber: "x" }).success,
    false,
  );
  assert.equal(
    coachingApprenticeApplicationBody.safeParse({ ...validApplication, extra: true }).success,
    false,
  );
});

test("public application accepts the website form fields and returns a clean receipt", async (context) => {
  const application = {
    id: "5e478099-31c7-4f79-89dd-7d4de8f0b89a",
    status: "pending",
    createdAt: new Date("2026-11-02T10:00:00.000Z"),
  };
  context.mock.method(
    coachingApprenticeApplication,
    "create",
    async () => application as never,
  );
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);
  const { base } = await startServer(context);

  const response = await fetch(`${base}/apply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validApplication),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      id: application.id,
      status: "pending",
      createdAt: application.createdAt.toISOString(),
    },
  });
});

test("invalid public application is rejected before persistence", async (context) => {
  let writes = 0;
  context.mock.method(coachingApprenticeApplication, "create", async () => {
    writes += 1;
    return {} as never;
  });
  const { base } = await startServer(context);
  const response = await fetch(`${base}/apply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...validApplication, email: "not-an-email" }),
  });
  assert.equal(response.status, 400);
  assert.equal(writes, 0);
});

test("missing recruitment table returns a safe unavailable response", async (context) => {
  const missingRelation = Object.assign(
    new Error('relation "coaching_apprentice_applications" does not exist'),
    {
      original: {
        code: "42P01",
        message: 'relation "coaching_apprentice_applications" does not exist',
      },
    },
  );
  context.mock.method(
    coachingApprenticeApplication,
    "create",
    async () => {
      throw missingRelation;
    },
  );
  const { base } = await startServer(context);
  const response = await fetch(`${base}/apply`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validApplication),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, "RECRUITMENT_STORAGE_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(body), /relation|does not exist|42P01/i);
});

test("staff recruitment endpoints require authentication and the dedicated permission", async (context) => {
  const anonymous = await startServer(context);
  assert.equal((await fetch(anonymous.base)).status, 401);

  const { base, cookie } = await startServer(context, "view");
  assert.ok(cookie);
  context.mock.method(coachingApprenticeApplication, "findAndCountAll", async () => ({ count: 0, rows: [] }) as never);
  const response = await fetch(base, { headers: { cookie: cookie! } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      items: [],
      pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
    },
  });
});

test("staff without the dedicated recruitment permission are denied", async (context) => {
  const denied = await startServer(context);
  const token = createAccessToken(
    "83e5ef86-7d45-4f43-bae2-c0da10d8f1d2",
    "adfd3b79-d001-40ca-97ab-0ed0234bc2ac",
  );
  context.mock.method(
    models.RefreshSession,
    "findByPk",
    async () => ({
      id: "adfd3b79-d001-40ca-97ab-0ed0234bc2ac",
      staffAccountId: "83e5ef86-7d45-4f43-bae2-c0da10d8f1d2",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      rotatedAt: null,
      staffAccount: { id: "83e5ef86-7d45-4f43-bae2-c0da10d8f1d2", active: true, suspendedAt: null },
    }) as never,
  );
  context.mock.method(models.StaffRole, "findAll", async () => [] as never);
  const forbidden = await fetch(denied.base, { headers: { cookie: `htt_access=${token}` } });
  assert.equal(forbidden.status, 403);
});

test("staff can update an application status with full recruitment permission", async (context) => {
  const application = {
    id: "5e478099-31c7-4f79-89dd-7d4de8f0b89a",
    status: "pending",
    update: async (values: { status: string }) => Object.assign(application, values),
  };
  context.mock.method(
    coachingApprenticeApplication,
    "findByPk",
    async () => application as never,
  );
  context.mock.method(models.AuditLog, "create", async () => ({}) as never);
  const { base, cookie } = await startServer(context, "full");
  const response = await fetch(`${base}/5e478099-31c7-4f79-89dd-7d4de8f0b89a/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookie! },
    body: JSON.stringify({ status: "shortlisted" }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, "shortlisted");
});

test("invalid staff status transition is rejected and missing applications return 404", async (context) => {
  const { base, cookie } = await startServer(context, "full");
  const invalid = await fetch(`${base}/5e478099-31c7-4f79-89dd-7d4de8f0b89a/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookie! },
    body: JSON.stringify({ status: "hired" }),
  });
  assert.equal(invalid.status, 400);
  context.mock.method(coachingApprenticeApplication, "findByPk", async () => null as never);
  const missing = await fetch(`${base}/5e478099-31c7-4f79-89dd-7d4de8f0b89a/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookie! },
    body: JSON.stringify({ status: "accepted" }),
  });
  assert.equal(missing.status, 404);
});
