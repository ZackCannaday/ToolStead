import test from "node:test";
import assert from "node:assert/strict";
import {
  MATERIAL_UNITS,
  TOOL_MANIFEST,
  calculateMaterial,
  calculateProjectPlan,
  roundCurrency,
  validateLabor,
  validateMaterial,
  validateOtherCost,
  validateProjectPlan,
} from "../src/tools/project-material-planner/planner.js";

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

test("exports a stable ToolStead manifest", () => {
  assert.equal(TOOL_MANIFEST.key, "project-material-planner");
  assert.equal(TOOL_MANIFEST.version, "1.0.0");
  assert.ok(TOOL_MANIFEST.capabilities.includes("Package rounding"));
});

test("publishes explicit units without implying conversions", () => {
  assert.ok(MATERIAL_UNITS.includes("each"));
  assert.ok(MATERIAL_UNITS.includes("sq ft"));
  assert.ok(MATERIAL_UNITS.includes("board ft"));
  assert.equal(new Set(MATERIAL_UNITS).size, MATERIAL_UNITS.length);
});

test("adds waste before rounding to whole packages", () => {
  const result = calculateMaterial(material());
  assert.equal(result.quantityWithWaste, 9.9);
  assert.equal(result.packagesRequired, 2);
  assert.equal(result.purchasedQuantity, 16);
  assert.equal(result.excessQuantity, 6.1);
  assert.equal(result.lineTotal, 49);
  assert.equal(result.unit, "sq ft");
});

test("does not add an unnecessary package at an exact boundary", () => {
  const result = calculateMaterial(
    material({ quantity: 10, wastePercent: 20, packageQuantity: 4 }),
  );
  assert.equal(result.quantityWithWaste, 12);
  assert.equal(result.packagesRequired, 3);
});

test("supports zero-cost supplied materials", () => {
  const result = calculateMaterial(material({ packagePrice: 0 }));
  assert.equal(result.lineTotal, 0);
});

test("validates all required material fields and safe ranges", () => {
  const errors = validateMaterial({
    name: " ",
    quantity: 0,
    unit: "mixed units",
    wastePercent: 101,
    packageQuantity: -2,
    packagePrice: -1,
  });
  assert.deepEqual(
    errors.map((error) => error.path),
    [
      "materials.0.name",
      "materials.0.unit",
      "materials.0.quantity",
      "materials.0.wastePercent",
      "materials.0.packageQuantity",
      "materials.0.packagePrice",
    ],
  );
});

test("rejects blank and non-finite numeric material values", () => {
  const errors = validateMaterial(
    material({ quantity: "", wastePercent: "nope", packageQuantity: Infinity }),
  );
  assert.equal(errors.length, 3);
});

test("calculateMaterial refuses invalid input", () => {
  assert.throws(
    () => calculateMaterial(material({ packageQuantity: 0 })),
    /Package quantity must be greater than zero/,
  );
});

test("validates labor and other costs independently", () => {
  assert.equal(validateLabor({ description: "", hours: 0, hourlyRate: -1 }).length, 3);
  assert.equal(validateOtherCost({ description: "", amount: -0.01 }).length, 2);
  assert.equal(validateLabor({ description: "Assembly", hours: 2, hourlyRate: 0 }).length, 0);
  assert.equal(validateOtherCost({ description: "Delivery", amount: 0 }).length, 0);
});

test("calculates material, labor, other, and grand totals", () => {
  const result = calculateProjectPlan({
    materials: [material(), material({ id: "material-2", name: "Screws", quantity: 30, unit: "each", wastePercent: 0, packageQuantity: 25, packagePrice: 7.25 })],
    labor: [
      { id: "labor-1", description: "Assembly", hours: 2.5, hourlyRate: 40 },
      { id: "labor-2", description: "Finish", hours: 1.25, hourlyRate: 32 },
    ],
    otherCosts: [
      { id: "cost-1", description: "Delivery", amount: 18.5 },
      { id: "cost-2", description: "Rental", amount: 45 },
    ],
    budget: 300,
  });

  assert.equal(result.ok, true);
  assert.equal(result.totals.materialSubtotal, 63.5);
  assert.equal(result.totals.laborSubtotal, 140);
  assert.equal(result.totals.otherSubtotal, 63.5);
  assert.equal(result.totals.total, 267);
  assert.equal(result.totals.budgetDifference, 33);
  assert.equal(result.totals.overBudget, false);
});

test("reports an over-budget plan", () => {
  const result = calculateProjectPlan({ materials: [material()], budget: 40 });
  assert.equal(result.ok, true);
  assert.equal(result.totals.budgetDifference, -9);
  assert.equal(result.totals.overBudget, true);
});

test("supports an empty plan with deterministic zero totals", () => {
  const result = calculateProjectPlan({ materials: [], labor: [], otherCosts: [] });
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

test("returns field errors instead of calculating invalid plans", () => {
  const result = calculateProjectPlan({ materials: [material({ unit: "ft-to-m" })] });
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    {
      path: "materials.0.unit",
      message: "Choose a supported measurement unit.",
    },
  ]);
});

test("rejects invalid collection shapes and negative budgets", () => {
  const result = validateProjectPlan({
    materials: {},
    labor: "none",
    otherCosts: 4,
    budget: -10,
  });
  assert.equal(result.valid, false);
  assert.deepEqual(
    result.errors.map((error) => error.path),
    ["materials", "labor", "otherCosts", "budget"],
  );
});

test("roundCurrency avoids common floating-point money drift", () => {
  assert.equal(roundCurrency(0.1 + 0.2), 0.3);
  assert.equal(roundCurrency(12.345), 12.35);
});
