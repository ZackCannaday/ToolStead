import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [accessibilitySource, seoSource, testCaseSource] = await Promise.all([
  readFile(new URL("../src/tools/accessibility-auditor/AccessibilityAuditor.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/tools/seo-aeo-analyzer/SeoAeoAnalyzer.jsx", import.meta.url), "utf8"),
  readFile(new URL("../src/tools/test-case-generator/TestCaseGenerator.jsx", import.meta.url), "utf8"),
]);

function handlerBody(source, marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing source marker: ${marker}`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test("accessibility input mutation clears the prior audit", () => {
  const handler = handlerBody(
    accessibilitySource,
    "onChange={(event) => {",
    "maxLength={MAX_HTML_LENGTH}",
  );

  assert.match(handler, /setHtml\(event\.target\.value\)/);
  assert.match(handler, /setReport\(null\)/);
  assert.match(handler, /setSeverity\("all"\)/);
});

test("SEO input mutation invalidates completed and in-flight audits", () => {
  const handler = handlerBody(
    seoSource,
    "const updateField = (field) => (event) => {",
    "const applyResult =",
  );

  assert.match(handler, /if \(value === input\[field\]\) return/);
  assert.match(handler, /requestRef\.current \+= 1/);
  assert.match(handler, /pendingRef\.current = null/);
  assert.match(handler, /setResult\(analyzeSeoAeoContent\(\)\)/);
  assert.match(handler, /setHasRun\(false\)/);
  assert.match(handler, /setIsAnalyzing\(false\)/);
  assert.match(seoSource, /if \(requestId !== requestRef\.current\) return/);
});

test("test-generator input mutation clears cases and derived CSV", () => {
  const handler = handlerBody(
    testCaseSource,
    'id="tcg-requirements"',
    'rows="15"',
  );

  assert.match(handler, /setRequirements\(event\.target\.value\)/);
  assert.match(handler, /setTestCases\(\[\]\)/);
  assert.match(handler, /setIssues\(\{ errors: \[\], warnings: \[\] \}\)/);
  assert.match(handler, /setExpandedId\(null\)/);
  assert.match(testCaseSource, /const csv = useMemo\(\(\) => exportTestCasesCsv\(filteredCases\)/);
  assert.match(testCaseSource, /\{testCases\.length > 0 && \(/);
});
