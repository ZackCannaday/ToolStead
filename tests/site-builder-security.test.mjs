import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  SITE_BUILDER_LIMITS,
  SiteBuilderError,
  addSection,
  createSiteProject,
  exportSiteProject,
  normalizeSection,
  safeUrl,
} from "../src/tools/site-builder/engine.js";

const WORKSPACE_SOURCE_URL = new URL("../src/tools/site-builder/index.jsx", import.meta.url);

function exportableProject(input = {}) {
  return createSiteProject({
    name: "Security test site",
    siteName: "Security test site",
    sections: [
      {
        id: "content-1",
        type: "content",
        content: {
          heading: "Safe heading",
          body: "Safe body",
        },
      },
    ],
    ...input,
  });
}

test("URL policy rejects executable, opaque, protocol-relative, and obfuscated schemes", () => {
  const hostileUrls = [
    "javascript:alert(1)",
    "java\nscript:alert(1)",
    "jav%61script:alert(1)",
    "javascript&#58;alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "file:///etc/passwd",
    "blob:https://example.com/attacker-controlled",
    "//evil.example/collect",
  ];

  for (const value of hostileUrls) {
    assert.equal(safeUrl(value), "", `ordinary URL must reject ${value}`);
    assert.equal(safeUrl(value, { image: true }), "", `image URL must reject ${value}`);
    assert.equal(safeUrl(value, { formAction: true }), "", `form URL must reject ${value}`);
  }
});

test("URL policy only grants each destination its intended safe schemes", () => {
  assert.equal(safeUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(safeUrl("http://example.com/path"), "http://example.com/path");
  assert.equal(safeUrl("mailto:owner@example.com"), "mailto:owner@example.com");
  assert.equal(safeUrl("tel:+15555550123"), "tel:+15555550123");
  assert.equal(safeUrl("/services?plan=pro#quote"), "/services?plan=pro#quote");
  assert.equal(safeUrl("#contact"), "#contact");

  assert.equal(safeUrl("https://cdn.example.com/photo.jpg", { image: true }), "https://cdn.example.com/photo.jpg");
  assert.equal(safeUrl("http://cdn.example.com/photo.jpg", { image: true }), "");
  assert.equal(safeUrl("mailto:owner@example.com", { image: true }), "");
  assert.equal(safeUrl("https://forms.example.com/submit", { formAction: true }), "https://forms.example.com/submit");
  assert.equal(safeUrl("http://forms.example.com/submit", { formAction: true }), "");
  assert.equal(safeUrl("/api/forms", { formAction: true }), "/api/forms");
});

test("export encodes scripts, event handlers, SVG, MathML, and closing-tag payloads as text", () => {
  const payload = [
    '<script src="https://evil.example/x.js"></script>',
    '<img src=x onerror="alert(1)">',
    '<svg><animate onbegin="alert(1)" attributeName="x"></animate></svg>',
    '<math><mtext></style><img src=x onerror=alert(1)></mtext></math>',
    '</title></head><body onload="alert(1)">',
  ].join(" ");
  const project = exportableProject({
    siteName: payload,
    sections: [
      {
        id: "content-1",
        type: "content",
        content: { heading: payload, body: payload, action: { label: payload, url: "#contact" } },
      },
    ],
  });

  const output = exportSiteProject(project);
  const html = output.files.find((file) => file.path === "index.html")?.content ?? "";

  assert.doesNotMatch(html, /<script\b/i);
  assert.doesNotMatch(html, /<svg\b/i);
  assert.doesNotMatch(html, /<math\b/i);
  assert.doesNotMatch(html, /<img\s+src=x/i);
  assert.doesNotMatch(html, /<body\s+onload/i);
  assert.match(html, /&lt;script/);
  assert.match(html, /&lt;svg/);
  assert.match(html, /&lt;math/);
  assert.match(html, /&lt;\/title&gt;/);
});

test("section normalization removes active image and form destinations", () => {
  const hero = normalizeSection({
    type: "hero",
    content: {
      heading: "Heading",
      image: { src: "data:image/svg+xml,<svg onload=alert(1)>", alt: "Image" },
      primaryAction: { label: "Run", url: "javascript:alert(1)" },
    },
  });
  const form = normalizeSection({
    type: "form",
    content: {
      heading: "Contact",
      actionUrl: "http://evil.example/collect",
      fields: [{ type: "email", name: "email", label: "Email" }],
    },
  });

  assert.equal(hero.content.image.src, "");
  assert.equal(hero.content.primaryAction.url, "");
  assert.equal(form.content.actionUrl, "");
});

test("theme values cannot inject CSS imports, URLs, expressions, or bindings", () => {
  const project = exportableProject({
    theme: {
      primaryColor: "#fff;@import url(https://evil.example/x.css)",
      accentColor: "expression(alert(1))",
      backgroundColor: "url(https://evil.example/collect)",
      textColor: "-moz-binding:url(https://evil.example/xbl)",
      fontFamily: "</style><script>alert(1)</script>",
      radius: "1px;behavior:url(xss.htc)",
    },
  });
  const css = exportSiteProject(project).files.find((file) => file.path === "styles.css")?.content ?? "";

  assert.doesNotMatch(css, /@import/i);
  assert.doesNotMatch(css, /expression\s*\(/i);
  assert.doesNotMatch(css, /-moz-binding/i);
  assert.doesNotMatch(css, /(?:^|[;{])\s*behavior\s*:/i);
  assert.doesNotMatch(css, /evil\.example/i);
  assert.doesNotMatch(css, /<script/i);
});

test("tampered projects fail closed before unsafe CSS can be rendered", () => {
  const project = exportableProject();
  project.theme.primaryColor = "#fff; background:url(https://evil.example/collect)";

  assert.throws(
    () => exportSiteProject(project),
    (error) => error instanceof SiteBuilderError
      && error.issues.some((item) => item.path === "theme.primaryColor"),
  );
});

test("normalization enforces content and collection size limits before export", () => {
  const oversized = "x".repeat(SITE_BUILDER_LIMITS.text + 1_000);
  let project = exportableProject({
    sections: Array.from(
      { length: SITE_BUILDER_LIMITS.sectionsPerPage + 20 },
      (_, index) => ({
        id: `section-${index + 1}`,
        type: "content",
        content: { heading: `Heading ${index + 1}`, body: oversized },
      }),
    ),
  });

  assert.equal(project.pages[0].sections.length, SITE_BUILDER_LIMITS.sectionsPerPage);
  assert.equal(project.pages[0].sections[0].content.body.length, SITE_BUILDER_LIMITS.text);
  assert.throws(
    () => addSection(project, project.pages[0].id, { type: "content", content: { heading: "Overflow" } }),
    (error) => error instanceof SiteBuilderError,
  );
});

test("preview does not execute generated markup or grant unsafe iframe capabilities", async () => {
  const source = await readFile(WORKSPACE_SOURCE_URL, "utf8");

  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(source, /\b(?:eval|Function)\s*\(/);
  assert.doesNotMatch(source, /document\.write\s*\(/);

  const iframeTags = source.match(/<iframe\b[^>]*>/gi) ?? [];
  for (const tag of iframeTags) {
    assert.match(tag, /\bsandbox(?:\s*=|\s|>)/i, "every generated-content iframe must be sandboxed");
    assert.doesNotMatch(
      tag,
      /allow-(?:scripts|same-origin|forms|popups|top-navigation)/i,
      "preview frames must not receive active-content or navigation capabilities",
    );
  }
});

test("download path uses a UTF-8 Blob, revokes object URLs, and never auto-opens output", async () => {
  const source = await readFile(WORKSPACE_SOURCE_URL, "utf8");
  const downloadHelper = source.match(/function downloadFile\(file\)\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.ok(downloadHelper, "download helper must remain inspectable");
  assert.match(downloadHelper, /new Blob\(/);
  assert.match(downloadHelper, /charset=utf-8/i, "text downloads must declare UTF-8");
  assert.doesNotMatch(
    downloadHelper,
    /new Blob\(\[file\.content\],\s*\{\s*type:\s*file\.mimeType\b/,
    "the Blob must not bypass the UTF-8 MIME type when file.mimeType is present",
  );
  assert.match(downloadHelper, /URL\.revokeObjectURL\(url\)/);
  assert.doesNotMatch(downloadHelper, /window\.open|location\s*=|location\.(?:assign|replace)/);
});

test("public preview remains local-only and does not persist or transmit project content", async () => {
  const source = await readFile(WORKSPACE_SOURCE_URL, "utf8");

  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
});
