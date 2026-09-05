import test from "node:test";
import assert from "node:assert/strict";

import {
  isToolPreviewRequested,
  selectPreviewTools,
  shouldUseLocalPreview,
  shouldUsePublicPreview,
} from "../src/preview-mode.js";
import {
  TOOL_DEFINITIONS,
  WAVE_ONE_TOOL_KEYS,
} from "../src/tool-registry.js";

test("explicit preview is available only without production or Supabase", () => {
  assert.equal(
    shouldUseLocalPreview({
      isProduction: false,
      hasSupabaseConfig: false,
      search: "?toolstead-preview=1",
    }),
    true,
  );
  assert.equal(
    shouldUseLocalPreview({
      isProduction: true,
      hasSupabaseConfig: false,
      search: "?toolstead-preview=1",
    }),
    false,
  );
  assert.equal(
    shouldUseLocalPreview({
      isProduction: false,
      hasSupabaseConfig: true,
      search: "?toolstead-preview=1",
    }),
    false,
  );
});

test("hosted tool preview is an explicit environment-independent opt-in", () => {
  assert.equal(shouldUsePublicPreview("?toolstead-preview=1"), true);
  assert.equal(isToolPreviewRequested("?toolstead-preview=1"), true);
  assert.equal(isToolPreviewRequested("?x=1&toolstead-preview=1"), true);
  for (const search of ["", "?toolstead-preview=0", "?toolstead-preview=true"]) {
    assert.equal(isToolPreviewRequested(search), false);
  }
});

test("the production preview allowlist resolves exactly six offline manifests", () => {
  const previewTools = selectPreviewTools(TOOL_DEFINITIONS, WAVE_ONE_TOOL_KEYS);
  assert.equal(previewTools.length, 6);
  assert.deepEqual(
    previewTools.map((tool) => tool.key),
    [...WAVE_ONE_TOOL_KEYS],
  );
  assert.ok(previewTools.every((tool) => tool.manifest.runtime === "client"));
  assert.ok(previewTools.every((tool) => tool.manifest.requiresNetwork === false));
  assert.ok(previewTools.every((tool) => tool.manifest.persistence === "session"));
});

test("preview selection admits only allowlisted client-only session tools", () => {
  const safe = {
    key: "safe",
    workspaceId: "safe-workspace",
    runnable: true,
    manifest: {
      catalogKey: "safe",
      workspaceId: "safe-workspace",
      runtime: "client",
      requiresNetwork: false,
      persistence: "session",
    },
  };
  const rejected = [
    { ...safe, key: "not-allowlisted" },
    { ...safe, key: "network", manifest: { ...safe.manifest, catalogKey: "network", requiresNetwork: true } },
    { ...safe, key: "server", manifest: { ...safe.manifest, catalogKey: "server", runtime: "server" } },
    { ...safe, key: "saved", manifest: { ...safe.manifest, catalogKey: "saved", persistence: "workspace" } },
    { ...safe, key: "not-runnable", runnable: false, manifest: { ...safe.manifest, catalogKey: "not-runnable" } },
  ];
  assert.deepEqual(selectPreviewTools([safe, ...rejected], ["safe", ...rejected.map((item) => item.key)]), [safe]);
});

test("preview shell bypasses connection discovery and excludes protected surfaces", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
  );
  assert.match(source, /if \(shouldUsePublicPreview\(window\.location\.search\)\)/);
  assert.match(source, /return <BetaToolsPreview \/>;/);
  const previewBody = source.slice(
    source.indexOf("function BetaToolsPreview"),
    source.indexOf("function PasswordRecoveryScreen"),
  );
  for (const forbidden of ["getContacts(", "getModules(", "CrmWorkspace", "account-menu", "signOut("]) {
    assert.doesNotMatch(previewBody, new RegExp(forbidden.replace("(", "\\(")));
  }
});

test("preview mode requires the exact opt-in value", () => {
  for (const search of ["", "?toolstead-preview=0", "?toolstead-preview=true"]) {
    assert.equal(
      shouldUseLocalPreview({
        isProduction: false,
        hasSupabaseConfig: false,
        search,
      }),
      false,
    );
  }
});
