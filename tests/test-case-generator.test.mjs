import assert from "node:assert/strict";
import test from "node:test";
import {
  exportTestCasesCsv,
  generateTestCases,
  parseRequirements,
  parseSource,
  validateRequirements,
} from "../src/tools/test-case-generator/engine.js";
import { TOOL_MANIFEST } from "../src/tools/test-case-generator/manifest.js";

test("publishes an offline tool manifest", () => {
  assert.equal(TOOL_MANIFEST.id, "test-case-generator");
  assert.equal(TOOL_MANIFEST.requiresNetwork, false);
  assert.deepEqual(TOOL_MANIFEST.outputs, ["test-cases", "csv"]);
});

test("parses explicit and generated requirement IDs", () => {
  const requirements = parseRequirements(
    "REQ-101: A user must sign in securely.\n- Reports should show an empty state.",
  );

  assert.equal(requirements.length, 2);
  assert.equal(requirements[0].id, "REQ-101");
  assert.equal(requirements[0].sourceLine, 1);
  assert.match(requirements[1].id, /^REQ-[A-Z0-9]{7}$/);
  assert.equal(requirements[1].sourceLine, 2);
});

test("generates traceable positive, negative, and boundary cases", () => {
  const cases = generateTestCases([
    {
      id: "REQ-12",
      description: "Passwords must contain between 12 and 64 characters.",
      preconditions: ["The account creation form is open."],
      acceptanceCriteria: ["Valid passwords are accepted", "Invalid passwords are rejected"],
    },
  ]);

  assert.deepEqual(cases.map(({ type }) => type), ["positive", "negative", "boundary"]);
  assert.deepEqual(cases.map(({ id }) => id), [
    "TC-REQ-12-POS",
    "TC-REQ-12-NEG",
    "TC-REQ-12-BND",
  ]);
  assert.ok(cases.every((item) => item.requirementId === "REQ-12"));
  assert.ok(cases.every((item) => item.priority === "P0"));
  assert.deepEqual(cases[0].preconditions, ["The account creation form is open."]);
  assert.match(cases[2].steps[1].action, /11, 12, 13, 63, 64, 65/);
  assert.deepEqual(cases[2].traceability.acceptanceCriteria, [
    "Valid passwords are accepted",
    "Invalid passwords are rejected",
  ]);
});

test("keeps generated IDs stable across repeated runs", () => {
  const requirement = "The dashboard should show the current account status.";
  const first = generateTestCases(requirement);
  const second = generateTestCases(requirement);

  assert.deepEqual(second, first);
});

test("extracts public function contracts without testing implementation details", () => {
  const cases = generateTestCases(
    "export function calculateTotal(subtotal, taxRate) { return subtotal * (1 + taxRate); }",
    { sourceType: "function" },
  );

  assert.equal(cases.length, 3);
  assert.equal(cases[0].requirementId, "FN-CALCULATETOTAL");
  assert.equal(cases[0].testLevel, "unit");
  assert.match(cases[0].steps[0].action, /^Arrange —/);
  assert.match(cases[0].steps[1].action, /^Act —/);
  assert.match(cases[0].steps[2].action, /^Assert —/);
});

test("derives integration cases from documented API operations", () => {
  const specification = {
    paths: {
      "/accounts/{id}": {
        patch: {
          operationId: "updateAccount",
          parameters: [{ name: "id", required: true }],
          requestBody: { required: true },
          responses: { 200: {}, 400: {}, 404: {} },
        },
      },
    },
  };
  const cases = generateTestCases(specification, { sourceType: "api" });

  assert.equal(cases.length, 3);
  assert.equal(cases[0].requirementId, "UPDATEACCOUNT");
  assert.equal(cases[0].testLevel, "integration");
  assert.match(cases[0].expectedResult, /200, 400, 404/);
  assert.match(cases[0].expectedResult, /id/);
});

test("extracts exact JSON Schema boundary vectors", () => {
  const cases = generateTestCases(
    {
      type: "object",
      required: ["quantity"],
      properties: {
        quantity: { type: "integer", minimum: 1, maximum: 5 },
      },
    },
    { sourceType: "schema" },
  );
  const boundary = cases.find(({ type }) => type === "boundary");

  assert.equal(boundary.requirementId, "SCHEMA-QUANTITY");
  assert.match(boundary.steps[1].action, /0, 1, 2, 4, 5, 6/);
  assert.match(boundary.expectedResult, /type integer; required; minimum 1; maximum 5/);
});

test("extracts database column contracts from SQL schemas", () => {
  const requirements = parseSource(
    "CREATE TABLE jobs (id INTEGER NOT NULL, notes TEXT);",
    "schema",
  );

  assert.equal(requirements.length, 2);
  assert.equal(requirements[0].id, "SCHEMA-JOBS-ID");
  assert.equal(requirements[0].testLevel, "integration");
  assert.match(requirements[0].acceptanceCriteria[0], /NOT NULL/);
});

test("validates empty, duplicate, and invalid-priority requirements", () => {
  assert.equal(validateRequirements("").valid, false);

  const result = validateRequirements([
    { id: "REQ-7", text: "The export must include a header row." },
    { id: "REQ-7", text: "The export must include all result rows.", priority: "urgent" },
  ]);

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.errors.map(({ code }) => code),
    ["DUPLICATE_ID", "INVALID_PRIORITY"],
  );
});

test("supports deterministic type filtering", () => {
  const cases = generateTestCases("REQ-2: A user can upload a supported file.", {
    types: ["boundary", "positive"],
    defaultPriority: "P3",
  });

  assert.deepEqual(cases.map(({ type }) => type), ["positive", "boundary"]);
  assert.ok(cases.every(({ priority }) => priority === "P3"));
});

test("exports escaped CSV and neutralizes spreadsheet formulas", () => {
  const csv = exportTestCasesCsv([
    {
      id: "=EXEC",
      requirementId: "REQ-CSV",
      requirement: "Export a value containing a comma, quote \" and newline\nwithout data loss.",
      title: "CSV safety",
      type: "negative",
      priority: "P1",
      preconditions: ["Export is available."],
      steps: [{ number: 1, action: "Create the export." }],
      expectedResult: "CSV remains inert.",
      traceability: { sourceLine: 1, acceptanceCriteria: ["No formula execution"] },
    },
  ]);

  assert.match(csv, /^"Test Case ID","Requirement ID"/);
  assert.match(csv, /"'=EXEC"/);
  assert.match(csv, /quote "" and newline\nwithout data loss/);
  assert.match(csv, /"1\. Create the export\."/);
  assert.equal(csv.split("\r\n").length, 2);
});

test("rejects unsupported inputs and case types", () => {
  assert.throws(() => generateTestCases(null), { name: "TestCaseValidationError" });
  assert.throws(
    () => generateTestCases("REQ-9: The report must open.", { types: ["random"] }),
    /Case types/,
  );
  assert.throws(() => exportTestCasesCsv("not-an-array"), /must be an array/);
  assert.equal(
    validateRequirements("not valid JSON", { sourceType: "schema" }).errors[0].code,
    "INVALID_SOURCE",
  );
});
