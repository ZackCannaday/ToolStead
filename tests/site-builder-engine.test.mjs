import assert from "node:assert/strict";
import test from "node:test";

import {
  SITE_BUILDER_LIMITS,
  SiteBuilderError,
  addPage,
  addSection,
  createSiteProject,
  exportPageHtml,
  exportSiteProject,
  normalizeSiteProject,
  safeUrl,
  updatePage,
  validateSiteProject,
} from "../src/tools/site-builder/engine.js";

function exportableProject() {
  return createSiteProject({
    id: "secure-site",
    name: "Example Services",
    siteName: "Example Services",
    sections: [{
      id: "hero-1",
      type: "hero",
      content: {
        eyebrow: "Local expertise",
        heading: "A safer way to get the job done",
        body: "Clear scope and dependable service.",
        primaryAction: { label: "Request a quote", url: "#contact" },
        secondaryAction: { label: "", url: "" },
        image: { src: "", alt: "" },
      },
    }],
  });
}

test("creates a canonical bounded model and resolves duplicate supplied identifiers", () => {
  const normalized = normalizeSiteProject({
    id: "site-ok",
    name: " Test site ",
    siteName: "Test site",
    mode: "website",
    language: "en",
    pages: [
      { id: "page-1", name: "Home", slug: "/", showInNavigation: true, seo: {}, sections: [] },
      { id: "page-1", name: "Home", slug: "/", showInNavigation: true, seo: {}, sections: [] },
    ],
  });

  assert.equal(normalized.name, "Test site");
  assert.deepEqual(normalized.pages.map((page) => page.id), ["page-1", "page-2"]);
  assert.deepEqual(normalized.pages.map((page) => page.slug), ["/", "/home-2"]);
  assert.equal(Object.hasOwn(normalized, "customHtml"), false);
});

test("page operations are immutable and keep unique normalized paths", () => {
  const original = exportableProject();
  const added = addPage(original, { name: "Our Work", slug: "/our-work" });
  const duplicated = addPage(added, { name: "Our Work", slug: "/our-work" });
  const renamed = updatePage(duplicated, duplicated.pages[2].id, { slug: "/our-work" });

  assert.equal(original.pages.length, 1);
  assert.deepEqual(renamed.pages.map((page) => page.slug), ["/", "/our-work", "/our-work-2"]);
  assert.notEqual(renamed, original);
});

test("URL policy blocks active content, embedded data, credentials, and protocol-relative URLs", () => {
  for (const unsafe of [
    "javascript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "blob:https://example.test/id",
    "file:///etc/passwd",
    "//evil.example/path",
    "https://user:password@example.test/private",
  ]) {
    assert.equal(safeUrl(unsafe), "", unsafe);
  }
  assert.equal(safeUrl("https://example.test/path"), "https://example.test/path");
  assert.equal(safeUrl("mailto:hello@example.test"), "mailto:hello@example.test");
  assert.equal(safeUrl("http://example.test/image.png", { image: true }), "");
  assert.equal(safeUrl("https://example.test/submit", { formAction: true }), "https://example.test/submit");
});

test("validation returns addressable issues for malformed and unsafe records without throwing", () => {
  const malformed = structuredClone(exportableProject());
  malformed.pages[0].sections.push(null);
  assert.doesNotThrow(() => validateSiteProject(malformed));
  assert.equal(validateSiteProject(malformed).valid, false);

  const unsafe = structuredClone(exportableProject());
  unsafe.pages[0].sections[0].content.primaryAction.url = "javascript:alert(1)";
  const result = validateSiteProject(unsafe, { forExport: true });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((item) => item.path.endsWith("primaryAction.url")));
  assert.throws(() => exportSiteProject(unsafe), SiteBuilderError);
});

test("form export requires a secure endpoint and rejects injected field types", () => {
  let project = exportableProject();
  project = addSection(project, project.pages[0].id, {
    id: "contact",
    type: "form",
    content: {
      heading: "Contact us",
      body: "Tell us what you need.",
      actionUrl: "",
      submitLabel: "Send",
      successMessage: "Thanks",
      fields: [{ id: "email", type: "email", name: "email", label: "Email", placeholder: "you@example.test", required: true, options: [] }],
    },
  });
  assert.equal(validateSiteProject(project).valid, true);
  assert.equal(validateSiteProject(project, { forExport: true }).valid, false);

  project.pages[0].sections[1].content.actionUrl = "https://forms.example.test/submit";
  project.pages[0].sections[1].content.fields[0].type = 'text" autofocus onfocus="alert(1)';
  assert.ok(validateSiteProject(project, { forExport: true }).issues.some((item) => item.path.endsWith("fields.0.type")));
});

test("theme validation enforces readable contrast and the default theme passes", () => {
  assert.equal(validateSiteProject(exportableProject()).valid, true);
  const unreadable = structuredClone(exportableProject());
  unreadable.theme.textColor = "#ffffff";
  unreadable.theme.mutedColor = "#eeeeee";
  unreadable.theme.accentColor = "#14b8a6";
  unreadable.theme.primaryColor = "#ffffff";
  const paths = validateSiteProject(unreadable).issues.map((item) => item.path);
  assert.ok(paths.includes("theme.textColor"));
  assert.ok(paths.includes("theme.mutedColor"));
  assert.ok(paths.includes("theme.accentColor"));
  assert.ok(paths.includes("theme.primaryColor"));
});

test("full export is deterministic, escaped, canonical, and path-safe", () => {
  let project = exportableProject();
  project = addPage(project, { name: "Services", slug: "/company/services", sections: [{
    type: "content",
    content: { heading: "Repairs <script>alert(1)</script>", body: "Fast & careful", action: { label: "", url: "" } },
  }] });
  project.untrusted = { customHtml: "<script>alert(1)</script>", customCss: "@import url(https://evil.test)" };

  const first = exportSiteProject(project);
  const second = exportSiteProject(structuredClone(project));
  assert.deepEqual(first, second);
  assert.deepEqual(first.files.map((file) => file.path), ["index.html", "company/services/index.html", "styles.css", "toolstead-site.json"]);
  assert.ok(first.totalBytes > 0 && first.totalBytes <= SITE_BUILDER_LIMITS.exportBytes);
  assert.match(first.files[1].content, /Repairs &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(first.files[1].content, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(first.files[0].content, /20\d\d/);
  assert.equal(Object.hasOwn(JSON.parse(first.files.at(-1).content), "untrusted"), false);
  assert.ok(first.files.every((file) => /charset=utf-8/.test(file.mimeType)));
});

test("single-page export is deterministic and self-contained without executable markup", () => {
  const project = exportableProject();
  const first = exportPageHtml(project, project.pages[0].id);
  const second = exportPageHtml(structuredClone(project), project.pages[0].id);

  assert.equal(first, second);
  assert.match(first, /<style>:root/);
  assert.doesNotMatch(first, /<link rel="stylesheet"/);
  assert.doesNotMatch(first, /<script\b|<iframe\b|<object\b|<embed\b|\son\w+=/i);
  assert.throws(() => exportPageHtml(project, "missing-page"), /was not found/);
});

test("validation and export enforce collection, text, and byte limits", () => {
  const tooManyPages = structuredClone(exportableProject());
  tooManyPages.pages = Array.from({ length: SITE_BUILDER_LIMITS.pages + 1 }, (_, index) => ({
    ...structuredClone(tooManyPages.pages[0]),
    id: `page-${index + 1}`,
    slug: index === 0 ? "/" : `/page-${index + 1}`,
  }));
  assert.ok(validateSiteProject(tooManyPages).issues.some((item) => item.path === "pages"));

  const tooLong = structuredClone(exportableProject());
  tooLong.pages[0].sections[0].content.body = "x".repeat(SITE_BUILDER_LIMITS.text + 1);
  assert.ok(validateSiteProject(tooLong).issues.some((item) => item.path.endsWith("content.body")));
  assert.throws(() => exportSiteProject(tooLong), SiteBuilderError);
});
