import { defineToolManifest } from "../manifest-contract.js";

export const TOOL_MANIFEST = defineToolManifest({
  id: "seo-aeo-content-analyzer",
  catalogKey: "search-visibility",
  workspaceId: "search-visibility",
  name: "Search Visibility Studio",
  description: "Audit supplied page copy for search visibility and answer-engine readiness with evidence-backed fixes.",
  category: "Marketing",
  version: "1.1.0",
  maturity: "foundation",
  runtime: "client",
  requiresNetwork: false,
  persistence: "session",
  inputs: ["url", "title", "metaDescription", "headings", "body"],
  outputs: ["scorecard", "remediation-report", "markdown"],
  capabilities: ["Five-pillar SEO and AEO scorecard", "Keyword intent and readability analysis", "Evidence-backed remediation", "Local Markdown report export"],
});
