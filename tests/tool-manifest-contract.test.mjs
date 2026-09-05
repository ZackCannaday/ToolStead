import assert from "node:assert/strict";
import test from "node:test";

import {
  TOOL_MANIFEST_SCHEMA_VERSION,
  defineToolManifest,
  validateToolManifest,
} from "../src/tools/manifest-contract.js";
import {
  TOOL_DEFINITIONS,
  WAVE_ONE_TOOL_KEYS,
  WAVE_ONE_TOOL_MANIFESTS,
} from "../src/tool-registry.js";

const CANONICAL_FIELDS = [
  "id",
  "catalogKey",
  "workspaceId",
  "name",
  "description",
  "category",
  "version",
  "maturity",
  "runtime",
  "requiresNetwork",
  "persistence",
  "inputs",
  "outputs",
  "capabilities",
];

test("all six Wave 1 tools implement the same valid immutable manifest contract", () => {
  assert.equal(WAVE_ONE_TOOL_MANIFESTS.length, 6);

  for (const manifest of WAVE_ONE_TOOL_MANIFESTS) {
    const validation = validateToolManifest(manifest);
    assert.deepEqual(validation.errors, [], `${manifest.id}: ${validation.errors.join(" ")}`);
    assert.equal(manifest.schemaVersion, TOOL_MANIFEST_SCHEMA_VERSION);
    assert.equal(manifest.key, manifest.id);
    assert.equal(manifest.runsClientSide, manifest.runtime === "client");
    assert.equal(Object.isFrozen(manifest), true);
    assert.equal(Object.isFrozen(manifest.inputs), true);
    assert.equal(Object.isFrozen(manifest.outputs), true);
    assert.equal(Object.isFrozen(manifest.capabilities), true);

    for (const field of CANONICAL_FIELDS) {
      assert.equal(Object.hasOwn(manifest, field), true, `${manifest.id} is missing ${field}`);
    }
  }
});

test("catalog routes are derived from manifests without aliases drifting", () => {
  assert.deepEqual(
    WAVE_ONE_TOOL_KEYS,
    WAVE_ONE_TOOL_MANIFESTS.map((manifest) => manifest.catalogKey),
  );

  for (const manifest of WAVE_ONE_TOOL_MANIFESTS) {
    const catalogTool = TOOL_DEFINITIONS.find((tool) => tool.key === manifest.catalogKey);
    assert.ok(catalogTool, `${manifest.catalogKey} must exist in the catalog`);
    assert.equal(catalogTool.workspaceId, manifest.workspaceId);
    assert.equal(catalogTool.manifest, manifest);
    assert.equal(catalogTool.runnable, true);
  }
});

test("the manifest factory rejects incomplete or unsupported contracts", () => {
  const invalid = {
    id: "Bad ID",
    catalogKey: "missing-route",
    workspaceId: "missing-route",
    name: "",
    description: "Invalid fixture",
    category: "Testing",
    version: "one",
    maturity: "unknown",
    runtime: "browser-ish",
    requiresNetwork: "no",
    persistence: "sometimes",
    inputs: [],
    outputs: ["result", "result"],
    capabilities: [],
  };

  const validation = validateToolManifest(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 8);
  assert.throws(() => defineToolManifest(invalid), /Invalid tool manifest/);
});
