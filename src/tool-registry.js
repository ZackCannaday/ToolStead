import { TOOL_MANIFEST as ACCESSIBILITY_MANIFEST } from "./tools/accessibility-auditor/manifest.js";
import { TOOL_MANIFEST as DIAGNOSTIC_MANIFEST } from "./tools/diagnostic-decision-tree/manifest.js";
import { TOOL_MANIFEST as PLANNER_MANIFEST } from "./tools/project-material-planner/manifest.js";
import { TOOL_MANIFEST as QUOTE_MANIFEST } from "./tools/quote-invoice-builder/manifest.js";
import { TOOL_MANIFEST as SEO_MANIFEST } from "./tools/seo-aeo-analyzer/manifest.js";
import { TOOL_MANIFEST as TEST_CASE_MANIFEST } from "./tools/test-case-generator/manifest.js";
import { TOOL_MATURITY } from "./tools/manifest-contract.js";

export { TOOL_MATURITY } from "./tools/manifest-contract.js";

// # Wave one routes
export const WAVE_ONE_TOOL_MANIFESTS = Object.freeze([
  SEO_MANIFEST,
  ACCESSIBILITY_MANIFEST,
  QUOTE_MANIFEST,
  DIAGNOSTIC_MANIFEST,
  PLANNER_MANIFEST,
  TEST_CASE_MANIFEST,
]);
export const WAVE_ONE_TOOL_KEYS = Object.freeze(
  WAVE_ONE_TOOL_MANIFESTS.map((manifest) => manifest.catalogKey),
);

const WAVE_ONE_MANIFEST_BY_CATALOG_KEY = new Map(
  WAVE_ONE_TOOL_MANIFESTS.map((manifest) => [manifest.catalogKey, manifest]),
);

// # Audited tool catalog
const CATALOG_DEFINITIONS = [
  {
    key: "crm-core",
    name: "Lead Intake & CRM",
    description:
      "Capture leads, manage contact details, update stages, add notes, and retain an activity timeline.",
    category: "Sales",
    maturity: TOOL_MATURITY.implemented,
    runnable: true,
    workspaceId: "crm",
    included: "Core platform",
    implemented: [
      "Contact creation",
      "Editing and search",
      "Lifecycle stages",
      "Timeline notes",
      "Soft archive",
    ],
    missing: ["Bulk import", "Duplicate merge", "Employee assignment"],
  },
  {
    key: "site-builder",
    name: "Sites, Funnels & Forms",
    description:
      "Build websites, landing pages, surveys, forms, and conversion funnels.",
    category: "Marketing",
    maturity: TOOL_MATURITY.notStarted,
    included: "Marketing bundle",
    implemented: ["Module registration", "Entitlement data model"],
    missing: [
      "Page editor",
      "Publishing pipeline",
      "Forms",
      "Surveys",
      "Domain management",
    ],
  },
  {
    key: "booking",
    name: "Booking & Calendar",
    description:
      "Publish availability, collect appointment requests, and prevent schedule conflicts.",
    category: "Operations",
    maturity: TOOL_MATURITY.foundation,
    included: "Growth bundle",
    implemented: [
      "Appointment schema",
      "Protected create endpoint",
      "Timeline event creation",
      "Solo-owner conflict prevention",
    ],
    missing: [
      "Calendar interface",
      "Availability rules",
      "Reminders",
      "External calendar sync",
      "Employee calendar assignment",
    ],
  },
  {
    key: "messaging",
    name: "Messaging Hub",
    description:
      "Manage consent-based email, SMS, voice, and missed-call follow-up in one inbox.",
    category: "Communication",
    maturity: TOOL_MATURITY.foundation,
    included: "Growth bundle",
    implemented: [
      "Consent records",
      "Protected outbox endpoint",
      "Idempotency controls",
    ],
    missing: [
      "Inbox interface",
      "Delivery worker",
      "Provider connection",
      "Webhook reconciliation",
      "Opt-out processing",
    ],
  },
  {
    key: "smart-intake",
    name: "Quote, Estimate & Invoice Builder",
    description:
      "Prepare itemized customer documents with deterministic discounts, tax, fees, deposits, and balances.",
    category: "Sales",
    maturity: TOOL_MATURITY.foundation,
    runnable: true,
    workspaceId: "quote-invoice-builder",
    included: "Sales add-on",
    implemented: [
      "Quote, proposal, invoice, and change-order drafts",
      "Itemized scope and money-safe totals",
      "Print-ready prepared document",
      "Validation and empty states",
    ],
    missing: [
      "Tenant-scoped saved documents",
      "PDF export",
      "Approval links",
      "Estimate-specific labor and parts catalog",
    ],
  },
  {
    key: "payments",
    name: "Payments & Receivables",
    description:
      "Send payment links, track balances, and automate polite overdue follow-up.",
    category: "Finance",
    maturity: TOOL_MATURITY.notStarted,
    included: "Finance add-on",
    implemented: ["Module registration", "Entitlement data model"],
    missing: [
      "Payment provider",
      "Receivable records",
      "Payment links",
      "Receipts",
      "Overdue workflows",
    ],
  },
  {
    key: "media-kit",
    name: "Before & After Media Kit",
    description:
      "Brand, compress, organize, and prepare customer-ready service photos.",
    category: "Marketing",
    maturity: TOOL_MATURITY.notStarted,
    included: "Marketing add-on",
    implemented: ["Module registration", "Entitlement data model"],
    missing: [
      "Secure uploads",
      "Image processing",
      "Brand overlays",
      "Asset organization",
      "Share workflow",
    ],
  },
  {
    key: "analytics",
    name: "Analytics & Attribution",
    description:
      "Connect leads, appointments, payments, and revenue back to their source.",
    category: "Reporting",
    maturity: TOOL_MATURITY.notStarted,
    included: "Growth bundle",
    implemented: ["Module registration", "Shared event foundation"],
    missing: [
      "Event definitions",
      "Attribution model",
      "Reports",
      "Revenue reconciliation",
      "Exports",
    ],
  },
  {
    key: "search-visibility",
    name: "Search Visibility Studio",
    description:
      "Audit pasted page content for on-page search and answer-engine readiness with prioritized repairs.",
    category: "Marketing",
    maturity: TOOL_MATURITY.foundation,
    runnable: true,
    workspaceId: "search-visibility",
    included: "Marketing bundle",
    implemented: [
      "Pasted-content analysis",
      "SEO and AEO scoring",
      "Heading and intent checks",
      "Evidence-backed remediation",
    ],
    missing: [
      "Live URL crawling",
      "Schema and citation workflows",
      "Core Web Vitals data",
      "Tenant-scoped saved audits",
    ],
  },
  {
    key: "accessibility-auditor",
    name: "Accessibility Compliance Auditor",
    description:
      "Audit pasted HTML for WCAG 2.2 barriers with prioritized evidence and remediation guidance.",
    category: "Operations",
    maturity: TOOL_MATURITY.foundation,
    runnable: true,
    workspaceId: "accessibility-auditor",
    included: "Quality bundle",
    implemented: [
      "Static HTML analysis",
      "Semantic and ARIA checks",
      "Form-label checks",
      "Inline contrast checks",
    ],
    missing: [
      "Live URL scanning",
      "Browser keyboard and focus checks",
      "Human compliance review",
      "Tenant-scoped saved audits",
    ],
  },
  {
    key: "diagnostic-flow",
    name: "Diagnostic Flow Builder",
    description:
      "Author and run validated diagnostic decision trees with safety notices and traceable answer history.",
    category: "Operations",
    maturity: TOOL_MATURITY.foundation,
    runnable: true,
    workspaceId: "diagnostic-flow",
    included: "Operations bundle",
    implemented: [
      "Decision-tree authoring",
      "Configuration validation",
      "Guided run mode",
      "Back, restart, and path history",
    ],
    missing: [
      "Tenant-scoped saved workflows",
      "Workflow library",
      "Version history",
      "Export and sharing",
    ],
  },
  {
    key: "project-material-planner",
    name: "Project & Materials Planner",
    description:
      "Calculate purchase quantities, waste, cut allowances, labor, other costs, and budget variance.",
    category: "Operations",
    maturity: TOOL_MATURITY.foundation,
    runnable: true,
    workspaceId: "project-material-planner",
    included: "Operations bundle",
    implemented: [
      "Material and package calculations",
      "Cut list and kerf allowances",
      "Labor and cost totals",
      "Safety checklist and build sequence",
    ],
    missing: [
      "Tenant-scoped saved plans",
      "Live supplier prices",
      "Printable export",
      "Qualified review for regulated work",
    ],
  },
  {
    key: "code-quality-desk",
    name: "Code Quality & Release Desk",
    description:
      "Turn requirements and contracts into traceable positive, negative, and boundary test cases.",
    category: "Reporting",
    maturity: TOOL_MATURITY.foundation,
    runnable: true,
    workspaceId: "code-quality-desk",
    included: "Developer bundle",
    implemented: [
      "Requirements and contract parsing",
      "Traceable test generation",
      "Priority and case-type coverage",
      "CSV export",
    ],
    missing: [
      "Full code-review workflow",
      "Sandboxed test execution",
      "Diff and repository ingestion",
      "Release-note generation",
    ],
  },
];

export const TOOL_DEFINITIONS = Object.freeze(
  CATALOG_DEFINITIONS.map((tool) => {
    const manifest = WAVE_ONE_MANIFEST_BY_CATALOG_KEY.get(tool.key);
    if (!manifest) return Object.freeze(tool);
    return Object.freeze({
      ...tool,
      runnable: true,
      workspaceId: manifest.workspaceId,
      manifest,
    });
  }),
);

// # Catalog presentation
export const MATURITY_PRESENTATION = Object.freeze({
  [TOOL_MATURITY.implemented]: {
    label: "Working",
    tone: "active",
    action: "Open tool",
  },
  [TOOL_MATURITY.foundation]: {
    label: "Foundation only",
    tone: "foundation",
    action: "Inspect & test",
  },
  [TOOL_MATURITY.notStarted]: {
    label: "Not built",
    tone: "planned",
    action: "Inspect plan",
  },
});

export function mergeToolEntitlements(moduleRows = []) {
  const entitlementByKey = new Map(
    moduleRows.map((module) => [module.key, module]),
  );
  return TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    ...entitlementByKey.get(tool.key),
    maturity: tool.maturity,
    implemented: tool.implemented,
    missing: tool.missing,
    enabled:
      tool.key === "crm-core" ||
      Boolean(entitlementByKey.get(tool.key)?.enabled),
  }));
}

export function auditTool(tool) {
  const implemented = tool.implemented.length;
  const missing = tool.missing.length;
  return {
    implemented,
    missing,
    total: implemented + missing,
    activatable: tool.maturity === TOOL_MATURITY.implemented && tool.enabled,
  };
}
