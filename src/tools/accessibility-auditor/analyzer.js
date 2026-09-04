// # Audit contract
export const AUDIT_VERSION = "1.0.0";
export const MAX_HTML_LENGTH = 500_000;

export const SEVERITY_WEIGHTS = Object.freeze({
  critical: 20,
  serious: 10,
  moderate: 5,
  minor: 2,
});

export const MANUAL_CHECKS = Object.freeze([
  {
    id: "screen-reader-flow",
    label: "Complete critical flows with VoiceOver, NVDA, or JAWS.",
  },
  {
    id: "keyboard-flow",
    label: "Verify logical focus order, visible focus, and no keyboard traps.",
  },
  {
    id: "zoom-reflow",
    label: "Check reflow and readability at 200% and 400% zoom.",
  },
  {
    id: "dynamic-announcements",
    label: "Confirm dialogs, validation, and status changes are announced.",
  },
  {
    id: "visual-modes",
    label: "Test reduced motion, forced colors, and high-contrast modes.",
  },
]);

export class AuditInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AuditInputError";
    this.code = code;
  }
}

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const INTERACTIVE_ELEMENTS = new Set([
  "button",
  "input",
  "select",
  "summary",
  "textarea",
]);

const INTERACTIVE_ROLES = new Set([
  "button",
  "checkbox",
  "combobox",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "radio",
  "searchbox",
  "slider",
  "spinbutton",
  "switch",
  "tab",
  "textbox",
  "treeitem",
]);

const VALID_LANG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;
const VALID_ROLES = new Set([
  "alert",
  "alertdialog",
  "application",
  "article",
  "banner",
  "button",
  "cell",
  "checkbox",
  "columnheader",
  "combobox",
  "complementary",
  "contentinfo",
  "definition",
  "dialog",
  "directory",
  "document",
  "feed",
  "figure",
  "form",
  "grid",
  "gridcell",
  "group",
  "heading",
  "img",
  "link",
  "list",
  "listbox",
  "listitem",
  "log",
  "main",
  "marquee",
  "math",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "meter",
  "navigation",
  "none",
  "note",
  "option",
  "presentation",
  "progressbar",
  "radio",
  "radiogroup",
  "region",
  "row",
  "rowgroup",
  "rowheader",
  "scrollbar",
  "search",
  "searchbox",
  "separator",
  "slider",
  "spinbutton",
  "status",
  "switch",
  "tab",
  "table",
  "tablist",
  "tabpanel",
  "term",
  "textbox",
  "timer",
  "toolbar",
  "tooltip",
  "tree",
  "treegrid",
  "treeitem",
]);

const RULES = Object.freeze({
  "html-lang": {
    category: "Understandable",
    criterion: "Language of Page",
    wcag: "3.1.1",
    level: "A",
    severity: "serious",
  },
  "document-title": {
    category: "Operable",
    criterion: "Page Titled",
    wcag: "2.4.2",
    level: "A",
    severity: "serious",
  },
  "main-landmark": {
    category: "Operable",
    criterion: "Bypass Blocks",
    wcag: "2.4.1",
    level: "A",
    severity: "moderate",
  },
  "heading-order": {
    category: "Perceivable",
    criterion: "Info and Relationships",
    wcag: "1.3.1",
    level: "A",
    severity: "moderate",
  },
  "heading-name": {
    category: "Operable",
    criterion: "Headings and Labels",
    wcag: "2.4.6",
    level: "AA",
    severity: "serious",
  },
  "image-alt": {
    category: "Perceivable",
    criterion: "Non-text Content",
    wcag: "1.1.1",
    level: "A",
    severity: "serious",
  },
  "control-name": {
    category: "Robust",
    criterion: "Name, Role, Value",
    wcag: "4.1.2",
    level: "A",
    severity: "critical",
  },
  "form-label": {
    category: "Perceivable",
    criterion: "Info and Relationships",
    wcag: "1.3.1",
    level: "A",
    severity: "serious",
  },
  "iframe-title": {
    category: "Operable",
    criterion: "Bypass Blocks",
    wcag: "2.4.1",
    level: "A",
    severity: "serious",
  },
  "positive-tabindex": {
    category: "Operable",
    criterion: "Focus Order",
    wcag: "2.4.3",
    level: "A",
    severity: "serious",
  },
  "aria-hidden-focus": {
    category: "Robust",
    criterion: "Name, Role, Value",
    wcag: "4.1.2",
    level: "A",
    severity: "serious",
  },
  "duplicate-id": {
    category: "Robust",
    criterion: "Name, Role, Value",
    wcag: "4.1.2",
    level: "A",
    severity: "serious",
  },
  "custom-control-keyboard": {
    category: "Operable",
    criterion: "Keyboard",
    wcag: "2.1.1",
    level: "A",
    severity: "critical",
  },
  "invalid-role": {
    category: "Robust",
    criterion: "Name, Role, Value",
    wcag: "4.1.2",
    level: "A",
    severity: "serious",
  },
  "aria-reference": {
    category: "Robust",
    criterion: "Name, Role, Value",
    wcag: "4.1.2",
    level: "A",
    severity: "serious",
  },
  "media-captions": {
    category: "Perceivable",
    criterion: "Captions (Prerecorded)",
    wcag: "1.2.2",
    level: "A",
    severity: "critical",
  },
  "table-name": {
    category: "Perceivable",
    criterion: "Info and Relationships",
    wcag: "1.3.1",
    level: "A",
    severity: "moderate",
  },
  "table-header": {
    category: "Perceivable",
    criterion: "Info and Relationships",
    wcag: "1.3.1",
    level: "A",
    severity: "serious",
  },
  "viewport-zoom": {
    category: "Perceivable",
    criterion: "Resize Text",
    wcag: "1.4.4",
    level: "AA",
    severity: "serious",
  },
  "inline-contrast": {
    category: "Perceivable",
    criterion: "Contrast (Minimum)",
    wcag: "1.4.3",
    level: "AA",
    severity: "serious",
  },
  "error-description": {
    category: "Understandable",
    criterion: "Error Identification",
    wcag: "3.3.1",
    level: "A",
    severity: "moderate",
  },
});

// # Markup parser
function readTag(source, start) {
  let quote = null;
  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return { raw: source.slice(start, index + 1), end: index + 1 };
    }
  }
  throw new AuditInputError(
    "MALFORMED_HTML",
    "The markup contains a tag that is not closed with >.",
  );
}

function parseAttributes(raw) {
  const inner = raw
    .replace(/^<\/?\s*[a-z][\w:-]*/i, "")
    .replace(/\/?\s*>$/, "");
  const attributes = Object.create(null);
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(inner))) {
    const name = match[1].toLowerCase();
    if (!(name in attributes)) {
      attributes[name] = match[2] ?? match[3] ?? match[4] ?? "";
    }
  }
  return attributes;
}

export function parseHtml(source) {
  const root = {
    tag: "#document",
    attrs: Object.create(null),
    children: [],
    parent: null,
    offset: 0,
    text: "",
  };
  const nodes = [];
  const stack = [root];
  let index = 0;

  while (index < source.length) {
    const open = source.indexOf("<", index);
    if (open === -1) {
      stack.at(-1).text += source.slice(index);
      break;
    }
    stack.at(-1).text += source.slice(index, open);
    if (source.startsWith("<!--", open)) {
      const close = source.indexOf("-->", open + 4);
      if (close === -1) {
        throw new AuditInputError(
          "MALFORMED_HTML",
          "The markup contains an unclosed HTML comment.",
        );
      }
      index = close + 3;
      continue;
    }
    const token = readTag(source, open);
    if (/^<!|^<\?/.test(token.raw)) {
      index = token.end;
      continue;
    }
    const closing = /^<\//.test(token.raw);
    const nameMatch = token.raw.match(/^<\/?\s*([a-z][\w:-]*)/i);
    if (!nameMatch) {
      stack.at(-1).text += "<";
      index = open + 1;
      continue;
    }
    const tag = nameMatch[1].toLowerCase();
    if (closing) {
      const matchingIndex = stack.findLastIndex((node) => node.tag === tag);
      if (matchingIndex > 0) stack.length = matchingIndex;
      index = token.end;
      continue;
    }

    const parent = stack.at(-1);
    const node = {
      tag,
      attrs: parseAttributes(token.raw),
      children: [],
      parent,
      offset: open,
      raw: token.raw,
      text: "",
    };
    parent.children.push(node);
    nodes.push(node);
    index = token.end;

    if (!VOID_ELEMENTS.has(tag) && !/\/\s*>$/.test(token.raw)) {
      stack.push(node);
      if (tag === "script" || tag === "style") {
        const closePattern = new RegExp(`<\\/\\s*${tag}\\s*>`, "ig");
        closePattern.lastIndex = index;
        const close = closePattern.exec(source);
        if (close) {
          node.text = source.slice(index, close.index);
          stack.pop();
          index = close.index + close[0].length;
        }
      }
    }
  }
  return { root, nodes };
}

// # Element helpers
const TEXT_CACHE = new WeakMap();
const HIDDEN_CACHE = new WeakMap();

function getText(node) {
  if (!node) return "";
  if (TEXT_CACHE.has(node)) return TEXT_CACHE.get(node);
  const stack = [[node, false]];
  while (stack.length) {
    const [current, visited] = stack.pop();
    if (TEXT_CACHE.has(current)) continue;
    if (!visited) {
      stack.push([current, true]);
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        const child = current.children[index];
        if (!TEXT_CACHE.has(child)) stack.push([child, false]);
      }
      continue;
    }
    const alternate = current.tag === "img" ? attribute(current, "alt") || "" : "";
    const value = `${current.text || ""} ${alternate} ${current.children
      .map((child) => TEXT_CACHE.get(child) || "")
      .join(" ")}`
      .replace(/\s+/g, " ")
      .trim();
    TEXT_CACHE.set(current, value);
  }
  return TEXT_CACHE.get(node) || "";
}

function attribute(node, name) {
  return node.attrs[name.toLowerCase()];
}

function hasAttribute(node, name) {
  return Object.hasOwn(node.attrs, name.toLowerCase());
}

function isHidden(node) {
  if (HIDDEN_CACHE.has(node)) return HIDDEN_CACHE.get(node);
  const chain = [];
  let current = node;
  while (
    current?.tag !== "#document" &&
    !HIDDEN_CACHE.has(current)
  ) {
    chain.push(current);
    current = current.parent;
  }
  let hidden = current?.tag === "#document"
    ? false
    : Boolean(current && HIDDEN_CACHE.get(current));
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const candidate = chain[index];
    hidden =
      hidden ||
      hasAttribute(candidate, "hidden") ||
      attribute(candidate, "aria-hidden")?.toLowerCase() === "true" ||
      (candidate.tag === "input" && attribute(candidate, "type") === "hidden");
    HIDDEN_CACHE.set(candidate, hidden);
  }
  return Boolean(HIDDEN_CACHE.get(node));
}

function isFocusable(node) {
  if (hasAttribute(node, "disabled") || isHidden(node)) return false;
  return isIntrinsicallyFocusable(node);
}

function isIntrinsicallyFocusable(node) {
  if (hasAttribute(node, "disabled")) return false;
  const tabindex = attribute(node, "tabindex");
  if (tabindex !== undefined) return Number(tabindex) >= 0;
  if (node.tag === "a" || node.tag === "area") return hasAttribute(node, "href");
  if (INTERACTIVE_ELEMENTS.has(node.tag)) return true;
  return hasAttribute(node, "contenteditable");
}

function selectorFor(node) {
  if (!node || node.tag === "#document") return "document";
  if (attribute(node, "id")) return `${node.tag}#${attribute(node, "id")}`;
  const parts = [];
  let current = node;
  while (current && current.tag !== "#document" && parts.length < 4) {
    const siblings = current.parent?.children.filter(
      (sibling) => sibling.tag === current.tag,
    );
    const suffix =
      siblings?.length > 1
        ? `:nth-of-type(${siblings.indexOf(current) + 1})`
        : "";
    parts.unshift(`${current.tag}${suffix}`);
    current = current.parent;
  }
  return parts.join(" > ");
}

function descendantsOf(node) {
  const descendants = [];
  const stack = [...node.children].reverse();
  while (stack.length) {
    const current = stack.pop();
    descendants.push(current);
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }
  return descendants;
}

function accessibleName(node, idMap, labelMap) {
  const direct = attribute(node, "aria-label")?.trim();
  if (direct) return direct;
  const labelledBy = attribute(node, "aria-labelledby")?.trim();
  if (labelledBy) {
    const value = labelledBy
      .split(/\s+/)
      .map((id) => getText(idMap.get(id)?.[0]))
      .join(" ")
      .trim();
    if (value) return value;
  }
  const id = attribute(node, "id");
  if (id && labelMap.has(id)) {
    const value = labelMap.get(id).map(getText).join(" ").trim();
    if (value) return value;
  }
  for (let parent = node.parent; parent?.tag !== "#document"; parent = parent.parent) {
    if (parent.tag === "label") {
      const value = getText(parent);
      if (value) return value;
      break;
    }
  }
  if (node.tag === "img" && hasAttribute(node, "alt")) {
    return attribute(node, "alt").trim();
  }
  const text = getText(node);
  if (text) return text;
  return attribute(node, "title")?.trim() || "";
}

function parseColor(value) {
  if (!value) return null;
  const color = value.trim().toLowerCase();
  const short = color.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    return [...short[1]].map((char) => parseInt(char + char, 16));
  }
  const full = color.match(/^#([0-9a-f]{6})$/i);
  if (full) {
    return [0, 2, 4].map((offset) => parseInt(full[1].slice(offset, offset + 2), 16));
  }
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return rgb.slice(1, 4).map((part) => Math.min(255, Number(part)));
  const named = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    blue: [0, 0, 255],
    green: [0, 128, 0],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
  };
  return named[color] || null;
}

function luminance(rgb) {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const foregroundRgb = Array.isArray(foreground)
    ? foreground
    : parseColor(foreground);
  const backgroundRgb = Array.isArray(background)
    ? background
    : parseColor(background);
  if (!foregroundRgb || !backgroundRgb) return null;
  const lighter = Math.max(luminance(foregroundRgb), luminance(backgroundRgb));
  const darker = Math.min(luminance(foregroundRgb), luminance(backgroundRgb));
  return (lighter + 0.05) / (darker + 0.05);
}

function inlineStyle(node) {
  const declarations = Object.create(null);
  for (const declaration of (attribute(node, "style") || "").split(";")) {
    const split = declaration.indexOf(":");
    if (split > 0) {
      declarations[declaration.slice(0, split).trim().toLowerCase()] = declaration
        .slice(split + 1)
        .trim();
    }
  }
  return declarations;
}

// # Deterministic audit
export function analyzeAccessibility(html) {
  if (typeof html !== "string") {
    throw new AuditInputError("INVALID_INPUT", "HTML input must be a string.");
  }
  if (html.length > MAX_HTML_LENGTH) {
    throw new AuditInputError(
      "INPUT_TOO_LARGE",
      `HTML input must be ${MAX_HTML_LENGTH.toLocaleString("en-US")} characters or fewer.`,
    );
  }
  if (!html.trim()) {
    return Object.freeze({
      version: AUDIT_VERSION,
      status: "empty",
      score: null,
      conformance: "NOT_ASSESSED",
      summary: { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 },
      findings: [],
      passedChecks: [],
      manualChecks: MANUAL_CHECKS,
      analyzedElements: 0,
    });
  }

  const { nodes } = parseHtml(html);
  const lineStarts = [0];
  for (let index = 0; index < html.length; index += 1) {
    if (html[index] === "\n") lineStarts.push(index + 1);
  }
  const locate = (offset) => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (lineStarts[middle] <= offset) low = middle + 1;
      else high = middle - 1;
    }
    return { line: high + 1, column: offset - lineStarts[high] + 1 };
  };
  const idMap = new Map();
  const labelMap = new Map();
  for (const node of nodes) {
    const id = attribute(node, "id");
    if (id) idMap.set(id, [...(idMap.get(id) || []), node]);
    if (node.tag === "label" && attribute(node, "for")) {
      const target = attribute(node, "for");
      labelMap.set(target, [...(labelMap.get(target) || []), node]);
    }
  }

  const findings = [];
  const checkedRules = new Set();
  const add = (ruleId, node, message, evidence, remediation, severity) => {
    const rule = RULES[ruleId];
    checkedRules.add(ruleId);
    const location = locate(node?.offset || 0);
    findings.push({
      id: "",
      ruleId,
      category: rule.category,
      wcag: rule.wcag,
      criterion: rule.criterion,
      level: rule.level,
      severity: severity || rule.severity,
      message,
      selector: selectorFor(node),
      line: location.line,
      column: location.column,
      evidence: String(evidence || node?.raw || "").slice(0, 240),
      remediation,
    });
  };

  const documentMode = nodes.some((node) =>
    ["html", "head", "body"].includes(node.tag),
  );
  if (documentMode) {
    checkedRules.add("html-lang");
    const htmlNode = nodes.find((node) => node.tag === "html");
    const language = htmlNode && attribute(htmlNode, "lang")?.trim();
    if (!language || !VALID_LANG.test(language)) {
      add(
        "html-lang",
        htmlNode,
        language ? "The page language is not a valid BCP 47-style tag." : "The page language is missing.",
        htmlNode?.raw || "<html>",
        'Set a valid language on the root element, such as <html lang="en">.',
      );
    }
    checkedRules.add("document-title");
    const title = nodes.find((node) => node.tag === "title");
    if (!title || !getText(title)) {
      add(
        "document-title",
        title || nodes[0],
        "The document does not have a descriptive title.",
        title?.raw || "<head>",
        "Add a concise, unique <title> that identifies the page purpose.",
      );
    }
    checkedRules.add("main-landmark");
    const mains = nodes.filter(
      (node) => node.tag === "main" || attribute(node, "role") === "main",
    );
    if (mains.length !== 1) {
      add(
        "main-landmark",
        mains[1] || nodes.find((node) => node.tag === "body") || nodes[0],
        mains.length === 0
          ? "The page has no main landmark."
          : "The page has more than one main landmark.",
        mains.length ? mains.map((node) => node.raw).join(" ") : "<body>",
        "Use exactly one visible <main> element for the page's primary content.",
      );
    }
    checkedRules.add("viewport-zoom");
    const viewport = nodes.find(
      (node) =>
        node.tag === "meta" && attribute(node, "name")?.toLowerCase() === "viewport",
    );
    const viewportContent = attribute(viewport || { attrs: {} }, "content") || "";
    if (/user-scalable\s*=\s*no/i.test(viewportContent) || /maximum-scale\s*=\s*1(?:\.0+)?(?:\s|,|$)/i.test(viewportContent)) {
      add(
        "viewport-zoom",
        viewport,
        "The viewport configuration prevents users from zooming.",
        viewport.raw,
        "Remove user-scalable=no and restrictive maximum-scale values.",
      );
    }
  }

  const headings = nodes.filter((node) => /^h[1-6]$/.test(node.tag) && !isHidden(node));
  checkedRules.add("heading-name");
  checkedRules.add("heading-order");
  let priorLevel = 0;
  for (const heading of headings) {
    const level = Number(heading.tag[1]);
    if (!getText(heading)) {
      add(
        "heading-name",
        heading,
        "This heading has no accessible text.",
        heading.raw,
        "Add concise visible heading text or remove the empty heading.",
      );
    }
    if (priorLevel && level > priorLevel + 1) {
      add(
        "heading-order",
        heading,
        `The heading level skips from h${priorLevel} to h${level}.`,
        heading.raw,
        "Use heading levels in a logical sequence without skipping levels.",
      );
    }
    priorLevel = level;
  }
  if (documentMode) {
    const h1Count = headings.filter((node) => node.tag === "h1").length;
    if (h1Count !== 1) {
      add(
        "heading-order",
        headings.find((node) => node.tag === "h1") || nodes[0],
        h1Count === 0
          ? "The page has no level-one heading."
          : "The page has more than one level-one heading.",
        h1Count ? `${h1Count} <h1> elements` : "No <h1> element",
        "Give the page one clear h1, then organize sections with descending heading levels.",
      );
    }
  }

  for (const [id, matches] of idMap) {
    if (matches.length > 1) {
      for (const duplicate of matches.slice(1)) {
        add(
          "duplicate-id",
          duplicate,
          `The id "${id}" is used more than once.`,
          duplicate.raw,
          "Assign every id a unique value and update label/ARIA references to match.",
        );
      }
    }
  }
  checkedRules.add("duplicate-id");

  for (const node of nodes) {
    checkedRules.add("aria-hidden-focus");
    if (attribute(node, "aria-hidden")?.toLowerCase() === "true") {
      const descendants = descendantsOf(node);
      const focusable = [node, ...descendants].find(isIntrinsicallyFocusable);
      if (focusable) {
        add(
          "aria-hidden-focus",
          focusable,
          "A focusable element is hidden from assistive technology.",
          focusable.raw,
          "Remove aria-hidden from the focusable subtree or remove those elements from keyboard focus.",
        );
      }
    }
    if (isHidden(node)) continue;
    if (node.tag === "img") {
      checkedRules.add("image-alt");
      if (!hasAttribute(node, "alt")) {
        add(
          "image-alt",
          node,
          "This image has no alt attribute.",
          node.raw,
          'Add meaningful alt text, or alt="" when the image is purely decorative.',
        );
      }
    }

    const name = accessibleName(node, idMap, labelMap);
    const roleTokens = (attribute(node, "role") || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const recognizedRole = roleTokens.find((token) => VALID_ROLES.has(token));
    const inputType = (attribute(node, "type") || "text").toLowerCase();
    const requiresControlName =
      node.tag === "button" ||
      (node.tag === "a" && hasAttribute(node, "href")) ||
      (node.tag === "input" && inputType === "image") ||
      INTERACTIVE_ROLES.has(recognizedRole);
    if (requiresControlName) {
      checkedRules.add("control-name");
      if (!name) {
        add(
          "control-name",
          node,
          `This ${recognizedRole || node.tag} control has no accessible name.`,
          node.raw,
          "Add clear visible text or an accurate aria-label. Prefer visible text when possible.",
        );
      }
    }

    if (["input", "select", "textarea"].includes(node.tag)) {
      const type = inputType;
      if (!['hidden', 'button', 'submit', 'reset', 'image'].includes(type)) {
        checkedRules.add("form-label");
        if (!name) {
          add(
            "form-label",
            node,
            "This form control is not associated with a label.",
            node.raw,
            "Add a visible <label for=\"…\"> matched to a unique id. Use aria-label only when a visible label is impractical.",
          );
        }
      }
      checkedRules.add("error-description");
      if (
        attribute(node, "aria-invalid")?.toLowerCase() === "true" &&
        !attribute(node, "aria-describedby")?.trim()
      ) {
        add(
          "error-description",
          node,
          "This invalid field is not linked to its error description.",
          node.raw,
          "Reference the visible error element with aria-describedby and announce submission errors.",
        );
      }
    }

    checkedRules.add("positive-tabindex");
    const tabindex = attribute(node, "tabindex");
    if (tabindex !== undefined && Number(tabindex) > 0) {
      add(
        "positive-tabindex",
        node,
        "A positive tabindex overrides the natural focus order.",
        node.raw,
        'Use native document order with tabindex="0" or remove tabindex.',
      );
    }

    checkedRules.add("invalid-role");
    if (roleTokens.length && !recognizedRole) {
      add(
        "invalid-role",
        node,
        `The ARIA role "${attribute(node, "role")}" is invalid or abstract.`,
        node.raw,
        "Use a valid, non-abstract ARIA role—or prefer the equivalent native HTML element.",
      );
    }

    checkedRules.add("aria-reference");
    for (const referenceAttribute of [
      "aria-labelledby",
      "aria-describedby",
      "aria-controls",
      "aria-owns",
      "aria-activedescendant",
    ]) {
      const references = attribute(node, referenceAttribute)?.trim().split(/\s+/).filter(Boolean) || [];
      const missing = references.filter((id) => !idMap.has(id));
      if (missing.length) {
        add(
          "aria-reference",
          node,
          `${referenceAttribute} references missing id${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
          node.raw,
          "Create the referenced element IDs or remove stale ARIA references.",
        );
      }
    }

    const hasClick = hasAttribute(node, "onclick");
    const nativeInteractive =
      INTERACTIVE_ELEMENTS.has(node.tag) ||
      ((node.tag === "a" || node.tag === "area") && hasAttribute(node, "href"));
    if (hasClick && !nativeInteractive) {
      checkedRules.add("custom-control-keyboard");
      const keyboardHandler =
        hasAttribute(node, "onkeydown") ||
        hasAttribute(node, "onkeyup") ||
        hasAttribute(node, "onkeypress");
      if (!isFocusable(node) || !keyboardHandler || !role) {
        add(
          "custom-control-keyboard",
          node,
          "This custom clickable element is not fully keyboard operable.",
          node.raw,
          "Replace it with a native <button> or add an appropriate role, tabindex=\"0\", and Enter/Space keyboard handling.",
        );
      }
    }

    if (node.tag === "iframe") {
      checkedRules.add("iframe-title");
      if (!attribute(node, "title")?.trim()) {
        add(
          "iframe-title",
          node,
          "This iframe has no descriptive title.",
          node.raw,
          "Add a concise title attribute describing the embedded content.",
        );
      }
    }

    if (node.tag === "video") {
      checkedRules.add("media-captions");
      const captionTrack = node.children.some(
        (child) =>
          child.tag === "track" &&
          (attribute(child, "kind") || "subtitles").toLowerCase() === "captions",
      );
      if (!captionTrack) {
        add(
          "media-captions",
          node,
          "This video has no captions track.",
          node.raw,
          "Provide synchronized captions with <track kind=\"captions\"> for prerecorded speech and meaningful audio.",
        );
      }
    }

    if (node.tag === "table") {
      checkedRules.add("table-name");
      checkedRules.add("table-header");
      const descendants = descendantsOf(node);
      const caption = descendants.find((candidate) => candidate.tag === "caption");
      if (!getText(caption) && !attribute(node, "aria-label")?.trim() && !attribute(node, "aria-labelledby")?.trim()) {
        add(
          "table-name",
          node,
          "This data table has no accessible description.",
          node.raw,
          "Add a descriptive <caption>, aria-label, or aria-labelledby value.",
        );
      }
      if (!descendants.some((candidate) => candidate.tag === "th")) {
        add(
          "table-header",
          node,
          "This table has no header cells.",
          node.raw,
          "Use <th scope=\"col\"> and <th scope=\"row\"> to associate headers with data cells.",
        );
      }
    }

    const style = inlineStyle(node);
    if (style.color && style["background-color"] && getText(node)) {
      checkedRules.add("inline-contrast");
      const ratio = contrastRatio(style.color, style["background-color"]);
      const fontSize = Number.parseFloat(style["font-size"] || "16");
      const bold = /bold|[7-9]00/.test(style["font-weight"] || "");
      const threshold = fontSize >= 24 || (fontSize >= 18.66 && bold) ? 3 : 4.5;
      if (ratio !== null && ratio < threshold) {
        add(
          "inline-contrast",
          node,
          `Inline text contrast is ${ratio.toFixed(2)}:1; at least ${threshold}:1 is required.`,
          node.raw,
          "Choose foreground and background colors that meet WCAG contrast, then verify computed styles in every state.",
        );
      }
    }
  }

  const severityOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  findings.sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.line - right.line ||
      left.column - right.column ||
      left.ruleId.localeCompare(right.ruleId),
  );
  const occurrenceByRule = new Map();
  for (const finding of findings) {
    const occurrence = (occurrenceByRule.get(finding.ruleId) || 0) + 1;
    occurrenceByRule.set(finding.ruleId, occurrence);
    finding.id = `${finding.ruleId}-${occurrence}`;
    Object.freeze(finding);
  }

  const summary = { total: findings.length, critical: 0, serious: 0, moderate: 0, minor: 0 };
  let penalty = 0;
  for (const finding of findings) {
    summary[finding.severity] += 1;
    penalty += SEVERITY_WEIGHTS[finding.severity];
  }
  const score = Math.max(0, 100 - Math.min(100, penalty));
  const failedRules = new Set(findings.map((finding) => finding.ruleId));
  const passedChecks = [...checkedRules]
    .filter((ruleId) => !failedRules.has(ruleId))
    .sort()
    .map((ruleId) => ({
      ruleId,
      wcag: RULES[ruleId].wcag,
      criterion: RULES[ruleId].criterion,
    }));

  return Object.freeze({
    version: AUDIT_VERSION,
    status: "complete",
    score,
    conformance:
      summary.critical || summary.serious
        ? "DOES_NOT_CONFORM"
        : summary.moderate || summary.minor
          ? "PARTIALLY_CONFORMS"
          : "AUTOMATED_CHECKS_PASSED",
    summary: Object.freeze(summary),
    findings: Object.freeze(findings),
    passedChecks: Object.freeze(passedChecks),
    manualChecks: MANUAL_CHECKS,
    analyzedElements: nodes.length,
  });
}
