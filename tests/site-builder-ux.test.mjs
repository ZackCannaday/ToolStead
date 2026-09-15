import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createSiteProject,
  exportSiteProject,
  validateSiteProject,
} from "../src/tools/site-builder/engine.js";
import { contrastRatio } from "../src/tools/accessibility-auditor/analyzer.js";

const WORKSPACE_SOURCE_URL = new URL("../src/tools/site-builder/index.jsx", import.meta.url);
const WORKSPACE_STYLES_URL = new URL("../src/tools/site-builder/styles.css", import.meta.url);

function accessibleProject() {
  return createSiteProject({
    name: "Accessible service site",
    siteName: "Example Services",
    sections: [
      {
        type: "hero",
        content: {
          eyebrow: "Local expertise",
          heading: "A clear service promise",
          body: "A concise explanation of the customer outcome.",
          primaryAction: { label: "Request service", url: "#request" },
        },
      },
      {
        type: "form",
        content: {
          heading: "Request service",
          body: "Tell us how we can help.",
          actionUrl: "https://example.test/requests",
          submitLabel: "Send request",
          fields: [
            { type: "text", name: "name", label: "Name", required: true },
            { type: "email", name: "email", label: "Email", required: true },
            {
              type: "radio",
              name: "urgency",
              label: "Urgency",
              options: ["Routine", "Urgent"],
            },
          ],
        },
      },
    ],
  });
}

test("exported pages preserve accessible document landmarks and heading order", () => {
  const result = exportSiteProject(accessibleProject());
  const html = result.files.find((file) => file.path === "index.html")?.content || "";

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<a class="skip-link" href="#main">Skip to content<\/a>/);
  assert.match(html, /<nav aria-label="Primary">/);
  assert.match(html, /<main id="main">/);
  assert.equal((html.match(/<h1>/g) || []).length, 1, "the exported home page needs one h1");
  assert.match(html, /<h2>Request service<\/h2>/);
});

test("exported lead forms retain labels, required state, and grouped choices", () => {
  const result = exportSiteProject(accessibleProject());
  const html = result.files.find((file) => file.path === "index.html")?.content || "";

  assert.match(html, /<label>Name<input type="text" name="name" required><\/label>/);
  assert.match(html, /<label>Email<input type="email" name="email" required><\/label>/);
  assert.match(html, /<fieldset><legend>Urgency<\/legend>/);
  assert.match(html, /<button class="button button--primary" type="submit">Send request<\/button>/);
});

test("the default exported color tokens keep normal text above AA contrast", () => {
  const project = accessibleProject();

  assert.ok(contrastRatio(project.theme.textColor, project.theme.backgroundColor) >= 4.5);
  assert.ok(contrastRatio(project.theme.mutedColor, project.theme.backgroundColor) >= 4.5);
  assert.ok(
    contrastRatio(project.theme.accentColor, project.theme.backgroundColor) >= 4.5,
    "accent-colored eyebrow text must meet WCAG 1.4.3",
  );
  assert.equal(validateSiteProject(project, { forExport: true }).valid, true);
});

test("builder exposes announced feedback and responsive keyboard-visible controls", async () => {
  const [source, styles] = await Promise.all([
    readFile(WORKSPACE_SOURCE_URL, "utf8"),
    readFile(WORKSPACE_STYLES_URL, "utf8"),
  ]);

  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role=(?:"alert"|\{[^}]*"alert"[^}]*\})/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(
    source,
    /<main className="sb-/,
    "the tool is already hosted inside the application main landmark",
  );
  assert.doesNotMatch(
    source,
    /<button[^>]*tabIndex="-1"/,
    "preview-only actions must not be exposed as nonfunctional buttons",
  );
  assert.match(styles, /@media\s*\(max-width:/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
});
