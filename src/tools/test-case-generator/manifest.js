import { defineToolManifest } from "../manifest-contract.js";

export const TOOL_MANIFEST = defineToolManifest({
  id: "test-case-generator",
  catalogKey: "code-quality-desk",
  workspaceId: "code-quality-desk",
  name: "Test Case Generator",
  description:
    "Convert requirements, function contracts, API specifications, and schemas into traceable test cases.",
  category: "Quality & Testing",
  version: "1.0.0",
  maturity: "foundation",
  runtime: "client",
  requiresNetwork: false,
  persistence: "session",
  inputs: ["requirements", "function-contract", "api-specification", "schema"],
  outputs: ["test-cases", "csv"],
  capabilities: ["Requirement parsing", "Positive, negative, and boundary cases", "Traceability", "CSV export"],
});
