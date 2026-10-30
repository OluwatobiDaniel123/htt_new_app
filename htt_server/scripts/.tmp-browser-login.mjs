import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(".env"), quiet: true });
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword || process.env.NODE_ENV !== "development") {
  console.log(JSON.stringify({ result: "blocked", reason: "development_test_credentials_unavailable" }));
  process.exit(1);
}
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = await mkdtemp(join(tmpdir(), "htt-academy-login-"));
const child = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*",
  "--remote-debugging-port=9222", `--user-data-dir=${profile}`, "about:blank",
], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
let stderr = "";
child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const poll = async (fn, timeout = 20000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const value = await fn();
    if (value) return value;
    await wait(200);
  }
  return null;
};
let ws;
let targetId;
let nextId = 0;
const pending = new Map();
const responses = [];
let dashboardSeen = false;
let page = false;
try {
  const version = await poll(async () => {
    try { const r = await fetch("http://127.0.0.1:9222/json/version"); return r.ok ? r.json() : null; }
    catch { return null; }
  });
  if (!version) throw new Error("browser_debug_endpoint_unavailable");
  const targetResponse = await fetch("http://127.0.0.1:9222/json/new?http%3A%2F%2Flocalhost%3A5173%2Flogin", { method: "PUT" });
  if (!targetResponse.ok) throw new Error("browser_target_create_failed");
  const target = await targetResponse.json();
  targetId = target.id;
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Network.responseReceived") {
      const response = message.params.response;
      if (/\/api\/v1\/auth\/(login|me)$/.test(response.url)) {
        responses.push({ url: new URL(response.url).pathname, status: response.status });
      }
    }
    if (message.method === "Page.loadEventFired") page = true;
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error("cdp_command_failed")) : resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: "http://localhost:5173/login" });
  const formReady = await poll(async () => {
    const result = await send("Runtime.evaluate", { expression: "Boolean(document.querySelector('#email') && document.querySelector('#password'))", returnByValue: true });
    return result.result.value;
  });
  if (!formReady) throw new Error("login_form_not_ready");
  const inputResult = await send("Runtime.evaluate", {
    expression: `(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      const emailInput = document.querySelector("#email");
      const passwordInput = document.querySelector("#password");
      if (!emailInput || !passwordInput) return false;
      emailInput.focus(); set.call(emailInput, ${JSON.stringify(adminEmail)});
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      emailInput.dispatchEvent(new Event("change", { bubbles: true }));
      passwordInput.focus(); set.call(passwordInput, ${JSON.stringify(adminPassword)});
      passwordInput.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("form")?.requestSubmit();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!inputResult.result.value) throw new Error("login_form_submission_failed");
  await poll(async () => {
    const state = await send("Runtime.evaluate", { expression: "({url: location.pathname, text: document.body?.innerText || ''})", returnByValue: true });
    const value = state.result.value;
    dashboardSeen = value.url !== "/login" && /dashboard/i.test(value.text);
    return responses.some((r) => r.url.endsWith("/auth/me") && r.status === 200) && dashboardSeen;
  }, 30000);
  const loginStatus = responses.find((r) => r.url.endsWith("/auth/login"))?.status ?? null;
  const meStatus = responses.filter((r) => r.url.endsWith("/auth/me")).at(-1)?.status ?? null;
  await send("Page.reload", { ignoreCache: true });
  await wait(2500);
  const meAfterReload = responses.filter((r) => r.url.endsWith("/auth/me")).at(-1)?.status ?? null;
  const contentState = await send("Runtime.evaluate", { expression: "({url: location.pathname, dashboard: /dashboard/i.test(document.body?.innerText || '')})", returnByValue: true });
  const dashboardAfterReload = contentState.result.value.dashboard && contentState.result.value.url !== "/login";
  const logout = await send("Runtime.evaluate", {
    expression: "fetch('/api/v1/auth/logout', {method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status)",
    awaitPromise: true,
    returnByValue: true,
  });
  const logoutStatus = logout.result.value;
  const result = {
    loginPageLoaded: page,
    loginRequestStatus: loginStatus,
    authMeStatus: meStatus,
    dashboardOpened: dashboardSeen,
    authMeAfterBrowserReloadStatus: meAfterReload,
    dashboardAfterBrowserReload: dashboardAfterReload,
    logoutStatus,
    observedAuthStatuses: responses.map((r) => r.status),
    result: loginStatus === 200 && meStatus === 200 && dashboardSeen && meAfterReload === 200 && dashboardAfterReload && logoutStatus === 200 ? "passed" : "failed",
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.result !== "passed") process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({ result: "failed", reason: error?.message || "browser_test_failed", browserStarted: !child.killed, debugEndpointText: stderr.includes("DevTools") }, null, 2));
  process.exitCode = 1;
} finally {
  try { ws?.close(); } catch {}
  if (targetId) { try { await fetch(`http://127.0.0.1:9222/json/close/${targetId}`); } catch {} }
  child.kill();
  const tempRoot = resolve(tmpdir()).toLowerCase();
  const profilePath = resolve(profile);
  if (profilePath.toLowerCase().startsWith(tempRoot + "\\")) {
    await rm(profilePath, { recursive: true, force: true });
  }
}

