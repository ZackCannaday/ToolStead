import { defineToolManifest } from "../manifest-contract.js";

export const TOOL_MANIFEST = defineToolManifest({
  id: "diagnostic-decision-tree",
  catalogKey: "diagnostic-flow",
  workspaceId: "diagnostic-flow",
  name: "Diagnostic Flow Builder",
  description:
    "Run a configured question path with traceable answers and a clear terminal outcome.",
  category: "Operations",
  version: "1.0.0",
  maturity: "foundation",
  runtime: "client",
  requiresNetwork: false,
  persistence: "session",
  inputs: ["decision-tree"],
  outputs: ["diagnostic-outcome", "answer-history", "verification-checklist"],
  capabilities: [
    "In-workspace workflow authoring",
    "Validated configurable workflows",
    "Traceable answer history",
    "Back and restart controls",
    "Cycle and invalid-path protection",
    "Explicit safety notices",
  ],
});
