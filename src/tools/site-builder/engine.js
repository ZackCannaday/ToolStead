// # Project constants

export const SITE_BUILDER_SCHEMA_VERSION = 1;

export const SITE_MODES = Object.freeze(["website", "landing-page", "funnel"]);

export const SECTION_TYPES = Object.freeze([
  "hero",
  "content",
  "features",
  "image-text",
  "call-to-action",
  "form",
  "faq",
]);

export const FORM_FIELD_TYPES = Object.freeze([
  "text",
  "email",
  "tel",
  "textarea",
  "select",
  "radio",
  "checkbox",
]);

export const FONT_FAMILIES = Object.freeze([
  "system",
  "modern",
  "editorial",
  "technical",
]);

export const SITE_BUILDER_LIMITS = Object.freeze({
  pages: 50,
  sectionsPerPage: 100,
  totalSections: 500,
  itemsPerSection: 30,
  fieldsPerForm: 40,
  totalFields: 400,
  text: 5_000,
  totalText: 250_000,
  shortText: 160,
  projectName: 100,
  slug: 120,
  url: 2_048,
  exportBytes: 5_000_000,
});

const DEFAULT_THEME = Object.freeze({
  primaryColor: "#2563eb",
  accentColor: "#0f766e",
  backgroundColor: "#ffffff",
  surfaceColor: "#f8fafc",
  textColor: "#0f172a",
  mutedColor: "#475569",
  fontFamily: "system",
  radius: "12px",
});

const FONT_STACKS = Object.freeze({
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  modern: "Inter, ui-sans-serif, system-ui, sans-serif",
  editorial: "Georgia, 'Times New Roman', serif",
  technical: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
});

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SLUG_PATTERN = /^\/$|^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

function relativeLuminance(color) {
  const channels = color.slice(1).match(/.{2}/g).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export class SiteBuilderError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = "SiteBuilderError";
    this.issues = Object.freeze([...issues]);
  }
}

// # Text normalization

function cleanText(value, maximum = SITE_BUILDER_LIMITS.text) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .slice(0, maximum)
    .trim();
}

function cleanShortText(value, maximum = SITE_BUILDER_LIMITS.shortText) {
  return cleanText(value, maximum).replace(/\s+/g, " ");
}

function cleanId(value, fallback) {
  const candidate = cleanShortText(value, 64).toLowerCase();
  return ID_PATTERN.test(candidate) ? candidate : fallback;
}

export function normalizeSlug(value, fallback = "page") {
  const source = cleanShortText(value || fallback, SITE_BUILDER_LIMITS.slug)
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/[?#].*$/, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\/{2,}/g, "/")
    .replace(/(^|\/)\-+/g, "$1")
    .replace(/-+(\/|$)/g, "$1")
    .replace(/^\/+|\/+$/g, "");
  return source ? `/${source}` : "/";
}

export function safeUrl(value, { image = false, formAction = false } = {}) {
  const source = cleanShortText(value, SITE_BUILDER_LIMITS.url);
  if (!source) return "";
  if (/^[\s\u0000-\u001f]*[a-z][a-z0-9+.-]*\s*:/i.test(source)) {
    let url;
    try {
      url = new URL(source);
    } catch {
      return "";
    }
    if (url.username || url.password) return "";
    if (url.protocol === "https:") return url.href;
    if (!image && !formAction && ["http:", "mailto:", "tel:"].includes(url.protocol)) {
      return url.href;
    }
    return "";
  }
  if (source.startsWith("//")) return "";
  if (source.startsWith("#") && !image && !formAction) {
    return /^#[a-z][a-z0-9-_:.]*$/i.test(source) ? source : "";
  }
  if (source.startsWith("/")) {
    return /^\/[a-z0-9/_~.%-]*(?:\?[a-z0-9=&_~.%-]*)?(?:#[a-z0-9-_:.]*)?$/i.test(source)
      ? source
      : "";
  }
  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphs(value) {
  return cleanText(value)
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

// # Identifier helpers

function nextId(prefix, ids) {
  let number = 1;
  const used = new Set(ids);
  while (used.has(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function uniqueId(value, prefix, usedIds) {
  let id = cleanId(value, nextId(prefix, usedIds));
  if (usedIds.includes(id)) id = nextId(prefix, usedIds);
  return id;
}

function uniqueSlug(requested, pages, excludedPageId = null) {
  const base = normalizeSlug(requested);
  const used = new Set(
    pages.filter((page) => page.id !== excludedPageId).map((page) => page.slug),
  );
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base === "/" ? "/home" : base}-${suffix}`)) suffix += 1;
  return `${base === "/" ? "/home" : base}-${suffix}`;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

// # Content normalization

function normalizeAction(action = {}) {
  return {
    label: cleanShortText(action.label, 80),
    url: safeUrl(action.url),
  };
}

function normalizeItems(items = [], prefix = "item") {
  if (!Array.isArray(items)) return [];
  const ids = [];
  return items.slice(0, SITE_BUILDER_LIMITS.itemsPerSection).map((item) => {
    const id = uniqueId(item?.id, prefix, ids);
    ids.push(id);
    return {
      id,
      title: cleanShortText(item?.title),
      body: cleanText(item?.body),
    };
  });
}

function normalizeFormFields(fields = []) {
  if (!Array.isArray(fields)) return [];
  const ids = [];
  const names = [];
  return fields.slice(0, SITE_BUILDER_LIMITS.fieldsPerForm).map((field, index) => {
    const type = FORM_FIELD_TYPES.includes(field?.type) ? field.type : "text";
    const fallbackName = `field_${index + 1}`;
    const suppliedName = cleanShortText(field?.name, 64).toLowerCase();
    let name = FIELD_NAME_PATTERN.test(suppliedName) ? suppliedName : fallbackName;
    while (names.includes(name)) name = `${fallbackName}_${names.length + 1}`;
    names.push(name);
    const id = uniqueId(field?.id, "field", ids);
    ids.push(id);
    const options = ["select", "radio", "checkbox"].includes(type) && Array.isArray(field?.options)
      ? field.options
          .slice(0, SITE_BUILDER_LIMITS.itemsPerSection)
          .map((option) => cleanShortText(option, 100))
          .filter(Boolean)
      : [];
    return {
      id,
      type,
      name,
      label: cleanShortText(field?.label),
      placeholder: cleanShortText(field?.placeholder),
      required: field?.required === true,
      options,
    };
  });
}

export function normalizeSection(input = {}, fallbackId = "section-1") {
  const type = SECTION_TYPES.includes(input.type) ? input.type : "content";
  const base = {
    id: cleanId(input.id, fallbackId),
    type,
    hidden: input.hidden === true,
  };
  switch (type) {
    case "hero":
      return {
        ...base,
        content: {
          eyebrow: cleanShortText(input.content?.eyebrow, 80),
          heading: cleanShortText(input.content?.heading),
          body: cleanText(input.content?.body),
          primaryAction: normalizeAction(input.content?.primaryAction),
          secondaryAction: normalizeAction(input.content?.secondaryAction),
          image: {
            src: safeUrl(input.content?.image?.src, { image: true }),
            alt: cleanShortText(input.content?.image?.alt),
          },
        },
      };
    case "features":
    case "faq":
      return {
        ...base,
        content: {
          heading: cleanShortText(input.content?.heading),
          body: cleanText(input.content?.body),
          items: normalizeItems(input.content?.items, type === "faq" ? "question" : "feature"),
        },
      };
    case "image-text":
      return {
        ...base,
        content: {
          heading: cleanShortText(input.content?.heading),
          body: cleanText(input.content?.body),
          image: {
            src: safeUrl(input.content?.image?.src, { image: true }),
            alt: cleanShortText(input.content?.image?.alt),
          },
          imagePosition: input.content?.imagePosition === "right" ? "right" : "left",
          action: normalizeAction(input.content?.action),
        },
      };
    case "call-to-action":
      return {
        ...base,
        content: {
          heading: cleanShortText(input.content?.heading),
          body: cleanText(input.content?.body),
          action: normalizeAction(input.content?.action),
        },
      };
    case "form":
      return {
        ...base,
        content: {
          heading: cleanShortText(input.content?.heading),
          body: cleanText(input.content?.body),
          actionUrl: safeUrl(input.content?.actionUrl, { formAction: true }),
          submitLabel: cleanShortText(input.content?.submitLabel, 80) || "Submit",
          successMessage: cleanShortText(input.content?.successMessage, 240),
          fields: normalizeFormFields(input.content?.fields),
        },
      };
    default:
      return {
        ...base,
        content: {
          heading: cleanShortText(input.content?.heading),
          body: cleanText(input.content?.body),
          action: normalizeAction(input.content?.action),
        },
      };
  }
}

function normalizeTheme(input = {}) {
  const theme = {};
  for (const key of [
    "primaryColor",
    "accentColor",
    "backgroundColor",
    "surfaceColor",
    "textColor",
    "mutedColor",
  ]) {
    theme[key] = COLOR_PATTERN.test(input[key] ?? "")
      ? input[key].toLowerCase()
      : DEFAULT_THEME[key];
  }
  theme.fontFamily = FONT_FAMILIES.includes(input.fontFamily)
    ? input.fontFamily
    : DEFAULT_THEME.fontFamily;
  theme.radius = ["0px", "6px", "12px", "20px"].includes(input.radius)
    ? input.radius
    : DEFAULT_THEME.radius;
  return theme;
}

function normalizePage(input, pages, fallbackId) {
  const name = cleanShortText(input?.name, 100) || "Untitled page";
  return {
    id: cleanId(input?.id, fallbackId),
    name,
    slug: uniqueSlug(input?.slug || name, pages),
    showInNavigation: input?.showInNavigation !== false,
    seo: {
      title: cleanShortText(input?.seo?.title, 70),
      description: cleanShortText(input?.seo?.description, 160),
    },
    sections: normalizeSections(input?.sections),
  };
}

function normalizeSections(sections) {
  if (!Array.isArray(sections)) return [];
  const ids = [];
  return sections.slice(0, SITE_BUILDER_LIMITS.sectionsPerPage).map((section) => {
    const id = uniqueId(section?.id, "section", ids);
    ids.push(id);
    return normalizeSection({ ...section, id }, id);
  });
}

export function normalizeSiteProject(input = {}) {
  const name = cleanShortText(input?.name, SITE_BUILDER_LIMITS.projectName) || "Untitled site";
  const pages = [];
  const pageIds = [];
  const suppliedPages = Array.isArray(input?.pages)
    ? input.pages.slice(0, SITE_BUILDER_LIMITS.pages)
    : [];
  suppliedPages.forEach((page) => {
    const id = uniqueId(page?.id, "page", pageIds);
    pageIds.push(id);
    pages.push(normalizePage({ ...page, id }, pages, id));
  });
  return {
    schemaVersion: SITE_BUILDER_SCHEMA_VERSION,
    id: cleanId(input?.id, "site-1"),
    name,
    mode: SITE_MODES.includes(input?.mode) ? input.mode : "website",
    language: /^[a-z]{2}(?:-[A-Z]{2})?$/.test(input?.language ?? "")
      ? input.language
      : "en",
    siteName: cleanShortText(input?.siteName, 100) || name,
    theme: normalizeTheme(input?.theme),
    pages,
  };
}

// # Project operations

export function createSiteProject(input = {}) {
  const name = cleanShortText(input.name, SITE_BUILDER_LIMITS.projectName) || "Untitled site";
  const projectId = cleanId(input.id, "site-1");
  const initialPage = normalizePage(
    {
      id: input.homePageId || "page-1",
      name: input.homePageName || "Home",
      slug: "/",
      showInNavigation: true,
      seo: input.homePageSeo,
      sections: input.sections,
    },
    [],
    "page-1",
  );
  return {
    schemaVersion: SITE_BUILDER_SCHEMA_VERSION,
    id: projectId,
    name,
    mode: SITE_MODES.includes(input.mode) ? input.mode : "website",
    language: /^[a-z]{2}(?:-[A-Z]{2})?$/.test(input.language ?? "") ? input.language : "en",
    siteName: cleanShortText(input.siteName, 100) || name,
    theme: normalizeTheme(input.theme),
    pages: [initialPage],
  };
}

function requireProject(project) {
  if (!project || typeof project !== "object" || !Array.isArray(project.pages)) {
    throw new SiteBuilderError("A valid site project is required.");
  }
}

function requirePage(project, pageId) {
  const index = project.pages.findIndex((page) => page.id === pageId);
  if (index === -1) throw new SiteBuilderError(`Page ${pageId} was not found.`);
  return index;
}

export function addPage(project, input = {}) {
  requireProject(project);
  if (project.pages.length >= SITE_BUILDER_LIMITS.pages) {
    throw new SiteBuilderError(`A site can contain at most ${SITE_BUILDER_LIMITS.pages} pages.`);
  }
  const next = clone(project);
  const id = cleanId(input.id, nextId("page", next.pages.map((page) => page.id)));
  if (next.pages.some((page) => page.id === id)) {
    throw new SiteBuilderError(`Page id ${id} is already in use.`);
  }
  next.pages.push(normalizePage({ ...input, id }, next.pages, id));
  return next;
}

export function updatePage(project, pageId, patch = {}) {
  requireProject(project);
  const index = requirePage(project, pageId);
  const next = clone(project);
  const current = next.pages[index];
  const name = patch.name === undefined
    ? current.name
    : cleanShortText(patch.name, 100) || "Untitled page";
  next.pages[index] = {
    ...current,
    name,
    slug: patch.slug === undefined
      ? current.slug
      : uniqueSlug(patch.slug || name, next.pages, pageId),
    showInNavigation: patch.showInNavigation === undefined
      ? current.showInNavigation
      : patch.showInNavigation === true,
    seo: {
      title: patch.seo?.title === undefined
        ? current.seo.title
        : cleanShortText(patch.seo.title, 70),
      description: patch.seo?.description === undefined
        ? current.seo.description
        : cleanShortText(patch.seo.description, 160),
    },
  };
  return next;
}

export function removePage(project, pageId) {
  requireProject(project);
  requirePage(project, pageId);
  if (project.pages.length === 1) {
    throw new SiteBuilderError("A site must keep at least one page.");
  }
  const next = clone(project);
  next.pages = next.pages.filter((page) => page.id !== pageId);
  if (!next.pages.some((page) => page.slug === "/")) next.pages[0].slug = "/";
  return next;
}

export function addSection(project, pageId, input = {}) {
  requireProject(project);
  const pageIndex = requirePage(project, pageId);
  const next = clone(project);
  const page = next.pages[pageIndex];
  if (page.sections.length >= SITE_BUILDER_LIMITS.sectionsPerPage) {
    throw new SiteBuilderError(
      `A page can contain at most ${SITE_BUILDER_LIMITS.sectionsPerPage} sections.`,
    );
  }
  const id = cleanId(input.id, nextId("section", page.sections.map((section) => section.id)));
  if (page.sections.some((section) => section.id === id)) {
    throw new SiteBuilderError(`Section id ${id} is already in use on this page.`);
  }
  page.sections.push(normalizeSection({ ...input, id }, id));
  return next;
}

export function updateSection(project, pageId, sectionId, patch = {}) {
  requireProject(project);
  const pageIndex = requirePage(project, pageId);
  const next = clone(project);
  const sections = next.pages[pageIndex].sections;
  const sectionIndex = sections.findIndex((section) => section.id === sectionId);
  if (sectionIndex === -1) throw new SiteBuilderError(`Section ${sectionId} was not found.`);
  const current = sections[sectionIndex];
  sections[sectionIndex] = normalizeSection(
    {
      ...current,
      ...patch,
      id: current.id,
      content: patch.content === undefined ? current.content : { ...current.content, ...patch.content },
    },
    current.id,
  );
  return next;
}

export function moveSection(project, pageId, sectionId, toIndex) {
  requireProject(project);
  const pageIndex = requirePage(project, pageId);
  const next = clone(project);
  const sections = next.pages[pageIndex].sections;
  const fromIndex = sections.findIndex((section) => section.id === sectionId);
  if (fromIndex === -1) throw new SiteBuilderError(`Section ${sectionId} was not found.`);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= sections.length) {
    throw new SiteBuilderError("Section destination is outside the page.");
  }
  const [section] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, section);
  return next;
}

export function removeSection(project, pageId, sectionId) {
  requireProject(project);
  const pageIndex = requirePage(project, pageId);
  const next = clone(project);
  const sections = next.pages[pageIndex].sections;
  if (!sections.some((section) => section.id === sectionId)) {
    throw new SiteBuilderError(`Section ${sectionId} was not found.`);
  }
  next.pages[pageIndex].sections = sections.filter((section) => section.id !== sectionId);
  return next;
}

export function updateProject(project, patch = {}) {
  requireProject(project);
  const next = clone(project);
  if (patch.name !== undefined) {
    next.name = cleanShortText(patch.name, SITE_BUILDER_LIMITS.projectName) || "Untitled site";
  }
  if (patch.siteName !== undefined) {
    next.siteName = cleanShortText(patch.siteName, 100) || next.name;
  }
  if (patch.mode !== undefined) {
    if (!SITE_MODES.includes(patch.mode)) throw new SiteBuilderError("Choose a supported site mode.");
    next.mode = patch.mode;
  }
  if (patch.language !== undefined) {
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(patch.language)) {
      throw new SiteBuilderError("Language must use a valid BCP 47 language tag such as en or en-US.");
    }
    next.language = patch.language;
  }
  if (patch.theme !== undefined) next.theme = normalizeTheme({ ...next.theme, ...patch.theme });
  return next;
}

// # Project validation

function issue(issues, path, message) {
  issues.push(Object.freeze({ path, message }));
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateSiteProject(project, { forExport = false } = {}) {
  const issues = [];
  let totalFields = 0;
  let totalSections = 0;
  let totalText = 0;

  function validateText(value, path, maximum, { required = false } = {}) {
    if (typeof value !== "string") {
      issue(issues, path, "Use plain text for this field.");
      return false;
    }
    totalText += value.length;
    if (value.length > maximum) {
      issue(issues, path, `Keep this field to ${maximum.toLocaleString("en-US")} characters or fewer.`);
      return false;
    }
    if (required && !cleanText(value, maximum)) {
      issue(issues, path, "This field is required.");
      return false;
    }
    return true;
  }

  function validateUrl(value, path, options = {}, { required = false } = {}) {
    if (typeof value !== "string") {
      issue(issues, path, "Use a valid URL.");
      return false;
    }
    totalText += value.length;
    if (value.length > SITE_BUILDER_LIMITS.url) {
      issue(issues, path, `URLs support up to ${SITE_BUILDER_LIMITS.url.toLocaleString("en-US")} characters.`);
      return false;
    }
    if (!value.trim()) {
      if (required) issue(issues, path, "Add a secure destination.");
      return !required;
    }
    if (!safeUrl(value, options)) {
      issue(issues, path, "Use an allowed destination. Scripts, embedded data, credentials, and unsafe protocols are blocked.");
      return false;
    }
    return true;
  }

  function validateAction(action, path) {
    if (!isRecord(action)) {
      issue(issues, path, "Action settings must be an object.");
      return;
    }
    const labelOk = validateText(action.label, `${path}.label`, 80);
    const urlOk = validateUrl(action.url, `${path}.url`);
    if (labelOk && action.label.trim() && !action.url.trim()) {
      issue(issues, `${path}.url`, "Add a safe destination for this action.");
    }
    if (urlOk && action.url.trim() && !action.label.trim()) {
      issue(issues, `${path}.label`, "Add a label for this action.");
    }
  }

  function validateImage(image, path, { required = false } = {}) {
    if (!isRecord(image)) {
      issue(issues, path, "Image settings must be an object.");
      return;
    }
    const sourceOk = validateUrl(image.src, `${path}.src`, { image: true }, { required });
    const altOk = validateText(image.alt, `${path}.alt`, SITE_BUILDER_LIMITS.shortText, { required });
    if (sourceOk && altOk && Boolean(image.src.trim()) !== Boolean(image.alt.trim())) {
      issue(issues, path, "Provide both an image source and alternative text.");
    }
  }

  if (!isRecord(project)) {
    return Object.freeze({ valid: false, issues: Object.freeze([{ path: "project", message: "A site project is required." }]) });
  }
  if (project.schemaVersion !== SITE_BUILDER_SCHEMA_VERSION) issue(issues, "schemaVersion", "The site schema version is unsupported.");
  if (typeof project.id !== "string" || !ID_PATTERN.test(project.id)) issue(issues, "id", "Project id must be lowercase kebab-case.");
  validateText(project.name, "name", SITE_BUILDER_LIMITS.projectName, { required: true });
  if (!SITE_MODES.includes(project.mode)) issue(issues, "mode", "Choose a supported site mode.");
  if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(project.language ?? "")) issue(issues, "language", "Enter a valid language tag.");
  validateText(project.siteName, "siteName", 100, { required: true });
  if (!isRecord(project.theme)) {
    issue(issues, "theme", "Theme settings are required.");
  } else {
    for (const color of ["primaryColor", "accentColor", "backgroundColor", "surfaceColor", "textColor", "mutedColor"]) {
      if (typeof project.theme[color] !== "string" || !COLOR_PATTERN.test(project.theme[color])) {
        issue(issues, `theme.${color}`, "Use a six-digit hexadecimal color.");
      }
    }
    if (!FONT_FAMILIES.includes(project.theme.fontFamily)) issue(issues, "theme.fontFamily", "Choose a supported font family.");
    if (!["0px", "6px", "12px", "20px"].includes(project.theme.radius)) issue(issues, "theme.radius", "Choose a supported corner radius.");
    const colorsAreValid = ["primaryColor", "accentColor", "backgroundColor", "surfaceColor", "textColor", "mutedColor"]
      .every((color) => COLOR_PATTERN.test(project.theme[color] ?? ""));
    if (colorsAreValid) {
      for (const [foreground, background, path] of [
        [project.theme.textColor, project.theme.backgroundColor, "theme.textColor"],
        [project.theme.textColor, project.theme.surfaceColor, "theme.surfaceColor"],
        [project.theme.mutedColor, project.theme.backgroundColor, "theme.mutedColor"],
        [project.theme.accentColor, project.theme.backgroundColor, "theme.accentColor"],
        [project.theme.primaryColor, "#ffffff", "theme.primaryColor"],
      ]) {
        if (contrastRatio(foreground, background) < 4.5) {
          issue(issues, path, "Choose colors with at least 4.5:1 contrast for readable text.");
        }
      }
    }
  }
  if (!Array.isArray(project.pages) || project.pages.length === 0) {
    issue(issues, "pages", "Add at least one page.");
    return Object.freeze({ valid: false, issues: Object.freeze(issues) });
  }
  if (project.pages.length > SITE_BUILDER_LIMITS.pages) issue(issues, "pages", `Sites support up to ${SITE_BUILDER_LIMITS.pages} pages.`);
  const pageIds = new Set();
  const slugs = new Set();
  let homeCount = 0;
  project.pages.slice(0, SITE_BUILDER_LIMITS.pages).forEach((page, pageIndex) => {
    const path = `pages.${pageIndex}`;
    if (!isRecord(page)) {
      issue(issues, path, "Each page must be an object.");
      return;
    }
    if (typeof page.id !== "string" || !ID_PATTERN.test(page.id)) issue(issues, `${path}.id`, "Page id must be lowercase kebab-case.");
    else if (pageIds.has(page.id)) issue(issues, `${path}.id`, "Page ids must be unique.");
    pageIds.add(page.id);
    validateText(page.name, `${path}.name`, 100, { required: true });
    if (typeof page.slug !== "string" || page.slug.length > SITE_BUILDER_LIMITS.slug || !SLUG_PATTERN.test(page.slug)) issue(issues, `${path}.slug`, "Use a valid page path.");
    else if (slugs.has(page.slug)) issue(issues, `${path}.slug`, "Page paths must be unique.");
    slugs.add(page.slug);
    if (page.slug === "/") homeCount += 1;
    if (typeof page.showInNavigation !== "boolean") issue(issues, `${path}.showInNavigation`, "Choose whether this page appears in navigation.");
    if (!isRecord(page.seo)) {
      issue(issues, `${path}.seo`, "SEO settings must be an object.");
    } else {
      validateText(page.seo.title, `${path}.seo.title`, 70);
      validateText(page.seo.description, `${path}.seo.description`, 160);
    }
    if (!Array.isArray(page.sections)) {
      issue(issues, `${path}.sections`, "Page sections must be a list.");
      return;
    }
    if (forExport && page.sections.filter((section) => !section.hidden).length === 0) {
      issue(issues, `${path}.sections`, "Add at least one visible section before export.");
    }
    if (page.sections.length > SITE_BUILDER_LIMITS.sectionsPerPage) issue(issues, `${path}.sections`, "This page has too many sections.");
    totalSections += page.sections.length;
    const sectionIds = new Set();
    page.sections.slice(0, SITE_BUILDER_LIMITS.sectionsPerPage).forEach((section, sectionIndex) => {
      const sectionPath = `${path}.sections.${sectionIndex}`;
      if (!isRecord(section)) {
        issue(issues, sectionPath, "Each section must be an object.");
        return;
      }
      if (typeof section.id !== "string" || !ID_PATTERN.test(section.id)) issue(issues, `${sectionPath}.id`, "Section id must be lowercase kebab-case.");
      else if (sectionIds.has(section.id)) issue(issues, `${sectionPath}.id`, "Section ids must be unique within a page.");
      sectionIds.add(section.id);
      if (!SECTION_TYPES.includes(section.type)) issue(issues, `${sectionPath}.type`, "Choose a supported section type.");
      if (typeof section.hidden !== "boolean") issue(issues, `${sectionPath}.hidden`, "Choose whether this section is hidden.");
      if (!isRecord(section.content)) {
        issue(issues, `${sectionPath}.content`, "Section content is required.");
        return;
      }
      validateText(section.content.heading, `${sectionPath}.content.heading`, SITE_BUILDER_LIMITS.shortText, { required: !section.hidden });
      validateText(section.content.body, `${sectionPath}.content.body`, SITE_BUILDER_LIMITS.text);

      if (section.type === "hero") {
        validateText(section.content.eyebrow, `${sectionPath}.content.eyebrow`, 80);
        validateAction(section.content.primaryAction, `${sectionPath}.content.primaryAction`);
        validateAction(section.content.secondaryAction, `${sectionPath}.content.secondaryAction`);
        validateImage(section.content.image, `${sectionPath}.content.image`);
      } else if (["content", "call-to-action"].includes(section.type)) {
        validateAction(section.content.action, `${sectionPath}.content.action`);
      } else if (["features", "faq"].includes(section.type)) {
        if (!Array.isArray(section.content.items)) {
          issue(issues, `${sectionPath}.content.items`, "Section items must be a list.");
        } else {
          if (section.content.items.length === 0) issue(issues, `${sectionPath}.content.items`, `Add at least one ${section.type === "faq" ? "question" : "feature"}.`);
          if (section.content.items.length > SITE_BUILDER_LIMITS.itemsPerSection) issue(issues, `${sectionPath}.content.items`, "This section has too many items.");
          const itemIds = new Set();
          section.content.items.slice(0, SITE_BUILDER_LIMITS.itemsPerSection).forEach((item, itemIndex) => {
            const itemPath = `${sectionPath}.content.items.${itemIndex}`;
            if (!isRecord(item)) {
              issue(issues, itemPath, "Each item must be an object.");
              return;
            }
            if (typeof item.id !== "string" || !ID_PATTERN.test(item.id)) issue(issues, `${itemPath}.id`, "Item id must be lowercase kebab-case.");
            else if (itemIds.has(item.id)) issue(issues, `${itemPath}.id`, "Item ids must be unique within a section.");
            itemIds.add(item.id);
            validateText(item.title, `${itemPath}.title`, SITE_BUILDER_LIMITS.shortText, { required: true });
            validateText(item.body, `${itemPath}.body`, SITE_BUILDER_LIMITS.text);
          });
        }
      } else if (section.type === "image-text") {
        validateImage(section.content.image, `${sectionPath}.content.image`, { required: true });
        if (!["left", "right"].includes(section.content.imagePosition)) issue(issues, `${sectionPath}.content.imagePosition`, "Choose a supported image position.");
        validateAction(section.content.action, `${sectionPath}.content.action`);
      } else if (section.type === "form") {
        validateUrl(section.content.actionUrl, `${sectionPath}.content.actionUrl`, { formAction: true }, { required: forExport });
        validateText(section.content.submitLabel, `${sectionPath}.content.submitLabel`, 80, { required: true });
        validateText(section.content.successMessage, `${sectionPath}.content.successMessage`, 240);
        if (!Array.isArray(section.content.fields)) {
          issue(issues, `${sectionPath}.content.fields`, "Form fields must be a list.");
          return;
        }
        if (section.content.fields.length === 0) issue(issues, `${sectionPath}.content.fields`, "Add at least one form field.");
        if (section.content.fields.length > SITE_BUILDER_LIMITS.fieldsPerForm) issue(issues, `${sectionPath}.content.fields`, "This form has too many fields.");
        totalFields += section.content.fields.length;
        const fieldNames = new Set();
        const fieldIds = new Set();
        section.content.fields.slice(0, SITE_BUILDER_LIMITS.fieldsPerForm).forEach((field, fieldIndex) => {
          const fieldPath = `${sectionPath}.content.fields.${fieldIndex}`;
          if (!isRecord(field)) {
            issue(issues, fieldPath, "Each field must be an object.");
            return;
          }
          if (typeof field.id !== "string" || !ID_PATTERN.test(field.id)) issue(issues, `${fieldPath}.id`, "Field id must be lowercase kebab-case.");
          else if (fieldIds.has(field.id)) issue(issues, `${fieldPath}.id`, "Field ids must be unique within a form.");
          fieldIds.add(field.id);
          if (!FORM_FIELD_TYPES.includes(field.type)) issue(issues, `${fieldPath}.type`, "Choose a supported form field type.");
          if (typeof field.name !== "string" || !FIELD_NAME_PATTERN.test(field.name)) issue(issues, `${fieldPath}.name`, "Field names must use lowercase letters, numbers, and underscores.");
          if (fieldNames.has(field.name)) issue(issues, `${fieldPath}.name`, "Field names must be unique within a form.");
          fieldNames.add(field.name);
          validateText(field.label, `${fieldPath}.label`, SITE_BUILDER_LIMITS.shortText, { required: true });
          validateText(field.placeholder, `${fieldPath}.placeholder`, SITE_BUILDER_LIMITS.shortText);
          if (typeof field.required !== "boolean") issue(issues, `${fieldPath}.required`, "Choose whether this field is required.");
          if (!Array.isArray(field.options)) {
            issue(issues, `${fieldPath}.options`, "Field choices must be a list.");
          } else {
            if (field.options.length > SITE_BUILDER_LIMITS.itemsPerSection) issue(issues, `${fieldPath}.options`, "This field has too many choices.");
            if (["select", "radio", "checkbox"].includes(field.type) && field.options.length === 0) {
              issue(issues, `${fieldPath}.options`, "Add at least one choice.");
            }
            field.options.slice(0, SITE_BUILDER_LIMITS.itemsPerSection).forEach((option, optionIndex) => {
              validateText(option, `${fieldPath}.options.${optionIndex}`, 100, { required: true });
            });
          }
        });
      }
    });
  });
  if (homeCount !== 1) issue(issues, "pages", "Exactly one page must use the home path (/)." );
  if (totalSections > SITE_BUILDER_LIMITS.totalSections) issue(issues, "pages", `A project can contain at most ${SITE_BUILDER_LIMITS.totalSections} sections.`);
  if (totalFields > SITE_BUILDER_LIMITS.totalFields) issue(issues, "pages", `A project can contain at most ${SITE_BUILDER_LIMITS.totalFields} form fields.`);
  if (totalText > SITE_BUILDER_LIMITS.totalText) issue(issues, "project", `Project text exceeds the ${SITE_BUILDER_LIMITS.totalText.toLocaleString("en-US")}-character limit.`);
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

// # Static site export

function renderAction(action, variant = "primary") {
  const label = cleanShortText(action?.label, 80);
  const url = safeUrl(action?.url);
  if (!label || !url) return "";
  const external = /^https?:\/\//i.test(url);
  return `<a class="button button--${variant}" href="${escapeHtml(url)}"${external ? ' rel="noopener noreferrer"' : ""}>${escapeHtml(label)}</a>`;
}

function renderField(field) {
  const required = field.required ? " required" : "";
  const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
  const type = FORM_FIELD_TYPES.includes(field.type) ? field.type : "text";
  if (type === "textarea") {
    return `<label>${escapeHtml(field.label)}<textarea name="${escapeHtml(field.name)}"${placeholder}${required}></textarea></label>`;
  }
  if (type === "select") {
    const options = field.options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("");
    return `<label>${escapeHtml(field.label)}<select name="${escapeHtml(field.name)}"${required}><option value="">Choose one</option>${options}</select></label>`;
  }
  if (["radio", "checkbox"].includes(type)) {
    const inputs = field.options.map((option, index) => {
      const id = `${field.id}-${index + 1}`;
      return `<label class="choice" for="${escapeHtml(id)}"><input id="${escapeHtml(id)}" type="${type}" name="${escapeHtml(field.name)}" value="${escapeHtml(option)}"${required}> ${escapeHtml(option)}</label>`;
    }).join("");
    return `<fieldset><legend>${escapeHtml(field.label)}</legend>${inputs}</fieldset>`;
  }
  return `<label>${escapeHtml(field.label)}<input type="${type}" name="${escapeHtml(field.name)}"${placeholder}${required}></label>`;
}

function renderSection(section, headingLevel) {
  if (section.hidden) return "";
  const content = section.content;
  const heading = `<h${headingLevel}>${escapeHtml(cleanShortText(content.heading))}</h${headingLevel}>`;
  const sectionId = escapeHtml(section.id);
  switch (section.type) {
    case "hero": {
      const imageSource = safeUrl(content.image.src, { image: true });
      const image = imageSource
        ? `<img src="${escapeHtml(imageSource)}" alt="${escapeHtml(content.image.alt)}">`
        : "";
      return `<section class="section hero" id="${sectionId}"><div>${content.eyebrow ? `<p class="eyebrow">${escapeHtml(content.eyebrow)}</p>` : ""}${heading}${paragraphs(content.body)}<div class="actions">${renderAction(content.primaryAction)}${renderAction(content.secondaryAction, "secondary")}</div></div>${image}</section>`;
    }
    case "features":
      return `<section class="section" id="${sectionId}">${heading}${paragraphs(content.body)}<div class="grid">${content.items.map((item) => `<article><h3>${escapeHtml(item.title)}</h3>${paragraphs(item.body)}</article>`).join("")}</div></section>`;
    case "faq":
      return `<section class="section" id="${sectionId}">${heading}${paragraphs(content.body)}<div class="faq">${content.items.map((item) => `<details><summary>${escapeHtml(item.title)}</summary>${paragraphs(item.body)}</details>`).join("")}</div></section>`;
    case "image-text":
      return `<section class="section split split--${content.imagePosition}" id="${sectionId}"><div>${heading}${paragraphs(content.body)}${renderAction(content.action)}</div><img src="${escapeHtml(safeUrl(content.image.src, { image: true }))}" alt="${escapeHtml(content.image.alt)}"></section>`;
    case "call-to-action":
      return `<section class="section cta" id="${sectionId}">${heading}${paragraphs(content.body)}${renderAction(content.action)}</section>`;
    case "form":
      return `<section class="section form-section" id="${sectionId}">${heading}${paragraphs(content.body)}<form action="${escapeHtml(safeUrl(content.actionUrl, { formAction: true }))}" method="post">${content.fields.map(renderField).join("")}<button class="button button--primary" type="submit">${escapeHtml(content.submitLabel)}</button></form></section>`;
    default:
      return `<section class="section" id="${sectionId}">${heading}${paragraphs(content.body)}${renderAction(content.action)}</section>`;
  }
}

function renderPage(project, page, { inlineStyles = false } = {}) {
  const title = page.seo.title || `${page.name} | ${project.siteName}`;
  const description = page.seo.description || `Learn more about ${project.siteName}.`;
  const navigation = project.pages.filter((item) => item.showInNavigation).map((item) =>
    `<a${item.id === page.id ? ' aria-current="page"' : ""} href="${item.slug}">${escapeHtml(item.name)}</a>`).join("");
  const sections = page.sections.filter((section) => !section.hidden);
  const body = sections.map((section, index) => renderSection(section, index === 0 ? 1 : 2)).join("\n");
  const styles = inlineStyles
    ? `<style>${renderStyles(project.theme)}</style>`
    : `<link rel="stylesheet" href="${page.slug === "/" ? "" : "../".repeat(page.slug.split("/").filter(Boolean).length)}styles.css">`;
  return `<!doctype html>
<html lang="${escapeHtml(project.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' https:; style-src 'self' 'unsafe-inline'; form-action 'self' https:; base-uri 'none'; frame-ancestors 'none'">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${styles}
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><a class="brand" href="/">${escapeHtml(project.siteName)}</a><nav aria-label="Primary">${navigation}</nav></header>
  <main id="main">${body}</main>
  <footer><p>&copy; ${escapeHtml(project.siteName)}</p></footer>
</body>
</html>`;
}

function renderStyles(theme) {
  return `:root{--primary:${theme.primaryColor};--accent:${theme.accentColor};--background:${theme.backgroundColor};--surface:${theme.surfaceColor};--text:${theme.textColor};--muted:${theme.mutedColor};--radius:${theme.radius};font-family:${FONT_STACKS[theme.fontFamily]};color:var(--text);background:var(--background);line-height:1.6}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--text)}a{color:var(--primary)}img{display:block;max-width:100%;height:auto;border-radius:var(--radius)}.skip-link{position:absolute;left:-999px;top:1rem}.skip-link:focus{left:1rem;background:var(--background);padding:.75rem;z-index:10}.site-header{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;padding:1rem clamp(1rem,4vw,4rem);border-bottom:1px solid color-mix(in srgb,var(--text) 15%,transparent)}.brand{font-weight:800;text-decoration:none;color:var(--text)}nav{display:flex;gap:1rem;flex-wrap:wrap}nav a{text-decoration:none}.section,footer{width:min(1120px,calc(100% - 2rem));margin-inline:auto;padding:clamp(3rem,8vw,7rem) 0}.hero,.split{display:grid;grid-template-columns:1.1fr .9fr;align-items:center;gap:clamp(2rem,6vw,5rem)}.split--right>div{order:2}.eyebrow{color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.08em}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.grid article,.faq details,.form-section form{padding:1.25rem;background:var(--surface);border-radius:var(--radius)}.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}.button{display:inline-flex;justify-content:center;border:0;border-radius:var(--radius);padding:.8rem 1.1rem;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}.button--primary{background:var(--primary);color:#fff}.button--secondary{border:1px solid var(--primary);color:var(--primary)}.cta{text-align:center;background:var(--surface);border-radius:var(--radius);padding-inline:clamp(1rem,5vw,4rem)}form{display:grid;gap:1rem}label,fieldset{display:grid;gap:.35rem;border:0;margin:0;padding:0}input,textarea,select{width:100%;border:1px solid color-mix(in srgb,var(--text) 25%,transparent);border-radius:calc(var(--radius) / 2);padding:.75rem;font:inherit;background:var(--background);color:var(--text)}textarea{min-height:8rem;resize:vertical}.choice{display:flex;align-items:center}.choice input{width:auto}.faq{display:grid;gap:.75rem}.faq summary{cursor:pointer;font-weight:700}footer{color:var(--muted);border-top:1px solid color-mix(in srgb,var(--text) 15%,transparent)}@media(max-width:760px){.site-header{align-items:flex-start;flex-direction:column}.hero,.split{grid-template-columns:1fr}.split--right>div{order:0}.grid{grid-template-columns:1fr}.section,footer{width:min(100% - 1.25rem,1120px)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`;
}

function outputPath(slug) {
  return slug === "/" ? "index.html" : `${slug.slice(1)}/index.html`;
}

function utf8Bytes(value) {
  return new TextEncoder().encode(value).byteLength;
}

function prepareExportProject(project) {
  const validation = validateSiteProject(project, { forExport: true });
  if (!validation.valid) {
    throw new SiteBuilderError("Resolve site validation issues before export.", validation.issues);
  }
  const normalized = normalizeSiteProject(project);
  const normalizedValidation = validateSiteProject(normalized, { forExport: true });
  if (!normalizedValidation.valid) {
    throw new SiteBuilderError("The normalized site project is not exportable.", normalizedValidation.issues);
  }
  return normalized;
}

function enforceExportLimit(files) {
  const totalBytes = files.reduce((total, file) => total + utf8Bytes(file.content), 0);
  if (totalBytes > SITE_BUILDER_LIMITS.exportBytes) {
    throw new SiteBuilderError(
      `Static export exceeds the ${SITE_BUILDER_LIMITS.exportBytes.toLocaleString("en-US")}-byte limit.`,
      [{ path: "project", message: "Reduce page content or split the project before export." }],
    );
  }
  return totalBytes;
}

export function exportPageHtml(project, pageId) {
  const normalized = prepareExportProject(project);
  const page = normalized.pages.find((candidate) => candidate.id === pageId);
  if (!page) throw new SiteBuilderError(`Page ${pageId} was not found.`);
  const html = renderPage(normalized, page, { inlineStyles: true });
  enforceExportLimit([{ content: html }]);
  return html;
}

export function exportSiteProject(project) {
  const normalized = prepareExportProject(project);
  const files = normalized.pages.map((page) => ({
    path: outputPath(page.slug),
    mimeType: "text/html;charset=utf-8",
    content: renderPage(normalized, page),
  }));
  files.push({ path: "styles.css", mimeType: "text/css;charset=utf-8", content: renderStyles(normalized.theme) });
  files.push({
    path: "toolstead-site.json",
    mimeType: "application/json;charset=utf-8",
    content: `${JSON.stringify(normalized, null, 2)}\n`,
  });
  const totalBytes = enforceExportLimit(files);
  return Object.freeze({
    schemaVersion: SITE_BUILDER_SCHEMA_VERSION,
    files: Object.freeze(files.map((file) => Object.freeze(file))),
    totalBytes,
    warnings: Object.freeze([
      "Static export does not publish, host, connect a custom domain, or store form submissions.",
      "Review legal, accessibility, analytics, privacy, and consent requirements before publishing.",
    ]),
  });
}
