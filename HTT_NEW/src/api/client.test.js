import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, request } from "./client.js";

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
