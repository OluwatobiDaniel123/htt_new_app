import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, api, request } from "./client.js";
import { getResource } from "./resources.js";

test("API requests include cookies and unwrap the success envelope", async (context) => {
  let captured;
  context.mock.method(globalThis, "fetch", async (url, options) => {
    captured = { url: String(url), options };
    return new Response(
      JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      { status: 200 },
    );
  });
  
  const result = await request("/players?page=1");
  assert.deepEqual(result, { items: [], total: 0 });
  assert.match(captured.url, /\/api\/v1\/players\?page=1$/);
  assert.equal(captured.options.credentials, "include");
});

test("API errors preserve validation details and the backend message", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "The request is invalid.",
            details: { field: "email" },
          },
        }),
        { status: 400 },
      ),
  );
  await assert.rejects(
    request("/staff", { method: "POST", body: { email: "bad" } }),
    (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.deepEqual(error.details, { field: "email" });
      return true;
    },
  );
});

test("expired access sessions refresh once and retry with the new HttpOnly cookies", async (context) => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({
      url: String(url),
      method: options.method || "GET",
      credentials: options.credentials,
    });
    if (calls.length === 1)
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication is required.",
          },
        }),
        { status: 401 },
      );
    if (calls.length === 2)
      return new Response(
        JSON.stringify({
          success: true,
          data: { sessionId: "rotated-session" },
        }),
        { status: 200 },
      );
    return new Response(
      JSON.stringify({ success: true, data: { user: { id: "staff-id" } } }),
      { status: 200 },
    );
  });
  const result = await request("/auth/me");
  assert.deepEqual(result, { user: { id: "staff-id" } });
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.credentials === "include"));
  assert.match(calls[1].url, /\/auth\/refresh$/);
});

test("registration detail keeps the registration record instead of unwrapping its associated player", async (context) => {
  const registrationId = "9cc553cc-6f88-439b-8e6d-7c397f450856";
  const response = {
    id: registrationId,
    reference: "HTT-REG-MW9E0WK3-4121C3",
    status: "submitted",
    paymentStatus: "unpaid",
    amountDue: "40000.00",
    amountDueCurrency: "NGN",
    childName: "Oyelere Idowu",
    guardianName: "Hylarious Oyelere Idowu",
    centre: { id: "centre-id", name: "Agege Lagos Training Centre" },
    programme: { id: "programme-id", name: "Developing Player" },
    player: { id: "player-id", fullName: "Oyelere Idowu", registrationStatus: "pending" },
    emergencyContact: { id: "emergency-id", fullName: "Emergency Contact", phone: "+2348000000000" },
    paymentRecords: [{ id: "payment-id", amount: "40000.00", currency: "NGN", status: "pending" }],
    documents: [{ id: "document-id", mediaAssetId: "asset-id", name: "Player profile picture", status: "pending" }],
  };
  let requestedPath;
  context.mock.method(api, "get", async (path) => {
    requestedPath = path;
    return response;
  });

  const record = await getResource("Registration", registrationId);

  assert.equal(requestedPath, `/registrations/${registrationId}`);
  assert.equal(record.id, registrationId);
  assert.equal(record.child_name, "Oyelere Idowu");
  assert.equal(record.guardian_name, "Hylarious Oyelere Idowu");
  assert.equal(record.centre_name, "Agege Lagos Training Centre");
  assert.equal(record.programme_name, "Developing Player");
  assert.equal(record.player.full_name, "Oyelere Idowu");
  assert.equal(record.emergency_contact.full_name, "Emergency Contact");
  assert.equal(record.payment_records[0].status, "pending");
  assert.equal(record.payment_records[0].amount, "40000.00");
  assert.equal(record.documents[0].media_asset_id, "asset-id");
});
