import { TOOL_MANIFEST } from "./manifest.js";
export { TOOL_MANIFEST } from "./manifest.js";

// # Planner contract

export const LIMITS = Object.freeze({
  maxRows: 200,
  maxQuantity: 1_000_000,
  maxMoney: 100_000_000,
  maxBudget: 1_000_000_000_000,
  maxHours: 100_000,
  maxRate: 1_000_000,
  maxCutsPerPart: 1_000,
  maxCalculatedQuantity: 1_000_000_000_000,
  maxProjectTotal: 1_000_000_000_000,
});

export const MATERIAL_UNITS = Object.freeze([
  "each", "in", "ft", "yd", "mm", "cm", "m", "sq in", "sq ft",
  "sq yd", "sq m", "cu ft", "board ft", "oz", "lb", "g", "kg",
  "fl oz", "pt", "qt", "gal", "ml", "l",
]);

export const CUT_UNITS = Object.freeze(["in", "ft", "mm", "cm", "m"]);
export const GRAIN_ORIENTATIONS = Object.freeze([
  "not applicable",
  "lengthwise",
  "crosswise",
  "match adjacent",
]);
export const TOOL_CATEGORIES = Object.freeze([
  "measurement / layout",
  "cutting",
  "shaping",
  "routing",
  "fastening",
  "clamping",
  "sanding",
  "finishing",
  "safety / PPE",
]);
export const BUILD_PHASES = Object.freeze([
  "material prep",
  "joinery and dry-fit",
  "structural assembly",
  "surface prep and finishing",
]);
export const WORK_CATEGORIES = Object.freeze([
  Object.freeze({ value: "general-diy", label: "General DIY / non-structural", regulated: false }),
  Object.freeze({ value: "structural", label: "Structural or load-bearing", regulated: true }),
  Object.freeze({ value: "regulated-trade", label: "Electrical, plumbing, gas, or HVAC", regulated: true }),
  Object.freeze({ value: "vehicle-safety", label: "Vehicle safety system", regulated: true }),
]);
export const SAFETY_BOUNDARIES = Object.freeze([
  "Planning estimates are not engineering drawings, permit documents, or code approval.",
  "Structural, utility, gas, electrical, HVAC, and vehicle-safety work requires qualified professional review before work begins.",
  "Verify site conditions, manufacturer instructions, local codes, load ratings, and utility isolation before purchasing or cutting material.",
]);

// # Numeric helpers
function readNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decimalFraction(value) {
  const source = String(value).trim().toLowerCase();
  const match = source.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/);
  if (!match || !Number.isFinite(Number(value))) throw new TypeError("Currency value must be finite.");

  const sign = match[1] === "-" ? -1n : 1n;
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? 0) - fraction.length;
  const digits = BigInt(`${match[2]}${fraction}` || "0");
  return exponent >= 0
    ? { numerator: sign * digits * (10n ** BigInt(exponent)), denominator: 1n }
    : { numerator: sign * digits, denominator: 10n ** BigInt(-exponent) };
}

function divideHalfUp(numerator, denominator) {
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

function currencyCents(value) {
  const fraction = decimalFraction(value);
  return divideHalfUp(fraction.numerator * 100n, fraction.denominator);
}

function multiplyCurrency(...values) {
  const fraction = values.reduce(
    (product, value) => {
      const next = decimalFraction(value);
      return {
        numerator: product.numerator * next.numerator,
        denominator: product.denominator * next.denominator,
      };
    },
    { numerator: 1n, denominator: 1n },
  );
  return Number(divideHalfUp(fraction.numerator * 100n, fraction.denominator)) / 100;
}

export function roundCurrency(value) {
  return Number(currencyCents(value)) / 100;
}

export function roundQuantity(value) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

function validateText(errors, value, path, label, maxLength = 240) {
  const text = String(value ?? "").trim();
  if (!text) addError(errors, path, `Enter ${label}.`);
  else if (text.length > maxLength) addError(errors, path, `${label} must be ${maxLength} characters or fewer.`);
}

function isBounded(value, minimum, maximum) {
  return value !== null && value >= minimum && value <= maximum;
}

function workCategory(value) {
  return WORK_CATEGORIES.find((item) => item.value === value) ?? null;
}

// # Scope validation
export function validateScope(scope = {}) {
  const errors = [];
  validateText(errors, scope.projectName, "scope.projectName", "a project name", 120);
  validateText(errors, scope.finalDimensions, "scope.finalDimensions", "the final dimensions");
  validateText(errors, scope.intendedUse, "scope.intendedUse", "the intended use");
  validateText(errors, scope.materialTypes, "scope.materialTypes", "the intended material types");
  if (String(scope.aestheticRequirements ?? "").length > 240) {
    addError(errors, "scope.aestheticRequirements", "Aesthetic requirements must be 240 characters or fewer.");
  }

  const category = workCategory(scope.workCategory);
  if (!category) {
    addError(errors, "scope.workCategory", "Choose a work category.");
  } else if (category.regulated && scope.professionalReviewConfirmed !== true) {
    addError(
      errors,
      "scope.professionalReviewConfirmed",
      "Confirm that qualified professional review is required before regulated work begins.",
    );
  }
  return errors;
}

// # Row validation
export function validateMaterial(material = {}, index = 0) {
  const errors = [];
  const path = `materials.${index}`;
  const quantity = readNumber(material.quantity);
  const wastePercent = readNumber(material.wastePercent);
  const packageQuantity = readNumber(material.packageQuantity);
  const packagePrice = readNumber(material.packagePrice);

  validateText(errors, material.name, `${path}.name`, "a material name", 120);
  if (!MATERIAL_UNITS.includes(material.unit)) addError(errors, `${path}.unit`, "Choose a supported measurement unit.");
  if (!isBounded(quantity, 0.0001, LIMITS.maxQuantity)) addError(errors, `${path}.quantity`, `Required quantity must be between 0.0001 and ${LIMITS.maxQuantity}.`);
  if (!isBounded(wastePercent, 0, 100)) addError(errors, `${path}.wastePercent`, "Waste must be between 0% and 100%.");
  if (!isBounded(packageQuantity, 0.0001, LIMITS.maxQuantity)) addError(errors, `${path}.packageQuantity`, `Package quantity must be between 0.0001 and ${LIMITS.maxQuantity}.`);
  if (!isBounded(packagePrice, 0, LIMITS.maxMoney)) addError(errors, `${path}.packagePrice`, `Package price must be between $0 and $${LIMITS.maxMoney}.`);

  if (errors.length === 0) {
    const packages = Math.ceil((quantity * (1 + wastePercent / 100)) / packageQuantity);
    const lineTotal = packages * packagePrice;
    if (!Number.isFinite(lineTotal) || lineTotal > LIMITS.maxProjectTotal) {
      addError(errors, `${path}.packagePrice`, "Calculated material total exceeds the supported project limit.");
    }
  }
  return errors;
}

export function validateLabor(labor = {}, index = 0) {
  const errors = [];
  const path = `labor.${index}`;
  const hours = readNumber(labor.hours);
  const hourlyRate = readNumber(labor.hourlyRate);
  validateText(errors, labor.description, `${path}.description`, "a labor description", 120);
  if (!isBounded(hours, 0.0001, LIMITS.maxHours)) addError(errors, `${path}.hours`, `Labor hours must be between 0.0001 and ${LIMITS.maxHours}.`);
  if (!isBounded(hourlyRate, 0, LIMITS.maxRate)) addError(errors, `${path}.hourlyRate`, `Hourly rate must be between $0 and $${LIMITS.maxRate}.`);
  if (errors.length === 0 && hours * hourlyRate > LIMITS.maxProjectTotal) {
    addError(errors, `${path}.hourlyRate`, "Calculated labor total exceeds the supported project limit.");
  }
  return errors;
}

export function validateOtherCost(cost = {}, index = 0) {
  const errors = [];
  const path = `otherCosts.${index}`;
  const amount = readNumber(cost.amount);
  validateText(errors, cost.description, `${path}.description`, "a cost description", 120);
  if (!isBounded(amount, 0, LIMITS.maxMoney)) addError(errors, `${path}.amount`, `Cost must be between $0 and $${LIMITS.maxMoney}.`);
  return errors;
}

export function validateCutItem(item = {}, index = 0) {
  const errors = [];
  const path = `cutList.${index}`;
  const quantity = readNumber(item.quantity);
  const finishedLength = readNumber(item.finishedLength);
  const kerfPerCut = readNumber(item.kerfPerCut);
  const cutsPerPart = readNumber(item.cutsPerPart);

  validateText(errors, item.name, `${path}.name`, "a cut-part name", 120);
  if (!Number.isInteger(quantity) || !isBounded(quantity, 1, LIMITS.maxQuantity)) addError(errors, `${path}.quantity`, `Part quantity must be a whole number from 1 to ${LIMITS.maxQuantity}.`);
  if (!CUT_UNITS.includes(item.unit)) addError(errors, `${path}.unit`, "Choose a supported linear unit.");
  if (!isBounded(finishedLength, 0.0001, LIMITS.maxQuantity)) addError(errors, `${path}.finishedLength`, `Finished length must be between 0.0001 and ${LIMITS.maxQuantity}.`);
  if (!isBounded(kerfPerCut, 0, LIMITS.maxQuantity)) addError(errors, `${path}.kerfPerCut`, `Kerf per cut must be between 0 and ${LIMITS.maxQuantity}.`);
  if (!Number.isInteger(cutsPerPart) || !isBounded(cutsPerPart, 1, LIMITS.maxCutsPerPart)) addError(errors, `${path}.cutsPerPart`, `Cuts per part must be a whole number from 1 to ${LIMITS.maxCutsPerPart}.`);
  if (!GRAIN_ORIENTATIONS.includes(item.grainOrientation)) addError(errors, `${path}.grainOrientation`, "Choose a grain orientation.");

  if (errors.length === 0) {
    const stockLength = quantity * finishedLength + quantity * cutsPerPart * kerfPerCut;
    if (!Number.isFinite(stockLength) || stockLength > LIMITS.maxCalculatedQuantity) {
      addError(errors, `${path}.finishedLength`, "Calculated stock length exceeds the supported quantity limit.");
    }
  }
  return errors;
}

export function validateToolItem(item = {}, index = 0) {
  const errors = [];
  const path = `tools.${index}`;
  validateText(errors, item.name, `${path}.name`, "a tool or safety item", 120);
  if (!TOOL_CATEGORIES.includes(item.category)) addError(errors, `${path}.category`, "Choose a checklist category.");
  return errors;
}

export function validateBuildStep(item = {}, index = 0) {
  const errors = [];
  const path = `buildSteps.${index}`;
  if (!BUILD_PHASES.includes(item.phase)) addError(errors, `${path}.phase`, "Choose a build phase.");
  validateText(errors, item.instruction, `${path}.instruction`, "a build instruction", 300);
  return errors;
}

// # Plan validation
function validateCollection(errors, plan, name, label) {
  if (plan[name] !== undefined && !Array.isArray(plan[name])) {
    addError(errors, name, `${label} must be a list.`);
    return [];
  }
  const rows = plan[name] ?? [];
  if (rows.length > LIMITS.maxRows) addError(errors, name, `${label} cannot contain more than ${LIMITS.maxRows} rows.`);
  return rows.slice(0, LIMITS.maxRows);
}

function validateBuildOrder(errors, buildSteps) {
  let priorPhase = -1;
  let dryFitSeen = false;
  buildSteps.forEach((item, index) => {
    const phase = BUILD_PHASES.indexOf(item.phase);
    if (phase !== -1 && phase < priorPhase) addError(errors, `buildSteps.${index}.phase`, "Build phases must stay in chronological order.");
    if (phase !== -1) priorPhase = Math.max(priorPhase, phase);
    if (item.dryFitCheckpoint && phase <= BUILD_PHASES.indexOf("joinery and dry-fit")) dryFitSeen = true;
    if (item.phase === "structural assembly" && !dryFitSeen) {
      addError(errors, `buildSteps.${index}.dryFitCheckpoint`, "Add a dry-fit checkpoint before structural assembly.");
    }
  });
}

function createWarnings({ materials, cutList, tools, buildSteps }) {
  const warnings = [];
  if (materials.length === 0) warnings.push({ path: "materials", message: "Add materials to create a bill of materials." });
  if (cutList.length === 0) warnings.push({ path: "cutList", message: "No cut list is included; confirm that the project requires no cut parts." });
  if (tools.length === 0) warnings.push({ path: "tools", message: "Add required tools and personal protective equipment." });
  else if (!tools.some((item) => item.category === "safety / PPE")) warnings.push({ path: "tools", message: "No personal protective equipment is listed." });
  if (buildSteps.length === 0) warnings.push({ path: "buildSteps", message: "Add a chronological assembly and finishing plan." });
  BUILD_PHASES.forEach((phase) => {
    if (buildSteps.length > 0 && !buildSteps.some((item) => item.phase === phase)) warnings.push({ path: "buildSteps", message: `No ${phase} step is included.` });
  });
  return warnings;
}

export function validateProjectPlan(plan = {}) {
  const errors = [...validateScope(plan.scope)];
  const materials = validateCollection(errors, plan, "materials", "Materials");
  const cutList = validateCollection(errors, plan, "cutList", "Cut list");
  const tools = validateCollection(errors, plan, "tools", "Tools");
  const buildSteps = validateCollection(errors, plan, "buildSteps", "Build steps");
  const labor = validateCollection(errors, plan, "labor", "Labor");
  const otherCosts = validateCollection(errors, plan, "otherCosts", "Other costs");

  materials.forEach((item, index) => errors.push(...validateMaterial(item, index)));
  cutList.forEach((item, index) => errors.push(...validateCutItem(item, index)));
  tools.forEach((item, index) => errors.push(...validateToolItem(item, index)));
  buildSteps.forEach((item, index) => errors.push(...validateBuildStep(item, index)));
  labor.forEach((item, index) => errors.push(...validateLabor(item, index)));
  otherCosts.forEach((item, index) => errors.push(...validateOtherCost(item, index)));
  validateBuildOrder(errors, buildSteps);

  const budget = readNumber(plan.budget);
  if (plan.budget !== "" && plan.budget !== null && plan.budget !== undefined && !isBounded(budget, 0, LIMITS.maxBudget)) {
    addError(errors, "budget", `Budget must be between $0 and $${LIMITS.maxBudget}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: createWarnings({ materials, cutList, tools, buildSteps }),
  };
}

// # Deterministic calculation
export function calculateMaterial(material) {
  const errors = validateMaterial(material, 0);
  if (errors.length) throw new TypeError(errors.map((error) => error.message).join(" "));
  const requiredQuantity = Number(material.quantity);
  const wastePercent = Number(material.wastePercent);
  const packageQuantity = Number(material.packageQuantity);
  const packagePrice = Number(material.packagePrice);
  const rawQuantityWithWaste = requiredQuantity * (1 + wastePercent / 100);
  const quantityWithWaste = roundQuantity(rawQuantityWithWaste);
  // Purchase against the unrounded requirement so display rounding never under-orders stock.
  const packagesRequired = Math.ceil(rawQuantityWithWaste / packageQuantity);
  const purchasedQuantity = roundQuantity(packagesRequired * packageQuantity);
  return {
    id: material.id,
    name: String(material.name).trim(),
    unit: material.unit,
    requiredQuantity: roundQuantity(requiredQuantity),
    wastePercent,
    quantityWithWaste,
    packageQuantity: roundQuantity(packageQuantity),
    packagePrice: roundCurrency(packagePrice),
    packagesRequired,
    purchasedQuantity,
    excessQuantity: roundQuantity(purchasedQuantity - quantityWithWaste),
    lineTotal: multiplyCurrency(packagesRequired, material.packagePrice),
  };
}

export function calculateCutItem(item) {
  const errors = validateCutItem(item, 0);
  if (errors.length) throw new TypeError(errors.map((error) => error.message).join(" "));
  const quantity = Number(item.quantity);
  const finishedLength = Number(item.finishedLength);
  const kerfPerCut = Number(item.kerfPerCut);
  const cutsPerPart = Number(item.cutsPerPart);
  const totalFinishedLength = roundQuantity(quantity * finishedLength);
  const totalKerfAllowance = roundQuantity(quantity * cutsPerPart * kerfPerCut);
  return {
    id: item.id,
    name: String(item.name).trim(),
    quantity,
    unit: item.unit,
    finishedLength: roundQuantity(finishedLength),
    cutsPerPart,
    kerfPerCut: roundQuantity(kerfPerCut),
    grainOrientation: item.grainOrientation,
    totalFinishedLength,
    totalKerfAllowance,
    totalStockLength: roundQuantity(totalFinishedLength + totalKerfAllowance),
  };
}

function safeTotal(values, path) {
  const totalCents = values.reduce((sum, value) => sum + currencyCents(value), 0n);
  if (totalCents > BigInt(LIMITS.maxProjectTotal) * 100n) {
    return { error: { path, message: "Calculated total exceeds the supported project limit." } };
  }
  return { value: Number(totalCents) / 100, cents: totalCents };
}

export function calculateProjectPlan(plan = {}) {
  const validation = validateProjectPlan(plan);
  if (!validation.valid) return { ok: false, errors: validation.errors, warnings: validation.warnings };

  const materials = (plan.materials ?? []).map(calculateMaterial);
  const cutList = (plan.cutList ?? []).map(calculateCutItem);
  const tools = (plan.tools ?? []).map((item) => ({ id: item.id, name: String(item.name).trim(), category: item.category, staged: Boolean(item.staged) }));
  const buildSteps = (plan.buildSteps ?? []).map((item, index) => ({ id: item.id, order: index + 1, phase: item.phase, instruction: String(item.instruction).trim(), dryFitCheckpoint: Boolean(item.dryFitCheckpoint) }));
  const labor = (plan.labor ?? []).map((item) => ({ id: item.id, description: String(item.description).trim(), hours: roundQuantity(Number(item.hours)), hourlyRate: roundCurrency(item.hourlyRate), lineTotal: multiplyCurrency(item.hours, item.hourlyRate) }));
  const otherCosts = (plan.otherCosts ?? []).map((item) => ({ id: item.id, description: String(item.description).trim(), amount: roundCurrency(Number(item.amount)) }));

  const materialTotal = safeTotal(materials.map((item) => item.lineTotal), "materials");
  const laborTotal = safeTotal(labor.map((item) => item.lineTotal), "labor");
  const otherTotal = safeTotal(otherCosts.map((item) => item.amount), "otherCosts");
  const subtotalError = materialTotal.error ?? laborTotal.error ?? otherTotal.error;
  if (subtotalError) return { ok: false, errors: [subtotalError], warnings: validation.warnings };
  const grandTotal = safeTotal([materialTotal.value, laborTotal.value, otherTotal.value], "totals.total");
  if (grandTotal.error) return { ok: false, errors: [grandTotal.error], warnings: validation.warnings };

  const budget = readNumber(plan.budget);
  const budgetCents = budget === null ? null : currencyCents(plan.budget);
  const category = workCategory(plan.scope.workCategory);
  const total = grandTotal.value;
  return {
    ok: true,
    scope: {
      projectName: String(plan.scope.projectName).trim(),
      finalDimensions: String(plan.scope.finalDimensions).trim(),
      intendedUse: String(plan.scope.intendedUse).trim(),
      aestheticRequirements: String(plan.scope.aestheticRequirements ?? "").trim(),
      materialTypes: String(plan.scope.materialTypes).trim(),
      workCategory: category.value,
      workCategoryLabel: category.label,
    },
    safety: {
      regulated: category.regulated,
      professionalReviewConfirmed: Boolean(plan.scope.professionalReviewConfirmed),
      boundaries: [...SAFETY_BOUNDARIES],
    },
    materials,
    cutList,
    tools,
    buildSteps,
    labor,
    otherCosts,
    warnings: validation.warnings,
    totals: {
      materialSubtotal: materialTotal.value,
      laborSubtotal: laborTotal.value,
      otherSubtotal: otherTotal.value,
      total,
      budget: budgetCents === null ? null : Number(budgetCents) / 100,
      budgetDifference: budgetCents === null ? null : Number(budgetCents - grandTotal.cents) / 100,
      overBudget: budgetCents === null ? null : grandTotal.cents > budgetCents,
    },
  };
}

// # Deterministic export
export function serializeProjectPlan(plan) {
  const result = calculateProjectPlan(plan);
  if (!result.ok) throw new TypeError("Cannot export an invalid project plan.");
  return `${JSON.stringify({ schemaVersion: 1, tool: TOOL_MANIFEST.key, plan: result }, null, 2)}\n`;
}
