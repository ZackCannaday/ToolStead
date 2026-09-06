import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import worker from "../worker/index.js";
import { verifyAuthConfig } from "../scripts/verify-auth-build.mjs";

test("serves existing static assets without a fallback", async () => {
  const calls = [];
  const response = await worker.fetch(new Request("https://example.test/assets/app.js"), {
    ASSETS: {
      fetch: async (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("asset", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/assets/app.js"]);
});

test("falls back to index.html for an unknown app route", async () => {
  const calls = [];
  const response = await worker.fetch(
    new Request("https://example.test/flow/step-two?source=share", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async (request) => {
          const url = new URL(request.url);
          calls.push(url.pathname + url.search);
          return new Response(url.pathname === "/index.html" ? "app" : "missing", {
            status: url.pathname === "/index.html" ? 200 : 404,
          });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["/flow/step-two?source=share", "/index.html"]);
});

// # Runtime auth config
test("injects Supabase runtime configuration into the app shell", async () => {
  const response = await worker.fetch(
    new Request("https://example.test/", {
      headers: { accept: "text/html" },
    }),
    {
      VITE_SUPABASE_URL: "https://project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      ASSETS: {
        fetch: async () =>
          new Response("<html><head></head><body></body></html>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      },
    },
  );

  const html = await response.text();
  assert.match(html, /id="toolstead-runtime-config"/);
  assert.match(html, /type="application\/json"/);
  assert.match(html, /https:\/\/project\.supabase\.co/);
  assert.match(html, /sb_publishable_test/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("does not turn missing API or write requests into the app shell", async () => {
  for (const request of [
    new Request("https://example.test/api/missing", { headers: { accept: "application/json" } }),
    new Request("https://example.test/flow", { method: "POST", headers: { accept: "text/html" } }),
  ]) {
    let calls = 0;
    const response = await worker.fetch(request, {
      ASSETS: {
        fetch: async () => {
          calls += 1;
          return new Response("missing", { status: 404 });
        },
      },
    });

    assert.equal(response.status, 404);
    assert.equal(calls, 1);
  }
});

test("emits the files required by Sites packaging", async () => {
  await access(new URL("../dist/client/index.html", import.meta.url));
  await access(new URL("../dist/server/index.js", import.meta.url));
  await access(new URL("../dist/.openai/hosting.json", import.meta.url));
});

// # Deployment auth bundle
test("requires production authentication configuration in the emitted client", () => {
  const config = {
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "sb_publishable_test",
  };
  assert.doesNotThrow(() =>
    verifyAuthConfig({
      ...config,
      javascript: `const url=\"${config.supabaseUrl}\";const key=\"${config.publishableKey}\";`,
    }),
  );
  assert.throws(
    () => verifyAuthConfig({ ...config, javascript: "const missing=true;" }),
    /does not contain/,
  );
  assert.throws(
    () => verifyAuthConfig({ ...config, publishableKey: "secret-key", javascript: "" }),
    /browser-safe publishable key/,
  );
});
