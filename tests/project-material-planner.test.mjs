import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BUILD_PHASES,
  CUT_UNITS,
  LIMITS,
  MATERIAL_UNITS,
  SAFETY_BOUNDARIES,
  TOOL_CATEGORIES,
  TOOL_MANIFEST,
  WORK_CATEGORIES,
  calculateCutItem,
  calculateMaterial,
  calculateProjectPlan,
  roundCurrency,
  serializeProjectPlan,
  validateBuildStep,
  validateCutItem,
  validateLabor,
  validateMaterial,
  validateOtherCost,
  validateProjectPlan,
  validateScope,
  validateToolItem,
} from "../src/tools/project-material-planner/planner.js";

const scope = (overrides = {}) => ({
  projectName: "Workbench restoration",
  finalDimensions: "72 in × 30 in × 36 in",
  intendedUse: "Stationary assembly bench",
  aestheticRequirements: "Clear protective finish",
  materialTypes: "Hardwood and steel hardware",
  workCategory: "general-diy",
  professionalReviewConfirmed: false,
  ...overrides,
});

const material = (overrides = {}) => ({
  id: "material-1",
  name: "Plywood",
  quantity: 9,
  unit: "sq ft",
  wastePercent: 10,
  packageQuantity: 8,
  packagePrice: 24.5,
  ...overrides,
});

const cutItem = (overrides = {}) => ({
  id: "cut-1",
  name: "Long rail",
  quantity: 4,
  unit: "in",
  finishedLength: 30,
  kerfPerCut: 0.125,
  cutsPerPart: 1,
  grainOrientation: "lengthwise",
  ...overrides,
});

const buildSteps = () => [
  { id: "step-1", phase: "material prep", instruction: "Square and label all stock.", dryFitCheckpoint: false },
  { id: "step-2", phase: "joinery and dry-fit", instruction: "Dry-fit and verify diagonals.", dryFitCheckpoint: true },
  { id: "step-3", phase: "structural assembly", instruction: "Glue, clamp, and fasten the frame.", dryFitCheckpoint: false },
  { id: "step-4", phase: "surface prep and finishing", instruction: "Sand progressively and apply finish.", dryFitCheckpoint: false },
];

const completePlan = (overrides = {}) => ({
  scope: scope(),
  materials: [material()],
  cutList: [cutItem()],
  tools: [
    { id: "tool-1", name: "Track saw", category: "cutting", staged: true },
    { id: "tool-2", name: "Eye and hearing protection", category: "safety / PPE", staged: true },
  ],
  buildSteps: buildSteps(),
  labor: [{ id: "labor-1", description: "Assembly", hours: 2.5, hourlyRate: 40 }],
  otherCosts: [{ id: "cost-1", description: "Delivery", amount: 18.5 }],
  budget: 200,
  ...overrides,
});

test("publishes the complete stable tool contract", () => {
  assert.equal(TOOL_MANIFEST.key, "project-material-planner");
  assert.equal(TOOL_MANIFEST.version, "1.1.0");
  for (const capability of ["Project scope and dimensions", "Configurable waste and kerf", "Tool and PPE staging", "Dry-fit safety checkpoint", "Deterministic JSON export", "Regulated-work boundaries"]) {
    assert.ok(TOOL_MANIFEST.capabilities.includes(capability));
  }
  assert.ok(Object.isFrozen(TOOL_MANIFEST));
  assert.ok(Object.isFrozen(TOOL_MANIFEST.capabilities));
});

test("publishes explicit measurement, phase, tool, and work options", () => {
  assert.ok(MATERIAL_UNITS.includes("board ft"));
  assert.ok(CUT_UNITS.includes("mm"));
  assert.deepEqual(BUILD_PHASES, ["material prep", "joinery and dry-fit", "structural assembly", "surface prep and finishing"]);
  assert.ok(TOOL_CATEGORIES.includes("safety / PPE"));
  assert.equal(WORK_CATEGORIES.filter((item) => item.regulated).length, 3);
  assert.equal(SAFETY_BOUNDARIES.length, 3);
  assert.equal(new Set(MATERIAL_UNITS).size, MATERIAL_UNITS.length);
});

test("requires a defined scope and dimensions", () => {
  assert.deepEqual(validateScope({}).map((error) => error.path), [
    "scope.projectName",
    "scope.finalDimensions",
    "scope.intendedUse",
    "scope.materialTypes",
    "scope.workCategory",
  ]);
  assert.equal(validateScope(scope()).length, 0);
});

test("requires professional review acknowledgment for regulated work", () => {
  const unconfirmed = validateScope(scope({ workCategory: "structural" }));
  assert.deepEqual(unconfirmed.map((error) => error.path), ["scope.professionalReviewConfirmed"]);
  assert.equal(validateScope(scope({ workCategory: "regulated-trade", professionalReviewConfirmed: true })).length, 0);
});

test("enforces scope text limits", () => {
  assert.equal(validateScope(scope({ projectName: "x".repeat(121) }))[0].path, "scope.projectName");
  assert.equal(validateScope(scope({ aestheticRequirements: "x".repeat(241) }))[0].path, "scope.aestheticRequirements");
});

test("adds waste before rounding to whole purchase packages", () => {
  const result = calculateMaterial(material());
  assert.equal(result.quantityWithWaste, 9.9);
  assert.equal(result.packagesRequired, 2);
  assert.equal(result.purchasedQuantity, 16);
  assert.equal(result.excessQuantity, 6.1);
  assert.equal(result.lineTotal, 49);
});

test("does not add a package at an exact boundary", () => {
  assert.equal(calculateMaterial(material({ quantity: 10, wastePercent: 20, packageQuantity: 4 })).packagesRequired, 3);
});

test("never under-orders because a displayed quantity was rounded", () => {
  const result = calculateMaterial(material({ quantity: 1.00001, wastePercent: 0, packageQuantity: 1, packagePrice: 1 }));
  assert.equal(result.quantityWithWaste, 1);
  assert.equal(result.packagesRequired, 2);
  assert.equal(result.purchasedQuantity, 2);
});

test("supports supplied materials with a zero purchase price", () => {
  assert.equal(calculateMaterial(material({ packagePrice: 0 })).lineTotal, 0);
});

test("validates all material fields and rejects blank or non-finite numbers", () => {
  const errors = validateMaterial({ name: " ", quantity: " ", unit: "mixed", wastePercent: NaN, packageQuantity: Infinity, packagePrice: -1 });
  assert.deepEqual(errors.map((error) => error.path), [
    "materials.0.name",
    "materials.0.unit",
    "materials.0.quantity",
    "materials.0.wastePercent",
    "materials.0.packageQuantity",
    "materials.0.packagePrice",
  ]);
  assert.throws(() => calculateMaterial(material({ packageQuantity: 0 })), /Package quantity must be between/);
});

test("calculates cut stock including saw kerf and grain direction", () => {
  const result = calculateCutItem(cutItem());
  assert.equal(result.totalFinishedLength, 120);
  assert.equal(result.totalKerfAllowance, 0.5);
  assert.equal(result.totalStockLength, 120.5);
  assert.equal(result.grainOrientation, "lengthwise");
});

test("rejects fractional part counts, invalid cut units, and excessive cut calculations", () => {
  assert.deepEqual(validateCutItem(cutItem({ quantity: 1.5, unit: "sq ft" })).map((error) => error.path), ["cutList.0.quantity", "cutList.0.unit"]);
  assert.equal(validateCutItem(cutItem({ quantity: LIMITS.maxQuantity, finishedLength: LIMITS.maxQuantity, kerfPerCut: LIMITS.maxQuantity, cutsPerPart: 2 }))[0].path, "cutList.0.finishedLength");
});

test("validates tool, PPE, build-step, labor, and other-cost rows independently", () => {
  assert.equal(validateToolItem({ name: "", category: "unknown" }).length, 2);
  assert.equal(validateBuildStep({ phase: "purchase", instruction: "" }).length, 2);
  assert.equal(validateLabor({ description: "", hours: 0, hourlyRate: -1 }).length, 3);
  assert.equal(validateOtherCost({ description: "", amount: -0.01 }).length, 2);
  assert.equal(validateLabor({ description: "Finish", hours: 2, hourlyRate: 0 }).length, 0);
  assert.equal(validateOtherCost({ description: "Permit", amount: 0 }).length, 0);
});

test("rejects build phases that move backward", () => {
  const steps = buildSteps();
  [steps[1], steps[2]] = [steps[2], steps[1]];
  const validation = validateProjectPlan(completePlan({ buildSteps: steps }));
  assert.ok(validation.errors.some((error) => error.path === "buildSteps.1.dryFitCheckpoint"));
  assert.ok(validation.errors.some((error) => error.path === "buildSteps.2.phase"));
});

test("requires dry-fit before permanent structural assembly", () => {
  const steps = buildSteps().map((step) => ({ ...step, dryFitCheckpoint: false }));
  const validation = validateProjectPlan(completePlan({ buildSteps: steps }));
  assert.ok(validation.errors.some((error) => error.path === "buildSteps.2.dryFitCheckpoint"));
});

test("returns readiness notes for a valid but incomplete project", () => {
  const validation = validateProjectPlan(completePlan({ materials: [], cutList: [], tools: [], buildSteps: [] }));
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.warnings.map((warning) => warning.path), ["materials", "cutList", "tools", "buildSteps"]);
});

test("warns when tools omit personal protective equipment", () => {
  const validation = validateProjectPlan(completePlan({ tools: [{ id: "tool-1", name: "Saw", category: "cutting" }] }));
  assert.equal(validation.valid, true);
  assert.ok(validation.warnings.some((warning) => /protective equipment/.test(warning.message)));
});

test("calculates a complete BOM, workflow, and bounded project budget", () => {
  const result = calculateProjectPlan(completePlan());
  assert.equal(result.ok, true);
  assert.equal(result.totals.materialSubtotal, 49);
  assert.equal(result.totals.laborSubtotal, 100);
  assert.equal(result.totals.otherSubtotal, 18.5);
  assert.equal(result.totals.total, 167.5);
  assert.equal(result.totals.budgetDifference, 32.5);
  assert.equal(result.totals.overBudget, false);
  assert.equal(result.buildSteps[1].order, 2);
  assert.equal(result.buildSteps[1].dryFitCheckpoint, true);
  assert.equal(result.safety.regulated, false);
  assert.deepEqual(result.safety.boundaries, SAFETY_BOUNDARIES);
});

test("reports over-budget plans", () => {
  const result = calculateProjectPlan(completePlan({ budget: 100 }));
  assert.equal(result.ok, true);
  assert.equal(result.totals.budgetDifference, -67.5);
  assert.equal(result.totals.overBudget, true);
});

test("allows deterministic zero totals when scope is valid", () => {
  const result = calculateProjectPlan(completePlan({ materials: [], cutList: [], tools: [], buildSteps: [], labor: [], otherCosts: [], budget: "" }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.totals, {
    materialSubtotal: 0,
    laborSubtotal: 0,
    otherSubtotal: 0,
    total: 0,
    budget: null,
    budgetDifference: null,
    overBudget: null,
  });
});

test("returns field errors rather than calculating invalid plans", () => {
  const result = calculateProjectPlan(completePlan({ materials: [material({ unit: "ft-to-m" })] }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{ path: "materials.0.unit", message: "Choose a supported measurement unit." }]);
});

test("rejects invalid collection shapes, row floods, and invalid budgets", () => {
  const badShapes = validateProjectPlan({ ...completePlan(), materials: {}, labor: "none", otherCosts: 4, budget: -10 });
  assert.deepEqual(badShapes.errors.map((error) => error.path), ["materials", "labor", "otherCosts", "budget"]);
  const tooMany = validateProjectPlan(completePlan({ materials: Array.from({ length: LIMITS.maxRows + 1 }, (_, index) => material({ id: `material-${index}` })) }));
  assert.ok(tooMany.errors.some((error) => error.path === "materials"));
  assert.equal(validateProjectPlan(completePlan({ budget: " " })).errors.at(-1).path, "budget");
});

test("stops finite row values from overflowing the project total", () => {
  const labor = Array.from({ length: 11 }, (_, index) => ({ id: `labor-${index}`, description: `Phase ${index}`, hours: LIMITS.maxHours, hourlyRate: LIMITS.maxRate }));
  const result = calculateProjectPlan(completePlan({ labor }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{ path: "labor", message: "Calculated total exceeds the supported project limit." }]);
});

test("exports stable parseable JSON without timestamps or generated content", () => {
  const plan = completePlan();
  const first = serializeProjectPlan(plan);
  const second = serializeProjectPlan(plan);
  assert.equal(first, second);
  assert.ok(first.endsWith("\n"));
  const parsed = JSON.parse(first);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.tool, "project-material-planner");
  assert.equal(parsed.plan.scope.projectName, "Workbench restoration");
  assert.equal(parsed.plan.materials[0].packagesRequired, 2);
  assert.equal("generatedAt" in parsed, false);
});

test("refuses to export blank or invalid project state", () => {
  assert.throws(() => serializeProjectPlan({}), /Cannot export an invalid project plan/);
});

test("currency rounding avoids common floating-point drift", () => {
  assert.equal(roundCurrency(0.1 + 0.2), 0.3);
  assert.equal(roundCurrency(12.345), 12.35);
  assert.equal(roundCurrency(10.075), 10.08);
  assert.equal(roundCurrency(1.005), 1.01);
  assert.equal(roundCurrency(-10.075), -10.08);
});

test("rounds monetary lines half-up before summing exact cents", () => {
  const result = calculateProjectPlan(completePlan({
    materials: [material({ quantity: 1, wastePercent: 0, packageQuantity: 1, packagePrice: "10.075" })],
    labor: [{ id: "labor-1", description: "Fine work", hours: "2.5", hourlyRate: "10.075" }],
    otherCosts: [
      { id: "cost-1", description: "First fee", amount: "1.005" },
      { id: "cost-2", description: "Second fee", amount: "2.005" },
    ],
    budget: "40.315",
  }));

  assert.equal(result.ok, true);
  assert.equal(result.materials[0].lineTotal, 10.08);
  assert.equal(result.labor[0].lineTotal, 25.19);
  assert.equal(result.totals.otherSubtotal, 3.02);
  assert.equal(result.totals.total, 38.29);
  assert.equal(result.totals.budget, 40.32);
  assert.equal(result.totals.budgetDifference, 2.03);
  assert.equal(result.totals.overBudget, false);
});

test("interactive workspace exposes every skill workflow and blank-state action", async () => {
  const source = await readFile(new URL("../src/tools/project-material-planner/index.jsx", import.meta.url), "utf8");
  for (const text of ["Project scope", "Final dimensions", "Materials", "Waste %", "Cut list", "Kerf per cut", "Tools &amp; safety", "Build sequence", "Dry-fit checkpoint", "Labor", "Other costs", "Project budget (USD)", "Export JSON", "No build steps entered."]) {
    assert.ok(source.includes(text), `missing workspace control: ${text}`);
  }
  assert.equal(source.includes("mock"), false);
  assert.equal(source.includes("sample"), false);
});
