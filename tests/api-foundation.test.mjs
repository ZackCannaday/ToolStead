import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import { formatWorkItem, humanAge, initialsFor } from "../server/routes/work-queue.js";
import { formatContact } from "../server/routes/contacts.js";

function testConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: "test",
    JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
    COOKIE_SECRET: "test-cookie-secret-with-at-least-32-characters",
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1:5432/unused",
    CORS_ORIGIN: "http://localhost:5173",
    ...overrides,
  });
}

function fakePool() {
  return {
    async query(sql) {
      if (String(sql).includes("SELECT 1")) {
        return { rows: [{ connected: 1 }], rowCount: 1 };
      }
      throw new Error("Unexpected database query in API foundation test.");
    },
  };
}

test("production refuses development authentication secrets", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production" }),
    /Production requires unique JWT_SECRET/,
  );
});

test("configuration keeps billing enforcement disabled by default", () => {
  const config = testConfig();
  assert.equal(config.billingEnforcement, false);
  assert.equal(config.port, 3001);
});

test("work-item helpers produce stable UI fields", () => {
  assert.equal(initialsFor("Jamie Patel"), "JP");
  assert.equal(humanAge("2026-08-31T08:30:00.000Z", new Date("2026-08-31T10:00:00.000Z")), "1h");

  const item = formatWorkItem({
    id: "11111111-1111-4111-8111-111111111111",
    contact_id: "22222222-2222-4222-8222-222222222222",
    display_name: "Jamie Patel",
    item_type: "Website lead",
    source_label: "Website",
    source_detail: "tntcarcare.com",
    created_at: "2026-08-31T08:30:00.000Z",
    urgency: "high",
    next_step: "Respond to inquiry",
    next_step_note: "Provide availability",
    action_label: "Respond",
    action_type: "respond",
    phone: null,
    email: "jamie@example.com",
    consent: "Email",
    summary: "Requested a quote.",
    next_action: "Reply today.",
    timeline: [],
  });

  assert.equal(item.initials, "JP");
  assert.equal(item.urgency, "High");
  assert.equal(item.source, "tntcarcare.com");
  assert.deepEqual(item.timeline, []);
});

test("contact records map database fields to the public API contract", () => {
  const contact = formatContact({
    id: "22222222-2222-4222-8222-222222222222",
    display_name: "Jamie Patel",
    company_name: null,
    email: "jamie@example.com",
    phone: null,
    source: "Website form",
    created_at: "2026-09-01T08:30:00.000Z",
    updated_at: "2026-09-01T09:30:00.000Z",
    timeline: [],
  });

  assert.equal(contact.displayName, "Jamie Patel");
  assert.equal(contact.companyName, "");
  assert.equal(contact.phone, "");
  assert.deepEqual(contact.timeline, []);
});

test("liveness and readiness endpoints return stable health contracts", async (context) => {
  const app = await buildApp({
    config: testConfig(),
    pool: fakePool(),
    logger: false,
  });
  context.after(() => app.close());

  const live = await app.inject({ method: "GET", url: "/api/health/live" });
  assert.equal(live.statusCode, 200);
  assert.deepEqual(live.json(), { status: "ok", service: "toolstead-api" });

  const ready = await app.inject({ method: "GET", url: "/api/health/ready" });
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().database, "connected");
});

test("protected routes reject unauthenticated requests before database access", async (context) => {
  const app = await buildApp({
    config: testConfig(),
    pool: fakePool(),
    logger: false,
  });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/v1/work-queue" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "UNAUTHORIZED");
  assert.ok(response.json().error.requestId);
});

test("login validates input without querying PostgreSQL", async (context) => {
  const app = await buildApp({
    config: testConfig(),
    pool: fakePool(),
    logger: false,
  });
  context.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email: "not-an-email", password: "short" },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "BAD_REQUEST");
});

test("unknown API routes use the standard error envelope", async (context) => {
  const app = await buildApp({
    config: testConfig(),
    pool: fakePool(),
    logger: false,
  });
  context.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/api/v1/missing" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "NOT_FOUND");
});

test("migration defines tenant isolation and delayed billing structures", async () => {
  const migration = await readFile(
    new URL("../server/db/migrations/001_core.sql", import.meta.url),
    "utf8",
  );

  assert.match(migration, /CREATE TABLE workspace_module_entitlements/);
  assert.match(migration, /CREATE TABLE workspace_subscriptions/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE TABLE contacts/);
  assert.match(migration, /CREATE TABLE audit_log/);
});
