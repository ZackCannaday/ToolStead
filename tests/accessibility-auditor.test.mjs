import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeAccessibility,
  AuditInputError,
  AUDIT_VERSION,
  contrastRatio,
  MANUAL_CHECKS,
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

test("validates ARIA references and interactive-role names", () => {
  const report = analyzeAccessibility(`
    <div role="switch checkbox" tabindex="0"></div>
    <button aria-describedby="missing-help">Save</button>
  `);

  assert.ok(ruleIds(report).includes("control-name"));
  assert.ok(ruleIds(report).includes("aria-reference"));
  assert.ok(!ruleIds(report).includes("invalid-role"));
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
