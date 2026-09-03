// # Tool maturity contract
export const TOOL_MATURITY = Object.freeze({
  implemented: "implemented",
  foundation: "foundation",
  notStarted: "not_started",
});

// # Audited tool catalog
export const TOOL_DEFINITIONS = Object.freeze([
  {
    key: "crm-core",
    name: "Lead Intake & CRM",
    description:
      "Capture leads, manage contact details, update stages, add notes, and retain an activity timeline.",
    category: "Sales",
    maturity: TOOL_MATURITY.implemented,
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
    name: "MarginPilot Quotes",
    description:
      "Price work accurately with labor, materials, overhead, tax, and target margin.",
    category: "Sales",
    maturity: TOOL_MATURITY.notStarted,
    included: "Sales add-on",
    implemented: ["Module registration", "Entitlement data model"],
    missing: [
      "Quote calculator",
      "Pricing rules",
      "Saved quotes",
      "PDF export",
      "Approval links",
    ],
  },
  {
    key: "payments",
    name: "Payments & Invoices",
    description:
      "Send payment links, track balances, and automate polite overdue follow-up.",
    category: "Finance",
    maturity: TOOL_MATURITY.notStarted,
    included: "Finance add-on",
    implemented: ["Module registration", "Entitlement data model"],
    missing: [
      "Payment provider",
      "Invoices",
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
]);

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
