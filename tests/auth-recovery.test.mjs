import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// # Recovery contract
test("password recovery uses the supported Supabase flow", async () => {
  const dataClient = await readFile(
    new URL("../src/data-client.js", import.meta.url),
    "utf8",
  );
  assert.match(dataClient, /resetPasswordForEmail\(email/);
  assert.match(dataClient, /event === "PASSWORD_RECOVERY"/);
  assert.match(dataClient, /updateUser\(\{ password \}\)/);
  assert.match(dataClient, /signOut\(\{ scope: "global" \}\)/);
});

test("recovery UI requires confirmation and does not reveal account existence", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /If a Toolstead account exists/);
  assert.match(app, /password !== confirmation/);
  assert.match(app, /minLength="12"/);
  assert.match(app, /Forgot your password\?/);
});

// # Session protection
test("production requires authentication and exposes sign out", async () => {
  const dataClient = await readFile(
    new URL("../src/data-client.js", import.meta.url),
    "utf8",
  );
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(dataClient, /if \(isProduction\)/);
  assert.match(dataClient, /AUTH_CONFIGURATION_MISSING/);
  assert.match(dataClient, /event === "SIGNED_OUT"/);
  assert.match(dataClient, /signOut\(\{ scope: "local" \}\)/);
  assert.match(app, /className="sidebar-signout"/);
  assert.match(app, />Sign out</);
});
