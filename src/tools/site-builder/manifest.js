import { defineToolManifest } from "../manifest-contract.js";

export const TOOL_MANIFEST = defineToolManifest({
  id: "site-builder",
  catalogKey: "site-builder",
  workspaceId: "site-builder",
  name: "Sites, Funnels & Forms",
  description:
    "Build multi-page sites, landing pages, funnels, and lead forms, then export a portable static site package.",
  category: "Marketing",
  version: "1.0.0",
  maturity: "foundation",
  runtime: "client",
  requiresNetwork: false,
  persistence: "session",
  inputs: ["project-details", "pages", "sections", "theme", "forms"],
  outputs: ["static-site-files", "site-project-json"],
  capabilities: [
    "Multi-page site structure",
    "Reusable page sections",
    "Lead form configuration",
    "Responsive session preview",
    "Validated static HTML and CSS export",
    "Portable project JSON",
  ],
});
