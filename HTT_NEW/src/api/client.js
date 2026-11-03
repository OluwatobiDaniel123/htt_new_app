// const frontendEnv =
//   /** @type {{ env?: { VITE_API_BASE_URL?: string; DEV?: boolean } }} */ (
//     import.meta
//   );
// const defaultApiUrl = frontendEnv.env?.DEV
//   ? "/api/v1"
//   : typeof window === "undefined"
//     ? "/api/v1"
//     : `${window.location.origin}/api/v1`;
// const API_BASE_URL = (
//   frontendEnv.env?.VITE_API_BASE_URL || defaultApiUrl
// ).replace(/\/$/, "");
const frontendEnv =
  /** @type {{ env?: { VITE_API_BASE_URL?: string; DEV?: boolean } }} */ (
    import.meta
  );

const defaultApiUrl = frontendEnv.env?.DEV
  ? "/api/v1"
  : "https://htt-new-app.onrender.com/api/v1";

const API_BASE_URL = (
  frontendEnv.env?.VITE_API_BASE_URL || defaultApiUrl
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = code || "API_ERROR";
    this.details = details;
  }
}

let refreshPromise;

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      response.status,
      payload?.error?.code,
      payload?.error?.message || `Request failed (${response.status}).`,
      payload?.error?.details,
    );
  }
  if (payload && Object.hasOwn(payload, "data")) return payload.data;
  return payload;
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
}

export async function request(path, options = {}, { retryAuth = true } = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body !== undefined && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const send = () =>
    fetch(`${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
      headers,
      credentials: "include",
      body:
        options.body !== undefined &&
        !(options.body instanceof FormData) &&
        typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : options.body,
    });
  let response = await send();
  const isSessionEndpoint =
    /\/auth\/(login|refresh|logout|forgot-password|reset-password)$/.test(path);
  if (
    response.status === 401 &&
    retryAuth &&
    !isSessionEndpoint &&
    (await refreshSession())
  )
    response = await send();
  return parseResponse(response);
}

const queryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      search.set(key, String(value));
  });
  const result = search.toString();
  return result ? `?${result}` : "";
};

const methods = {
  get: (path, params) => request(`${path}${queryString(params)}`),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path, body) =>
    request(path, { method: "DELETE", ...(body ? { body } : {}) }),
};

export const api = {
  ...methods,
  baseUrl: API_BASE_URL,
  auth: {
    login: (body) => methods.post("/auth/login", body),
    me: () => methods.get("/auth/me"),
    logout: () => methods.post("/auth/logout", {}),
    forgotPassword: (email) => methods.post("/auth/forgot-password", { email }),
    resetPassword: (token, password) =>
      methods.post("/auth/reset-password", { token, password }),
    changePassword: (currentPassword, password) =>
      methods.post("/auth/change-password", { currentPassword, password }),
  },
};

export const toUiRecord = (value) => {
  if (Array.isArray(value)) return value.map(toUiRecord);
  if (!value || typeof value !== "object" || value instanceof Date)
    return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      toUiRecord(item),
    ]),
  );
};

export const fromUiRecord = (value) => {
  if (Array.isArray(value)) return value.map(fromUiRecord);
  if (!value || typeof value !== "object" || value instanceof Date)
    return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase()),
      fromUiRecord(item),
    ]),
  );
};
