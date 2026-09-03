export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(path, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("The Toolstead API is unavailable.", 0, "API_UNAVAILABLE");
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || "The request could not be completed.",
      response.status,
      payload?.error?.code || "REQUEST_FAILED",
      payload?.error?.details,
    );
  }

  return payload;
}

export async function checkApi() {
  const payload = await request("/api/health/live");
  if (payload?.status !== "ok" || payload?.service !== "toolstead-api") {
    throw new ApiError("The Toolstead API is unavailable.", 0, "API_UNAVAILABLE");
  }
  return payload;
}

export function login(credentials) {
  return request("/api/v1/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export function logout() {
  return request("/api/v1/auth/logout", { method: "POST" });
}

export function getCurrentAccount() {
  return request("/api/v1/auth/me");
}

export async function getWorkQueue(scope = "all") {
  const query = new URLSearchParams({ scope, limit: "100" });
  const payload = await request(`/api/v1/work-queue?${query.toString()}`);
  if (!Array.isArray(payload?.items)) {
    throw new ApiError("The work queue returned an invalid response.", 502, "INVALID_API_RESPONSE");
  }
  return payload;
}

export function queueMessage(contactId, message) {
  return request(`/api/v1/contacts/${contactId}/messages`, {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: message,
  });
}

export function recordConsent(contactId, channels) {
  return request(`/api/v1/contacts/${contactId}/consents`, {
    method: "POST",
    body: { channels },
  });
}

export function createAppointment(contactId, appointment) {
  return request(`/api/v1/contacts/${contactId}/appointments`, {
    method: "POST",
    body: appointment,
  });
}

// # Module catalog
export function getModules() {
  return request("/api/v1/modules");
}

// # Contact records
export async function getContacts(query = "") {
  const params = new URLSearchParams({ q: query, limit: "100" });
  const payload = await request(`/api/v1/contacts?${params.toString()}`);
  if (!Array.isArray(payload?.contacts)) {
    throw new ApiError("The contact directory returned an invalid response.", 502, "INVALID_API_RESPONSE");
  }
  return payload;
}

export function createContact(contact) {
  return request("/api/v1/contacts", { method: "POST", body: contact });
}

export function updateContact(contactId, contact) {
  return request(`/api/v1/contacts/${contactId}`, { method: "PATCH", body: contact });
}

export function addContactNote(contactId, body) {
  return request(`/api/v1/contacts/${contactId}/notes`, { method: "POST", body: { body } });
}

export function archiveContact(contactId) {
  return request(`/api/v1/contacts/${contactId}`, { method: "DELETE" });
}
