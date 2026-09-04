import assert from "node:assert/strict";
import test from "node:test";
import {
  TOOL_MANIFEST,
  analyzeSeoAeoContent,
  countWords,
  parseHeadings,
} from "../src/tools/seo-aeo-analyzer/analyzer.js";

// # Test content fixture
const bodyParagraph =
  "Mobile brake service brings inspection and repair to the customer at home or work. A technician verifies the concern, measures the braking components, and explains the findings before repair begins. This process helps the customer understand the cause, available repair choices, and expected result without guessing. Clear documentation records the inspection and completed work for future reference.";
const strongBody = Array.from({ length: 6 }, () => bodyParagraph).join(" ");

test("exports a stable client-side tool manifest", () => {
  assert.equal(TOOL_MANIFEST.id, "seo-aeo-content-analyzer");
  assert.equal(TOOL_MANIFEST.runsClientSide, true);
  assert.ok(Object.isFrozen(TOOL_MANIFEST));
});

test("returns an explicit empty state before content is supplied", () => {
  const result = analyzeSeoAeoContent();
  assert.equal(result.status, "empty");
  assert.equal(result.score, null);
  assert.deepEqual(result.findings, []);
});

test("returns an actionable error for an invalid URL", () => {
  const result = analyzeSeoAeoContent({ url: "not a url", title: "A valid page title" });
  assert.equal(result.status, "error");
  assert.equal(result.score, null);
  assert.deepEqual(result.errors, [
    { field: "url", message: "Enter a complete HTTP or HTTPS URL." },
  ]);
});

test("parses labeled, Markdown, and HTML headings", () => {
  assert.deepEqual(parseHeadings("H1: Main topic\n## How does it work?\n<h3>Details</h3>"), [
    { level: 1, text: "Main topic", line: 1 },
    { level: 2, text: "How does it work?", line: 2 },
    { level: 3, text: "Details", line: 3 },
  ]);
});

test("scores strong SEO and answer-ready content", () => {
  const result = analyzeSeoAeoContent({
    url: "https://example.com/mobile-brake-service",
    title: "Mobile Brake Service With Clear Inspection Results",
    metaDescription:
      "Get mobile brake inspection and repair with measured findings, clear recommendations, and documented results at your home or workplace.",
    headings:
      "H1: Mobile Brake Service With Clear Inspection Results\nH2: What does mobile brake service include?\nH2: How does the inspection work?\nH2: Repair options",
    body: strongBody,
  });

  assert.equal(result.status, "complete");
  assert.equal(result.score, 100);
  assert.equal(result.band, "Strong");
  assert.equal(result.metrics.headingCount, 4);
  assert.equal(result.findings.length, 14);
  assert.ok(result.findings.every((item) => item.status === "pass"));
});

test("keeps findings stable and identifies hierarchy gaps", () => {
  const input = {
    url: "http://example.com/123",
    title: "Short",
    headings: "H1: Short\nH3: Details",
    body: "A short page does not provide enough topic coverage.",
  };
  const first = analyzeSeoAeoContent(input);
  const second = analyzeSeoAeoContent(input);

  assert.deepEqual(first, second);
  assert.equal(first.status, "complete");
  assert.equal(
    first.findings.find((item) => item.id === "heading-hierarchy")?.status,
    "error",
  );
  assert.equal(first.findings.find((item) => item.id === "https")?.status, "error");
});

test("counts words consistently across punctuation and line breaks", () => {
  assert.equal(countWords("Diagnosis-first service\nkeeps the customer's options clear."), 7);
});
