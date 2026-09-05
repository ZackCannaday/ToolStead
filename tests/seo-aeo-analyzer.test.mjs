import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INPUT_LIMITS,
  TOOL_MANIFEST,
  analyzeSeoAeoContent,
  buildAuditReport,
  countWords,
  parseHeadings,
  validateSeoAeoInput,
} from "../src/tools/seo-aeo-analyzer/analyzer.js";

// # Realistic content fixture
const bodyParagraph =
  "Mobile brake service brings measured inspection and repair to the customer at home or work. Our technician verifies the concern, measures each braking component, and explains the documented findings before repair begins. The 2026 process gives the customer clear choices and a written result based on firsthand measurements. According to the supplied service record, the inspection covers 4 wheels before any repair is approved.";
const strongBody = [
  "Mobile brake service is an on-site inspection and repair process that measures the braking system before work begins, explains the verified cause, and documents available repair choices so a customer can approve the right work without guessing or replacing parts that have not been tested first.",
  ...Array.from({ length: 5 }, () => bodyParagraph),
  "1. Verify the concern\n2. Measure the components\n3. Document the result\n\nSource: https://example.com/service-record\nUpdated 2026.",
].join("\n\n");

test("exports a bounded client-side tool contract", () => {
  assert.equal(TOOL_MANIFEST.id, "seo-aeo-content-analyzer");
  assert.equal(TOOL_MANIFEST.runsClientSide, true);
  assert.equal(INPUT_LIMITS.body, 80000);
  assert.equal(INPUT_LIMITS.aggregate, 90000);
  assert.ok(Object.isFrozen(TOOL_MANIFEST));
  assert.ok(Object.isFrozen(INPUT_LIMITS));
});

test("returns explicit empty and malformed-input states", () => {
  const empty = analyzeSeoAeoContent();
  assert.equal(empty.status, "empty");
  assert.equal(empty.score, null);
  assert.deepEqual(empty.pillars, []);

  const malformed = analyzeSeoAeoContent(null);
  assert.equal(malformed.status, "error");
  assert.equal(malformed.errors[0].field, "input");
});

test("returns field-addressable URL and per-field limit errors", () => {
  const result = analyzeSeoAeoContent({
    url: "not a url",
    title: "x".repeat(INPUT_LIMITS.title + 1),
    body: "Useful page copy.",
  });
  assert.equal(result.status, "error");
  assert.deepEqual(result.errors.map((error) => error.field), ["title", "url"]);
  assert.match(result.errors[0].message, /200 characters or fewer/);
  assert.match(result.errors[1].message, /HTTP or HTTPS/);
});

test("enforces heading, body, and aggregate bounds before analysis", () => {
  const fields = ["headings", "body"];
  for (const field of fields) {
    const { errors } = validateSeoAeoInput({ [field]: "x".repeat(INPUT_LIMITS[field] + 1) });
    assert.ok(errors.some((error) => error.field === field));
  }
  const aggregate = validateSeoAeoInput({
    body: "b".repeat(INPUT_LIMITS.body),
    headings: "h".repeat(INPUT_LIMITS.aggregate - INPUT_LIMITS.body + 1),
  });
  assert.ok(aggregate.errors.some((error) => error.field === "input"));
});

test("parses labeled, Markdown, and HTML headings", () => {
  assert.deepEqual(parseHeadings("H1: Main topic\n## How does it work?\n<h3>Details</h3>"), [
    { level: 1, text: "Main topic", line: 1 },
    { level: 2, text: "How does it work?", line: 2 },
    { level: 3, text: "Details", line: 3 },
  ]);
});

test("produces the required five 20-point pillars and scorecard metrics", () => {
  const result = analyzeSeoAeoContent({
    url: "https://example.com/mobile-brake-service",
    title: "Mobile Brake Service With Measured Inspection",
    metaDescription: "Mobile brake service provides measured inspection, documented findings, clear repair choices, and on-site service at a customer's home or workplace.",
    headings: "H1: Mobile Brake Service With Measured Inspection\nH2: What does mobile brake service include?\nH2: How does the inspection work?\nH2: Repair options",
    body: strongBody,
  });

  assert.equal(result.status, "complete");
  assert.equal(result.pillars.length, 5);
  assert.ok(result.pillars.every((pillar) => pillar.maxScore === 20));
  assert.equal(result.score, result.pillars.reduce((total, pillar) => total + pillar.score, 0));
  assert.match(result.grade, /^[A-F]$/);
  assert.equal(result.metrics.primaryKeyword, "mobile brake service");
  assert.equal(result.metrics.searchIntent, "Informational");
  assert.equal(typeof result.metrics.fleschReadingEase, "number");
  assert.equal(typeof result.metrics.keywordDensity, "number");
  assert.equal(result.findings.length, 26);
  assert.deepEqual(result.pillars.map((pillar) => pillar.name), [
    "Search intent & keywords",
    "AEO & direct answers",
    "E-E-A-T & citation authority",
    "Content structure & hierarchy",
    "Technical SEO & schema",
  ]);
});

test("keeps evidence stable and identifies hierarchy and transport gaps", () => {
  const input = { url: "http://example.com/123", title: "Short", headings: "H1: Short\nH3: Details", body: "A short page does not provide enough topic coverage." };
  const first = analyzeSeoAeoContent(input);
  const second = analyzeSeoAeoContent(input);
  assert.deepEqual(first, second);
  assert.equal(first.findings.find((item) => item.id === "hierarchy")?.status, "error");
  assert.equal(first.findings.find((item) => item.id === "https")?.status, "error");
});

test("builds a local report from findings without invented citations or copy", () => {
  const result = analyzeSeoAeoContent({ title: "Brake Service Inspection Guide", headings: "H1: Brake Service Inspection Guide", body: bodyParagraph });
  const report = buildAuditReport(result);
  assert.match(report, /Five-pillar scorecard/);
  assert.match(report, /Evidence and remediation/);
  assert.match(report, /does not verify rankings, indexing, citations/);
  assert.doesNotMatch(report, /FAQPage|<script|optimized title/i);
  assert.throws(() => buildAuditReport(analyzeSeoAeoContent()), /completed audit/);
});

test("ships worker execution, mirrored UI bounds, and linked accessible errors", async () => {
  const [component, worker] = await Promise.all([
    readFile(new URL("../src/tools/seo-aeo-analyzer/SeoAeoAnalyzer.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/tools/seo-aeo-analyzer/analyzer.worker.js", import.meta.url), "utf8"),
  ]);
  assert.match(component, /new Worker\(new URL\("\.\/analyzer\.worker\.js"/);
  assert.match(component, /maxLength=\{INPUT_LIMITS\.body\}/);
  assert.match(component, /maxLength=\{INPUT_LIMITS\.headings\}/);
  assert.match(component, /aria-invalid=\{Boolean\(fieldError\("url"\)\)\}/);
  assert.match(component, /aria-describedby=\{describedBy\("body"\)\}/);
  assert.match(component, /tabIndex=\{-1\}/);
  assert.match(component, /Copy report/);
  assert.match(component, /Download \.md/);
  assert.match(worker, /analyzeSeoAeoContent/);
});

test("counts words consistently across punctuation and line breaks", () => {
  assert.equal(countWords("Diagnosis-first service\nkeeps the customer's options clear."), 7);
});
