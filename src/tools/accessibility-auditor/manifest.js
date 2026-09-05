import { defineToolManifest } from "../manifest-contract.js";

export const TOOL_MANIFEST = defineToolManifest({
  id: "accessibility-auditor",
  catalogKey: "accessibility-auditor",
  workspaceId: "accessibility-auditor",
  name: "Accessibility Compliance Auditor",
  description:
    "Audit pasted HTML for WCAG 2.2 accessibility barriers with prioritized evidence and remediation.",
  category: "Operations",
  version: "1.0.0",
  maturity: "foundation",
  runtime: "client",
  requiresNetwork: false,
  persistence: "session",
  inputs: ["html"],
  outputs: ["accessibility-findings", "manual-checks"],
  capabilities: [
    "Semantic structure",
    "Keyboard markup",
    "Accessible names",
    "ARIA validation",
    "Form labels",
    "Inline color contrast",
  ],
});
