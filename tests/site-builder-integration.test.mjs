import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PUBLIC_PREVIEW_TOOL_KEYS,
  TOOL_DEFINITIONS,
  TOOL_MATURITY,
} from "../src/tool-registry.js";
import { validateToolManifest } from "../src/tools/manifest-contract.js";

const APP_SOURCE_URL = new URL("../src/App.jsx", import.meta.url);
const WORKSPACE_SOURCE_URL = new URL(
  "../src/tools/site-builder/index.jsx",
  import.meta.url,
);

test("site builder is registered as a runnable offline workspace", () => {
  const tool = TOOL_DEFINITIONS.find((candidate) => candidate.key === "site-builder");

  assert.ok(tool, "site-builder must remain in the customer-facing catalog");
  assert.equal(tool.name, "Sites, Funnels & Forms");
  assert.equal(tool.maturity, TOOL_MATURITY.foundation);
  assert.equal(tool.runnable, true);
  assert.equal(tool.workspaceId, "site-builder");
  assert.ok(tool.manifest, "site-builder must expose its runtime contract");
  assert.deepEqual(validateToolManifest(tool.manifest).errors, []);
  assert.equal(tool.manifest.catalogKey, tool.key);
  assert.equal(tool.manifest.workspaceId, tool.workspaceId);
  assert.equal(tool.manifest.runtime, "client");
  assert.equal(tool.manifest.requiresNetwork, false);
  assert.equal(tool.manifest.persistence, "session");
  assert.ok(
    PUBLIC_PREVIEW_TOOL_KEYS.includes(tool.key),
    "site-builder must be available from the public no-account preview",
  );
});

test("site builder workspace is statically bundled and reachable by its registered route", async () => {
  const appSource = await readFile(APP_SOURCE_URL, "utf8");

  assert.match(
    appSource,
    /import SiteBuilder from "\.\/tools\/site-builder\/index\.jsx";/,
    "the hosted build must include Site Builder without click-time loading",
  );
  assert.match(
    appSource,
    /"site-builder"\s*:\s*SiteBuilder/,
    "the registered workspace id must resolve to the Site Builder component",
  );
  assert.doesNotMatch(
    appSource,
    /import\("\.\/tools\/site-builder\/index\.jsx"\)/,
    "Site Builder must not require a separately authorized dynamic chunk",
  );
});

test("site builder workspace exposes an understandable accessible editing flow", async () => {
  const source = await readFile(WORKSPACE_SOURCE_URL, "utf8");

  assert.match(source, /Sites, Funnels &(?:amp;)? Forms/);
  assert.match(source, /<form\b/);
  assert.match(source, /<label\b/);
  assert.match(source, /type="submit"/);
  assert.match(source, /aria-live=/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});
