import { defineToolManifest } from "../manifest-contract.js";

export const TOOL_MANIFEST = defineToolManifest({
  id: "quote-invoice-builder",
  catalogKey: "smart-intake",
  workspaceId: "quote-invoice-builder",
  name: "Quote, Estimate & Invoice Builder",
  category: "Sales",
  version: "1.0.0",
  description:
    "Build itemized quotes and invoices with deterministic discounts, tax, deposits, and balances.",
  maturity: "foundation",
  runtime: "client",
  requiresNetwork: false,
  persistence: "session",
  inputs: ["document-details", "parties", "line-items", "terms"],
  outputs: ["prepared-document", "print-pdf"],
  capabilities: [
    "Itemized scope",
    "Money-safe totals",
    "Discounts, tax, and fees",
    "Deposit and balance",
    "Stable document data",
  ],
});
