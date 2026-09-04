export { default } from "./AccessibilityAuditor.jsx";
export {
  analyzeAccessibility,
  AuditInputError,
  AUDIT_VERSION,
  contrastRatio,
  MANUAL_CHECKS,
  MAX_HTML_LENGTH,
  parseHtml,
  SEVERITY_WEIGHTS,
} from "./analyzer.js";

// # Registry metadata
export const TOOL_MANIFEST = Object.freeze({
  key: "accessibility-auditor",
  name: "Accessibility Auditor",
  description:
    "Audit pasted HTML for WCAG 2.2 accessibility barriers with prioritized evidence and remediation.",
  category: "Quality",
  maturity: "implemented",
  version: "1.0.0",
  execution: "local",
  input: "html",
  capabilities: Object.freeze([
    "Semantic structure",
    "Keyboard markup",
    "Accessible names",
    "ARIA validation",
    "Form labels",
    "Inline color contrast",
  ]),
});

