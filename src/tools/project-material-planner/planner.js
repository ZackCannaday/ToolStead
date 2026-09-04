// # Planner contract
export const TOOL_MANIFEST = Object.freeze({
  key: "project-material-planner",
  name: "Project Material Planner",
  category: "Operations",
  description:
    "Plan material purchases, package quantities, labor, and project costs without converting between measurement units.",
  version: "1.0.0",
  capabilities: Object.freeze([
    "Project scope and dimensions",
    "Material quantity planning",
    "Waste allowance",
    "Package rounding",
    "Cut list with kerf allowance",
    "Tool and safety checklist",
    "Chronological build sequence",
    "Labor costing",
    "Other project costs",
    "Budget comparison",
  ]),
});

export const MATERIAL_UNITS = Object.freeze([
  "each",
  "in",
  "ft",
  "yd",
  "mm",
  "cm",
  "m",
  "sq in",
  "sq ft",
  "sq yd",
  "sq m",
  "cu ft",
  "board ft",
  "oz",
  "lb",
  "g",
  "kg",
  "fl oz",
  "pt",
  "qt",
  "gal",
  "ml",
  "l",
]);

export const CUT_UNITS = Object.freeze(["in", "ft", "mm", "cm", "m"]);
export const GRAIN_ORIENTATIONS = Object.freeze([
  "not applicable",
  "lengthwise",
  "crosswise",
  "match adjacent",
]);
export const TOOL_CATEGORIES = Object.freeze([
  "cutting",
  "shaping",
  "routing",
  "fastening",
  "sanding",
  "safety / PPE",
]);
export const BUILD_PHASES = Object.freeze([
  "material prep",
  "joinery and dry-fit",
  "structural assembly",
  "surface prep and finishing",
]);

// # Numeric helpers
function readNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundQuantity(value) {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

function addError(errors, path, message) {
  errors.push({ path, message });
}

// # Input validation
export function validateMaterial(material = {}, index = 0) {
  const errors = [];
  const path = `materials.${index}`;
  const quantity = readNumber(material.quantity);
  const wastePercent = readNumber(material.wastePercent);
  const packageQuantity = readNumber(material.packageQuantity);
  const packagePrice = readNumber(material.packagePrice);

  if (!String(material.name ?? "").trim()) {
    addError(errors, `${path}.name`, "Enter a material name.");
  }
  if (!MATERIAL_UNITS.includes(material.unit)) {
    addError(errors, `${path}.unit`, "Choose a supported measurement unit.");
  }
  if (quantity === null || quantity <= 0) {
    addError(errors, `${path}.quantity`, "Required quantity must be greater than zero.");
  }
  if (wastePercent === null || wastePercent < 0 || wastePercent > 100) {
    addError(errors, `${path}.wastePercent`, "Waste must be between 0% and 100%.");
  }
  if (packageQuantity === null || packageQuantity <= 0) {
    addError(errors, `${path}.packageQuantity`, "Package quantity must be greater than zero.");
  }
  if (packagePrice === null || packagePrice < 0) {
    addError(errors, `${path}.packagePrice`, "Package price cannot be negative.");
  }

  return errors;
}

export function validateLabor(labor = {}, index = 0) {
  const errors = [];
  const path = `labor.${index}`;
  const hours = readNumber(labor.hours);
  const hourlyRate = readNumber(labor.hourlyRate);

  if (!String(labor.description ?? "").trim()) {
    addError(errors, `${path}.description`, "Enter a labor description.");
  }
  if (hours === null || hours <= 0) {
    addError(errors, `${path}.hours`, "Labor hours must be greater than zero.");
  }
  if (hourlyRate === null || hourlyRate < 0) {
    addError(errors, `${path}.hourlyRate`, "Hourly rate cannot be negative.");
  }

  return errors;
}

export function validateOtherCost(cost = {}, index = 0) {
  const errors = [];
  const path = `otherCosts.${index}`;
  const amount = readNumber(cost.amount);

  if (!String(cost.description ?? "").trim()) {
    addError(errors, `${path}.description`, "Enter a cost description.");
  }
  if (amount === null || amount < 0) {
    addError(errors, `${path}.amount`, "Cost cannot be negative.");
  }

  return errors;
}

export function validateCutItem(item = {}, index = 0) {
  const errors = [];
  const path = `cutList.${index}`;
  const quantity = readNumber(item.quantity);
  const finishedLength = readNumber(item.finishedLength);
  const kerfPerCut = readNumber(item.kerfPerCut);
  const cutsPerPart = readNumber(item.cutsPerPart);

  if (!String(item.name ?? "").trim()) {
    addError(errors, `${path}.name`, "Enter a cut-part name.");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    addError(errors, `${path}.quantity`, "Part quantity must be a whole number greater than zero.");
  }
  if (!CUT_UNITS.includes(item.unit)) {
    addError(errors, `${path}.unit`, "Choose a supported linear unit.");
  }
  if (finishedLength === null || finishedLength <= 0) {
    addError(errors, `${path}.finishedLength`, "Finished length must be greater than zero.");
  }
  if (kerfPerCut === null || kerfPerCut < 0) {
    addError(errors, `${path}.kerfPerCut`, "Kerf per cut cannot be negative.");
  }
  if (!Number.isInteger(cutsPerPart) || cutsPerPart <= 0) {
    addError(errors, `${path}.cutsPerPart`, "Cuts per part must be a whole number greater than zero.");
  }
  if (!GRAIN_ORIENTATIONS.includes(item.grainOrientation)) {
    addError(errors, `${path}.grainOrientation`, "Choose a grain orientation.");
  }
  return errors;
}

export function validateToolItem(item = {}, index = 0) {
  const errors = [];
  const path = `tools.${index}`;
  if (!String(item.name ?? "").trim()) {
    addError(errors, `${path}.name`, "Enter a tool or safety item.");
  }
  if (!TOOL_CATEGORIES.includes(item.category)) {
    addError(errors, `${path}.category`, "Choose a checklist category.");
  }
  return errors;
}

export function validateBuildStep(item = {}, index = 0) {
  const errors = [];
  const path = `buildSteps.${index}`;
  if (!BUILD_PHASES.includes(item.phase)) {
    addError(errors, `${path}.phase`, "Choose a build phase.");
  }
  if (!String(item.instruction ?? "").trim()) {
    addError(errors, `${path}.instruction`, "Enter a build instruction.");
  }
  return errors;
}

export function validateProjectPlan(plan = {}) {
  const errors = [];
  const materials = Array.isArray(plan.materials) ? plan.materials : [];
  const labor = Array.isArray(plan.labor) ? plan.labor : [];
  const otherCosts = Array.isArray(plan.otherCosts) ? plan.otherCosts : [];
  const cutList = Array.isArray(plan.cutList) ? plan.cutList : [];
  const tools = Array.isArray(plan.tools) ? plan.tools : [];
  const buildSteps = Array.isArray(plan.buildSteps) ? plan.buildSteps : [];
  const budget = readNumber(plan.budget);

  if (plan.materials !== undefined && !Array.isArray(plan.materials)) {
    addError(errors, "materials", "Materials must be a list.");
  }
  if (plan.labor !== undefined && !Array.isArray(plan.labor)) {
    addError(errors, "labor", "Labor must be a list.");
  }
  if (plan.otherCosts !== undefined && !Array.isArray(plan.otherCosts)) {
    addError(errors, "otherCosts", "Other costs must be a list.");
  }
  if (plan.cutList !== undefined && !Array.isArray(plan.cutList)) {
    addError(errors, "cutList", "Cut list must be a list.");
  }
  if (plan.tools !== undefined && !Array.isArray(plan.tools)) {
    addError(errors, "tools", "Tools must be a list.");
  }
  if (plan.buildSteps !== undefined && !Array.isArray(plan.buildSteps)) {
    addError(errors, "buildSteps", "Build steps must be a list.");
  }

  materials.forEach((item, index) => errors.push(...validateMaterial(item, index)));
  labor.forEach((item, index) => errors.push(...validateLabor(item, index)));
  otherCosts.forEach((item, index) => errors.push(...validateOtherCost(item, index)));
  cutList.forEach((item, index) => errors.push(...validateCutItem(item, index)));
  tools.forEach((item, index) => errors.push(...validateToolItem(item, index)));
  buildSteps.forEach((item, index) => errors.push(...validateBuildStep(item, index)));

  if (plan.budget !== "" && plan.budget !== null && plan.budget !== undefined) {
    if (budget === null || budget < 0) {
      addError(errors, "budget", "Budget cannot be negative.");
    }
  }

  return { valid: errors.length === 0, errors };
}

// # Cost calculation
export function calculateMaterial(material) {
  const errors = validateMaterial(material, 0);
  if (errors.length) {
    throw new TypeError(errors.map((error) => error.message).join(" "));
  }

  const requiredQuantity = Number(material.quantity);
  const wastePercent = Number(material.wastePercent);
  const packageQuantity = Number(material.packageQuantity);
  const packagePrice = Number(material.packagePrice);
  const quantityWithWaste = roundQuantity(
    requiredQuantity * (1 + wastePercent / 100),
  );
  const packagesRequired = Math.ceil(quantityWithWaste / packageQuantity);
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
    lineTotal: roundCurrency(packagesRequired * packagePrice),
  };
}

export function calculateCutItem(item) {
  const errors = validateCutItem(item, 0);
  if (errors.length) {
    throw new TypeError(errors.map((error) => error.message).join(" "));
  }
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

export function calculateProjectPlan(plan = {}) {
  const validation = validateProjectPlan(plan);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const materials = (plan.materials ?? []).map(calculateMaterial);
  const cutList = (plan.cutList ?? []).map(calculateCutItem);
  const tools = (plan.tools ?? []).map((item) => ({
    id: item.id,
    name: String(item.name).trim(),
    category: item.category,
    staged: Boolean(item.staged),
  }));
  const buildSteps = (plan.buildSteps ?? []).map((item, index) => ({
    id: item.id,
    order: index + 1,
    phase: item.phase,
    instruction: String(item.instruction).trim(),
    dryFitCheckpoint: Boolean(item.dryFitCheckpoint),
  }));
  const labor = (plan.labor ?? []).map((item) => ({
    id: item.id,
    description: String(item.description).trim(),
    hours: roundQuantity(Number(item.hours)),
    hourlyRate: roundCurrency(Number(item.hourlyRate)),
    lineTotal: roundCurrency(Number(item.hours) * Number(item.hourlyRate)),
  }));
  const otherCosts = (plan.otherCosts ?? []).map((item) => ({
    id: item.id,
    description: String(item.description).trim(),
    amount: roundCurrency(Number(item.amount)),
  }));

  const materialSubtotal = roundCurrency(
    materials.reduce((sum, item) => sum + item.lineTotal, 0),
  );
  const laborSubtotal = roundCurrency(
    labor.reduce((sum, item) => sum + item.lineTotal, 0),
  );
  const otherSubtotal = roundCurrency(
    otherCosts.reduce((sum, item) => sum + item.amount, 0),
  );
  const total = roundCurrency(materialSubtotal + laborSubtotal + otherSubtotal);
  const budget = readNumber(plan.budget);

  return {
    ok: true,
    scope: {
      projectName: String(plan.scope?.projectName ?? "").trim(),
      finalDimensions: String(plan.scope?.finalDimensions ?? "").trim(),
      intendedUse: String(plan.scope?.intendedUse ?? "").trim(),
      aestheticRequirements: String(plan.scope?.aestheticRequirements ?? "").trim(),
      materialTypes: String(plan.scope?.materialTypes ?? "").trim(),
    },
    materials,
    cutList,
    tools,
    buildSteps,
    labor,
    otherCosts,
    totals: {
      materialSubtotal,
      laborSubtotal,
      otherSubtotal,
      total,
      budget: budget === null ? null : roundCurrency(budget),
      budgetDifference:
        budget === null ? null : roundCurrency(Number(budget) - total),
      overBudget: budget === null ? null : total > Number(budget),
    },
  };
}
