import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeAccessibility,
  AuditInputError,
  AUDIT_VERSION,
  contrastRatio,
  MANUAL_CHECKS,
  MAX_ELEMENTS,
  MAX_FINDINGS,
  MAX_HTML_LENGTH,
  parseHtml,
} from "../src/tools/accessibility-auditor/analyzer.js";

function ruleIds(report) {
  return report.findings.map((finding) => finding.ruleId);
}

// # Input boundaries
test("empty markup returns a stable not-assessed result", () => {
  const report = analyzeAccessibility("  \n  ");

  assert.equal(report.version, AUDIT_VERSION);
  assert.equal(report.status, "empty");
  assert.equal(report.score, null);
  assert.equal(report.conformance, "NOT_ASSESSED");
  assert.deepEqual(report.findings, []);
  assert.equal(report.manualChecks, MANUAL_CHECKS);
});

test("invalid, oversized, and malformed input fail with safe error codes", () => {
  assert.throws(
    () => analyzeAccessibility(null),
    (error) => error instanceof AuditInputError && error.code === "INVALID_INPUT",
  );
  assert.throws(
    () => analyzeAccessibility("x".repeat(MAX_HTML_LENGTH + 1)),
    (error) => error instanceof AuditInputError && error.code === "INPUT_TOO_LARGE",
  );
  assert.throws(
    () => analyzeAccessibility("<main><!-- unfinished"),
    (error) => error instanceof AuditInputError && error.code === "MALFORMED_HTML",
  );
  assert.throws(
    () => analyzeAccessibility('<button aria-label="unfinished>'),
    (error) => error instanceof AuditInputError && error.code === "MALFORMED_HTML",
  );
  assert.throws(
    () => analyzeAccessibility("<i></i>".repeat(MAX_ELEMENTS + 1)),
    (error) =>
      error instanceof AuditInputError && error.code === "ELEMENT_LIMIT_EXCEEDED",
  );
});

test("parser handles quoted greater-than signs, raw script text, and source order", () => {
  const parsed = parseHtml(
    '<main><button aria-label="Next >">Go</button><script>if (a < b) c()</script></main>',
  );

  assert.deepEqual(parsed.nodes.map((node) => node.tag), ["main", "button", "script"]);
  assert.equal(parsed.nodes[1].attrs["aria-label"], "Next >");
  assert.equal(parsed.nodes[2].text, "if (a < b) c()");
});

// # Passing baseline
test("an accessible complete document passes the deterministic baseline", () => {
  const report = analyzeAccessibility(`<!doctype html>
    <html lang="en-US">
      <head>
        <title>Account settings</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body>
        <main>
          <h1>Account settings</h1>
          <img src="profile.jpg" alt="Jamie Patel">
          <form>
            <label for="email">Email address</label>
            <input id="email" type="email">
            <button type="submit"><img src="save.svg" alt="">Save changes</button>
          </form>
          <a href="/privacy" aria-label="Read the privacy policy"><span aria-hidden="true">→</span></a>
          <iframe title="Store location map"></iframe>
          <video><track kind="captions" src="captions.vtt"></video>
          <table><caption>Invoices</caption><tr><th scope="col">Date</th></tr></table>
          <p style="color: #111; background-color: #fff">Readable text</p>
        </main>
      </body>
    </html>`);

  assert.equal(report.status, "complete");
  assert.equal(report.score, 100);
  assert.equal(report.conformance, "AUTOMATED_CHECKS_PASSED");
  assert.equal(report.summary.total, 0);
  assert.ok(report.passedChecks.length >= 10);
  assert.equal(report.analyzedElements, 23);
});

test("a fragment is not penalized for page-level title, language, main, or h1", () => {
  const report = analyzeAccessibility(
    '<section aria-labelledby="card-title"><h2 id="card-title">Details</h2><button>Save</button></section>',
  );

  assert.equal(report.score, 100);
  assert.equal(report.findings.length, 0);
  assert.ok(!ruleIds(report).includes("html-lang"));
  assert.ok(!ruleIds(report).includes("document-title"));
});

test("label, labelledby, wrapped label, and decorative alt patterns pass", () => {
  const report = analyzeAccessibility(`
    <span id="search-name">Search records</span>
    <input aria-labelledby="search-name">
    <label for="phone">Phone</label><input id="phone">
    <label>City <select><option>Augusta</option></select></label>
    <img src="divider.svg" alt="">
    <button><img src="search.svg" alt="Search"></button>
  `);

  assert.equal(report.findings.length, 0);
});

// # Detection coverage
test("finds missing names, labels, image text, and iframe titles", () => {
  const report = analyzeAccessibility(`
    <img src="service.jpg">
    <button><svg></svg></button>
    <a href="/next"></a>
    <input placeholder="Email">
    <textarea></textarea>
    <iframe src="map.html"></iframe>
  `);

  assert.deepEqual(report.summary, {
    total: 6,
    critical: 2,
    serious: 4,
    moderate: 0,
    minor: 0,
  });
  assert.deepEqual(ruleIds(report).sort(), [
    "control-name",
    "control-name",
    "form-label",
    "form-label",
    "iframe-title",
    "image-alt",
  ]);
});

test("finds page structure, heading hierarchy, and zoom restrictions", () => {
  const report = analyzeAccessibility(`
    <html>
      <head><title></title><meta name="viewport" content="maximum-scale=1, user-scalable=no"></head>
      <body><h2>Section</h2><h4></h4><main></main><main></main></body>
    </html>
  `);

  const ids = ruleIds(report);
  assert.ok(ids.includes("html-lang"));
  assert.ok(ids.includes("document-title"));
  assert.ok(ids.includes("main-landmark"));
  assert.ok(ids.includes("viewport-zoom"));
  assert.equal(ids.filter((id) => id === "heading-order").length, 2);
  assert.ok(ids.includes("heading-name"));
});

test("finds duplicate ids, invalid roles, positive tabindex, and custom mouse controls", () => {
  const report = analyzeAccessibility(`
    <div id="duplicate"></div>
    <span id="duplicate"></span>
    <div role="madeup"></div>
    <button tabindex="3">Continue</button>
    <div onclick="openMenu()">Menu</div>
  `);

  const ids = ruleIds(report);
  assert.ok(ids.includes("duplicate-id"));
  assert.ok(ids.includes("invalid-role"));
  assert.ok(ids.includes("positive-tabindex"));
  assert.ok(ids.includes("custom-control-keyboard"));
});

test("custom controls use the recognized role without crashing", () => {
  const valid = analyzeAccessibility(`
    <div role="button" tabindex="0" onclick="save()" onkeydown="activate(event)">Save</div>
  `);
  assert.ok(!ruleIds(valid).includes("custom-control-keyboard"));

  const missingRole = analyzeAccessibility(`
    <div tabindex="0" onclick="save()" onkeydown="activate(event)">Save</div>
  `);
  assert.ok(ruleIds(missingRole).includes("custom-control-keyboard"));

  const unfocusableRole = analyzeAccessibility('<span role="button">Open</span>');
  assert.ok(ruleIds(unfocusableRole).includes("custom-control-keyboard"));
});

test("validates ARIA references and interactive-role names", () => {
  const report = analyzeAccessibility(`
    <div role="switch checkbox" tabindex="0"></div>
    <button aria-describedby="missing-help">Save</button>
  `);

  assert.ok(ruleIds(report).includes("control-name"));
  assert.ok(ruleIds(report).includes("aria-reference"));
  assert.ok(!ruleIds(report).includes("invalid-role"));
});

test("finds required ARIA state on custom widgets without penalizing native state", () => {
  const custom = analyzeAccessibility(`
    <div role="switch" tabindex="0">Email alerts</div>
    <div role="slider" tabindex="0" aria-label="Volume"></div>
  `);
  assert.equal(ruleIds(custom).filter((id) => id === "aria-required-state").length, 2);

  const native = analyzeAccessibility(`
    <label><input type="checkbox" role="switch"> Email alerts</label>
    <label><input type="range" role="slider"> Volume</label>
  `);
  assert.ok(!ruleIds(native).includes("aria-required-state"));
});

test("finds unnamed repeated landmarks and accepts unique explicit names", () => {
  const unnamed = analyzeAccessibility("<nav>Primary</nav><nav>Footer</nav>");
  assert.equal(ruleIds(unnamed).filter((id) => id === "landmark-name").length, 2);

  const named = analyzeAccessibility(
    '<nav aria-label="Primary">Primary</nav><nav aria-label="Footer">Footer</nav>',
  );
  assert.ok(!ruleIds(named).includes("landmark-name"));

  const duplicateNames = analyzeAccessibility(
    '<nav aria-label="Menu">Primary</nav><nav aria-label="Menu">Footer</nav>',
  );
  assert.equal(
    ruleIds(duplicateNames).filter((id) => id === "landmark-name").length,
    2,
  );
});

test("finds focusable controls inside an aria-hidden subtree", () => {
  const report = analyzeAccessibility(
    '<section aria-hidden="true"><div><a href="/billing">Billing</a></div></section>',
  );

  const finding = report.findings.find((item) => item.ruleId === "aria-hidden-focus");
  assert.ok(finding);
  assert.equal(finding.selector, "section > div > a");
});

test("finds missing video captions and data-table relationships", () => {
  const report = analyzeAccessibility(`
    <video src="walkthrough.mp4"></video>
    <table><tr><td>Total</td><td>$100</td></tr></table>
  `);

  assert.ok(ruleIds(report).includes("media-captions"));
  assert.ok(ruleIds(report).includes("table-name"));
  assert.ok(ruleIds(report).includes("table-header"));
});

test("finds invalid fields not linked to an error description", () => {
  const report = analyzeAccessibility(
    '<label for="email">Email</label><input id="email" aria-invalid="true"><p id="email-error">Required</p>',
  );

  assert.ok(ruleIds(report).includes("error-description"));

  const fixed = analyzeAccessibility(
    '<label for="email">Email</label><input id="email" aria-invalid="true" aria-describedby="email-error"><p id="email-error">Required</p>',
  );
  assert.ok(!ruleIds(fixed).includes("error-description"));

  const empty = analyzeAccessibility(
    '<label for="name">Name</label><input id="name" aria-invalid="true" aria-describedby="name-error"><p id="name-error"></p>',
  );
  assert.ok(ruleIds(empty).includes("error-description"));
});

test("calculates contrast accurately and flags low inline text contrast", () => {
  assert.equal(contrastRatio("#000", "#fff"), 21);
  assert.ok(Math.abs(contrastRatio("rgb(119, 119, 119)", "white") - 4.478) < 0.01);
  assert.equal(contrastRatio("currentColor", "white"), null);

  const report = analyzeAccessibility(
    '<p style="color: #999; background-color: #fff">Hard to read</p>',
  );
  const finding = report.findings.find((item) => item.ruleId === "inline-contrast");
  assert.ok(finding);
  assert.match(finding.message, /2\.85:1/);
});

test("finds statically provable focus suppression and accepts a visible replacement", () => {
  const report = analyzeAccessibility(`
    <style>
      button:focus { outline: none; }
      a:focus-visible { outline: 0; box-shadow: 0 0 0 3px blue; }
    </style>
    <button style="outline: none">Save</button>
    <a href="/help">Help</a>
  `);

  const findings = report.findings.filter((finding) => finding.ruleId === "focus-indicator");
  assert.equal(findings.length, 2);
  assert.ok(findings.some((finding) => finding.selector === "style"));
  assert.ok(findings.some((finding) => finding.selector === "button"));
});

test("issue status describes automated findings without making a conformance claim", () => {
  const report = analyzeAccessibility("<button></button>");
  assert.equal(report.conformance, "AUTOMATED_ISSUES_FOUND");
  assert.ok(report.manualChecks.length > 0);
});

test("caps findings with an explicit truncated result", () => {
  const report = analyzeAccessibility("<button></button>".repeat(MAX_FINDINGS + 10));

  assert.equal(report.status, "truncated");
  assert.equal(report.findingsTruncated, true);
  assert.equal(report.findings.length, MAX_FINDINGS);
  assert.equal(report.summary.total, MAX_FINDINGS);
  assert.equal(report.findings.at(-1).selector, `button:nth-of-type(${MAX_FINDINGS})`);
});

test("flat sibling selector generation remains bounded", { timeout: 5_000 }, () => {
  const siblingCount = 15_000;
  const markup = "<button></button>".repeat(siblingCount);
  const startedAt = performance.now();
  const report = analyzeAccessibility(markup);
  const elapsed = performance.now() - startedAt;

  assert.equal(report.analyzedElements, siblingCount);
  assert.equal(report.findings.length, MAX_FINDINGS);
  assert.equal(report.findings[0].selector, "button:nth-of-type(1)");
  assert.ok(elapsed < 3_000, `flat sibling audit took ${elapsed.toFixed(1)}ms`);
});

// # Stable output
test("finding schema, ordering, identifiers, and score are deterministic", () => {
  const markup = '<button></button>\n<img src="x.jpg">\n<input>';
  const first = analyzeAccessibility(markup);
  const second = analyzeAccessibility(markup);

  assert.deepEqual(first, second);
  assert.deepEqual(first.findings.map((finding) => finding.id), [
    "control-name-1",
    "image-alt-1",
    "form-label-1",
  ]);
  assert.equal(first.score, 60);
  for (const finding of first.findings) {
    assert.deepEqual(Object.keys(finding), [
      "id",
      "ruleId",
      "category",
      "wcag",
      "criterion",
      "level",
      "severity",
      "message",
      "selector",
      "line",
      "column",
      "evidence",
      "remediation",
    ]);
  }
});
