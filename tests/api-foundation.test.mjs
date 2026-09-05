import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import {
  formatWorkItem,
  humanAge,
  initialsFor,
} from "../server/routes/work-queue.js";
import { formatContact } from "../server/routes/contacts.js";
import { normalizeDatabaseError } from "../server/lib/errors.js";
import {
  TOOL_MATURITY,
  auditTool,
  mergeToolEntitlements,
} from "../src/tool-registry.js";

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

test("database constraint errors return safe client-facing contracts", () => {
  assert.deepEqual(
    {
      code: normalizeDatabaseError({ code: "23P01" }).code,
      status: normalizeDatabaseError({ code: "23P01" }).statusCode,
    },
    { code: "CONFLICT", status: 409 },
  );
  assert.equal(normalizeDatabaseError({ code: "23505" }).statusCode, 409);
  assert.equal(normalizeDatabaseError({ code: "23514" }).statusCode, 400);
  assert.equal(normalizeDatabaseError({ code: "XX000" }), null);
});

test("work-item helpers produce stable UI fields", () => {
  assert.equal(initialsFor("Jamie Patel"), "JP");
  assert.equal(
    humanAge("2026-08-31T08:30:00.000Z", new Date("2026-08-31T10:00:00.000Z")),
    "1h",
  );

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
    lifecycle_stage: "Qualified",
    created_at: "2026-09-01T08:30:00.000Z",
    updated_at: "2026-09-01T09:30:00.000Z",
    timeline: [],
  });

  assert.equal(contact.displayName, "Jamie Patel");
  assert.equal(contact.companyName, "");
  assert.equal(contact.phone, "");
  assert.equal(contact.stage, "Qualified");
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

  const response = await app.inject({
    method: "GET",
    url: "/api/v1/work-queue",
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "UNAUTHORIZED");
  assert.ok(response.json().error.requestId);
});

test("every implemented or foundation API route enforces authentication", async (context) => {
  const app = await buildApp({
    config: testConfig(),
    pool: fakePool(),
    logger: false,
  });
  context.after(() => app.close());

  const protectedRoutes = [
    ["GET", "/api/v1/modules"],
    ["GET", "/api/v1/contacts"],
    ["POST", "/api/v1/contacts"],
    ["PATCH", "/api/v1/contacts/22222222-2222-4222-8222-222222222222"],
    ["POST", "/api/v1/contacts/22222222-2222-4222-8222-222222222222/notes"],
    ["DELETE", "/api/v1/contacts/22222222-2222-4222-8222-222222222222"],
    ["GET", "/api/v1/work-queue"],
    ["GET", "/api/v1/contacts/22222222-2222-4222-8222-222222222222/timeline"],
    ["POST", "/api/v1/contacts/22222222-2222-4222-8222-222222222222/messages"],
    ["POST", "/api/v1/contacts/22222222-2222-4222-8222-222222222222/consents"],
    [
      "POST",
      "/api/v1/contacts/22222222-2222-4222-8222-222222222222/appointments",
    ],
  ];

  for (const [method, url] of protectedRoutes) {
    const response = await app.inject({ method, url, payload: {} });
    assert.equal(response.statusCode, 401, `${method} ${url}`);
    assert.equal(
      response.json().error.code,
      "UNAUTHORIZED",
      `${method} ${url}`,
    );
  }
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

test("Supabase migration defines auth mapping, RLS, and RPC boundaries", async () => {
  const migration = await readFile(
    new URL(
      "../server/db/migrations/002_supabase_integration.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /REFERENCES auth\.users/);
  assert.match(migration, /SECURITY INVOKER/);
  assert.match(migration, /private\.is_workspace_member/);
  assert.match(migration, /toolstead_list_contacts/);
  assert.match(migration, /TO authenticated/);
  assert.match(
    migration,
    /ALTER FUNCTION public\.set_updated_at\(\) SET search_path = ''/,
  );
  assert.match(migration, /contact_channels_value_length_check/);
  assert.match(migration, /contact_timeline_body_length_check/);
  assert.doesNotMatch(migration, /GRANT .* TO anon/);
});

test("tool catalog never claims unfinished tools are available", () => {
  const catalog = mergeToolEntitlements([]);
  const tools = mergeToolEntitlements(
    catalog.map((tool) => ({ key: tool.key, enabled: true })),
  );

  assert.ok(tools.length > 0, "catalog contains audited tools");
  for (const tool of tools) {
    const audit = auditTool(tool);
    assert.ok(audit.total > 0);
    assert.equal(
      audit.activatable,
      tool.maturity === TOOL_MATURITY.implemented && tool.enabled,
      `${tool.key} activation matches its audited maturity`,
    );
    if (tool.maturity !== TOOL_MATURITY.implemented) {
      assert.equal(
        audit.activatable,
        false,
        `${tool.key} cannot activate while unfinished`,
      );
    }
  }
});

test("every catalog tool has explicit audited readiness evidence", () => {
  const tools = mergeToolEntitlements([]);
  const validMaturities = new Set(Object.values(TOOL_MATURITY));
  const uniqueKeys = new Set(tools.map((tool) => tool.key));

  assert.ok(tools.length > 0, "catalog contains tools");
  assert.equal(uniqueKeys.size, tools.length, "catalog keys are unique");
  for (const tool of tools) {
    const audit = auditTool(tool);

    assert.ok(validMaturities.has(tool.maturity), `${tool.key} has a maturity`);
    assert.ok(tool.implemented.length > 0, `${tool.key} has evidence`);
    assert.ok(
      tool.implemented.every((item) => typeof item === "string" && item.trim()),
      `${tool.key} implementation evidence is explicit`,
    );
    assert.equal(audit.implemented, tool.implemented.length, tool.key);
    assert.equal(audit.missing, tool.missing.length, tool.key);
    assert.equal(
      audit.total,
      tool.implemented.length + tool.missing.length,
      tool.key,
    );
    if (tool.maturity !== TOOL_MATURITY.implemented) {
      assert.ok(
        tool.missing.length > 0,
        `${tool.key} has remaining-work evidence`,
      );
      assert.ok(
        tool.missing.every((item) => typeof item === "string" && item.trim()),
        `${tool.key} remaining-work evidence is explicit`,
      );
      assert.equal(audit.activatable, false, `${tool.key} is not activatable`);
    }
  }
});

test("foundation endpoints require their own module entitlements", async () => {
  const routeSource = await readFile(
    new URL("../server/routes/work-queue.js", import.meta.url),
    "utf8",
  );

  assert.match(
    routeSource,
    /messagingGuards = \[\.\.\.crmGuards, app\.requireModule\("messaging"\)\]/,
  );
  assert.match(
    routeSource,
    /bookingGuards = \[\.\.\.crmGuards, app\.requireModule\("booking"\)\]/,
  );
  assert.match(
    routeSource,
    /contacts\/:contactId\/messages"[\s\S]*?preHandler: messagingGuards/,
  );
  assert.match(
    routeSource,
    /contacts\/:contactId\/appointments"[\s\S]*?preHandler: bookingGuards/,
  );
});

test("Supabase sessions are verified and connection failures stay explicit", async () => {
  const dataClient = await readFile(
    new URL("../src/data-client.js", import.meta.url),
    "utf8",
  );
  const appSource = await readFile(
    new URL("../src/App.jsx", import.meta.url),
    "utf8",
  );

  assert.match(dataClient, /supabase\.auth\.getUser\(\)/);
  assert.match(dataClient, /requiresRemoteConnection/);
  assert.match(appSource, /setConnectionState\("error"\)/);
  assert.match(appSource, /Workspace connection failed/);
});

test("Supabase owner registration provisions metadata without embedded credentials", async () => {
  const dataClient = await readFile(
    new URL("../src/data-client.js", import.meta.url),
    "utf8",
  );
  const appSource = await readFile(
    new URL("../src/App.jsx", import.meta.url),
    "utf8",
  );

  assert.match(dataClient, /supabase\.auth\.signUp/);
  assert.match(dataClient, /display_name: registration\.displayName/);
  assert.match(dataClient, /workspace_name: registration\.workspaceName/);
  assert.match(appSource, /Create owner account/);
  assert.match(appSource, /Check your email/);
  assert.doesNotMatch(dataClient, /service_role|sb_secret_/);
});
