import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  TOOL_DEFINITIONS,
  TOOL_MATURITY,
  WAVE_ONE_TOOL_KEYS,
  mergeToolEntitlements,
} from "../src/tool-registry.js";

const APP_SOURCE_URL = new URL("../src/App.jsx", import.meta.url);

test("wave one consolidates six runnable products without duplicate quote tiles", () => {
  assert.equal(WAVE_ONE_TOOL_KEYS.length, 6);
  assert.equal(new Set(WAVE_ONE_TOOL_KEYS).size, 6);

  const keys = TOOL_DEFINITIONS.map((tool) => tool.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.includes("quote-invoice-builder"), false);

  const quoteTool = TOOL_DEFINITIONS.find((tool) => tool.key === "smart-intake");
  const paymentsTool = TOOL_DEFINITIONS.find((tool) => tool.key === "payments");
  assert.equal(quoteTool.name, "Quote, Estimate & Invoice Builder");
  assert.equal(quoteTool.workspaceId, "quote-invoice-builder");
  assert.equal(paymentsTool.name, "Payments & Receivables");
});

test("every wave one product is runnable but not entitlement-enabled or working", () => {
  const merged = mergeToolEntitlements([]);
  const waveTools = WAVE_ONE_TOOL_KEYS.map((key) =>
    merged.find((tool) => tool.key === key),
  );

  assert.equal(waveTools.every(Boolean), true);
  assert.equal(waveTools.every((tool) => tool.runnable && !tool.enabled), true);
  assert.equal(
    waveTools.every((tool) => tool.maturity === TOOL_MATURITY.foundation),
    true,
  );
  assert.equal(new Set(waveTools.map((tool) => tool.workspaceId)).size, 6);
});

test("dashboard component map covers every registered wave one workspace", async () => {
  const appSource = await readFile(APP_SOURCE_URL, "utf8");
  const tools = TOOL_DEFINITIONS.filter((tool) =>
    WAVE_ONE_TOOL_KEYS.includes(tool.key),
  );

  for (const tool of tools) {
    assert.match(
      appSource,
      new RegExp(`"${tool.workspaceId}"\\s*:`),
      `${tool.key} must map to a dashboard component`,
    );
  }

  assert.doesNotMatch(
    appSource,
    /value=\{stage\}\s+value=\{stage\}/,
    "CRM stage filter must not contain duplicate value props",
  );
});
