import { defineToolManifest } from "../manifest-contract.js";

export const TOOL_MANIFEST = defineToolManifest({
  id: "project-material-planner",
  catalogKey: "project-material-planner",
  workspaceId: "project-material-planner",
  name: "Project & Materials Planner",
  category: "Operations",
  description:
    "Build deterministic DIY project scopes, purchase lists, cut plans, safety checklists, build sequences, and budgets.",
  version: "1.1.0",
  maturity: "foundation",
  runtime: "client",
  requiresNetwork: false,
  persistence: "session",
  inputs: ["project-scope", "materials", "cuts", "tools", "labor", "costs", "budget"],
  outputs: ["project-plan", "bill-of-materials", "cut-list", "json"],
  capabilities: [
    "Project scope and dimensions",
    "Bill of materials and package rounding",
    "Configurable waste and kerf",
    "Cut list with grain direction",
    "Tool and PPE staging",
    "Chronological build sequence",
    "Dry-fit safety checkpoint",
    "Labor and project costing",
    "Budget comparison",
    "Deterministic JSON export",
    "Regulated-work boundaries",
  ],
});
