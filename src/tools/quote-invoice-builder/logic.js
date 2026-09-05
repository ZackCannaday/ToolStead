// # Financial limits
export const MONEY_SCALE = 100;
export const QUANTITY_SCALE = 1_000;
export const RATE_SCALE = 10_000;
export const MAX_MONEY_CENTS = 100_000_000_000;
export const DOCUMENT_KINDS = Object.freeze([
  "quote",
  "proposal",
  "invoice",
  "change_order",
]);

export { TOOL_MANIFEST } from "./manifest.js";

export class QuoteValidationError extends Error {
  constructor(errors) {
    super("The client document contains invalid data.");
    this.name = "QuoteValidationError";
    this.errors = errors;
  }
}

// # Decimal parsing
function parseScaledInteger(value, decimalPlaces, label) {
  const source = typeof value === "number" ? String(value) : String(value ?? "").trim();
  const pattern = new RegExp(`^(?:0|[1-9]\\d*)(?:\\.(\\d{1,${decimalPlaces}}))?$`);
  const match = source.match(pattern);

  if (!match) {
    throw new RangeError(`${label} must be a non-negative decimal with no more than ${decimalPlaces} decimal places.`);
  }

  const [whole] = source.split(".");
  const fraction = (match[1] ?? "").padEnd(decimalPlaces, "0");
  const scale = 10n ** BigInt(decimalPlaces);
  const scaled = BigInt(whole) * scale + BigInt(fraction || "0");

  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} is too large.`);
  }

  return Number(scaled);
}

export function parseMoneyToCents(value, label = "Amount") {
  const cents = parseScaledInteger(value, 2, label);
  if (cents > MAX_MONEY_CENTS) {
    throw new RangeError(`${label} must be $1,000,000,000 or less.`);
  }
  return cents;
}

export function parseQuantity(value, label = "Quantity") {
  return parseScaledInteger(value, 3, label);
}

export function parsePercentToBasisPoints(value, label = "Rate") {
  const basisPoints = parseScaledInteger(value, 2, label);
  if (basisPoints > RATE_SCALE) {
    throw new RangeError(`${label} must be between 0% and 100%.`);
  }
  return basisPoints;
}

// # Integer rounding
function divideRoundedHalfUp(numerator, denominator) {
  const amount = BigInt(numerator);
  const divisor = BigInt(denominator);
  const quotient = amount / divisor;
  const remainder = amount % divisor;
  return Number(quotient + (remainder * 2n >= divisor ? 1n : 0n));
}

function assertMoneyLimit(cents, label) {
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) {
    throw new RangeError(`${label} exceeds the supported $1,000,000,000 limit.`);
  }
  return cents;
}

function calculateAdjustment(baseCents, adjustment, label) {
  if (!adjustment || adjustment.type === "none" || String(adjustment.value ?? "0") === "0") {
    return 0;
  }

  if (adjustment.type === "fixed") {
    return parseMoneyToCents(adjustment.value, label);
  }

  if (adjustment.type === "percent") {
    const basisPoints = parsePercentToBasisPoints(adjustment.value, label);
    return divideRoundedHalfUp(BigInt(baseCents) * BigInt(basisPoints), RATE_SCALE);
  }

  throw new RangeError(`${label} type must be none, fixed, or percent.`);
}

// # Calculation validation
export function validateCalculationInput(input = {}) {
  const errors = [];
  const items = Array.isArray(input.items) ? input.items : [];

  if (items.length === 0) {
    errors.push({ path: "items", message: "Add at least one line item." });
  }

  items.forEach((item, index) => {
    const prefix = `items.${index}`;
    if (!String(item?.description ?? "").trim()) {
      errors.push({ path: `${prefix}.description`, message: "Enter a clear line-item description." });
    }
    try {
      const quantity = parseQuantity(item?.quantity, "Quantity");
      if (quantity === 0) {
        errors.push({ path: `${prefix}.quantity`, message: "Quantity must be greater than zero." });
      }
    } catch (error) {
      errors.push({ path: `${prefix}.quantity`, message: error.message });
    }
    try {
      parseMoneyToCents(item?.unitPrice, "Unit price");
    } catch (error) {
      errors.push({ path: `${prefix}.unitPrice`, message: error.message });
    }
  });

  try {
    parsePercentToBasisPoints(input.taxRate ?? "0", "Tax rate");
  } catch (error) {
    errors.push({ path: "taxRate", message: error.message });
  }

  for (const [path, adjustment, label] of [
    ["discount", input.discount, "Discount"],
    ["processingFee", input.processingFee, "Processing fee"],
    ["deposit", input.deposit, "Deposit"],
  ]) {
    if (!adjustment || adjustment.type === "none") continue;
    try {
      if (adjustment.type === "percent") {
        parsePercentToBasisPoints(adjustment.value, label);
      } else if (adjustment.type === "fixed") {
        parseMoneyToCents(adjustment.value, label);
      } else {
        throw new RangeError(`${label} type must be none, fixed, or percent.`);
      }
    } catch (error) {
      errors.push({ path, message: error.message });
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

// # Money calculations
export function calculateQuoteTotals(input = {}) {
  const validation = validateCalculationInput(input);
  if (!validation.valid) throw new QuoteValidationError(validation.errors);

  const lineItems = input.items.map((item, index) => {
    const quantity = parseQuantity(item.quantity);
    const unitPriceCents = parseMoneyToCents(item.unitPrice);
    const lineTotalCents = assertMoneyLimit(
      divideRoundedHalfUp(BigInt(quantity) * BigInt(unitPriceCents), QUANTITY_SCALE),
      `Line ${index + 1} total`,
    );

    return Object.freeze({
      id: String(item.id ?? index + 1),
      description: String(item.description).trim(),
      quantity: String(item.quantity),
      quantityScaled: quantity,
      unitPriceCents,
      lineTotalCents,
      taxable: item.taxable !== false,
      included: item.included !== false,
    });
  });

  const includedItems = lineItems.filter((item) => item.included);
  const subtotalCents = assertMoneyLimit(
    includedItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
    "Subtotal",
  );
  const taxableSubtotalCents = includedItems
    .filter((item) => item.taxable)
    .reduce((sum, item) => sum + item.lineTotalCents, 0);
  const discountCents = calculateAdjustment(subtotalCents, input.discount, "Discount");

  if (discountCents > subtotalCents) {
    throw new QuoteValidationError([
      { path: "discount", message: "Discount cannot exceed the included-item subtotal." },
    ]);
  }

  const discountedSubtotalCents = subtotalCents - discountCents;
  const taxableDiscountCents = subtotalCents === 0
    ? 0
    : divideRoundedHalfUp(
        BigInt(discountCents) * BigInt(taxableSubtotalCents),
        subtotalCents,
      );
  const taxableBaseCents = taxableSubtotalCents - taxableDiscountCents;
  const taxRateBasisPoints = parsePercentToBasisPoints(input.taxRate ?? "0", "Tax rate");
  const taxCents = assertMoneyLimit(
    divideRoundedHalfUp(BigInt(taxableBaseCents) * BigInt(taxRateBasisPoints), RATE_SCALE),
    "Tax",
  );
  const preFeeTotalCents = assertMoneyLimit(discountedSubtotalCents + taxCents, "Pre-fee total");
  const processingFeeCents = calculateAdjustment(
    preFeeTotalCents,
    input.processingFee,
    "Processing fee",
  );
  const totalCents = assertMoneyLimit(preFeeTotalCents + processingFeeCents, "Total");
  const depositCents = calculateAdjustment(totalCents, input.deposit, "Deposit");

  if (depositCents > totalCents) {
    throw new QuoteValidationError([
      { path: "deposit", message: "Deposit cannot exceed the document total." },
    ]);
  }

  return Object.freeze({
    currency: "USD",
    lineItems: Object.freeze(lineItems),
    subtotalCents,
    taxableSubtotalCents,
    discountCents,
    discountedSubtotalCents,
    taxableDiscountCents,
    taxableBaseCents,
    taxRateBasisPoints,
    taxCents,
    processingFeeCents,
    totalCents,
    depositCents,
    balanceDueCents: totalCents - depositCents,
  });
}

// # Document validation
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function usesExpiration(kind) {
  return kind === "quote" || kind === "proposal";
}

function getDocumentContract(kind) {
  if (typeof kind !== "string" || !DOCUMENT_KINDS.includes(kind)) return null;
  const expiration = usesExpiration(kind);
  return Object.freeze({
    kind,
    deadlinePath: expiration ? "expiresOn" : "dueDate",
    deadlineMessage: expiration
      ? "Enter a valid expiration date."
      : "Enter a valid payment due date.",
  });
}

function validateDraftAgainstContract(draft, contract) {
  const errors = [...validateCalculationInput(draft).errors];
  if (!contract) {
    errors.push({
      path: "kind",
      message: "Choose quote, proposal, invoice, or change order.",
    });
  }
  const requiredText = [
    ["business.name", draft.business?.name, "Enter your business name."],
    ["client.name", draft.client?.name, "Enter the client name."],
    ["documentNumber", draft.documentNumber, "Enter a document number."],
  ];

  requiredText.forEach(([path, value, message]) => {
    if (!String(value ?? "").trim()) errors.push({ path, message });
  });

  if (!isValidDate(draft.issueDate)) {
    errors.push({ path: "issueDate", message: "Enter a valid issue date." });
  }

  if (contract) {
    const deadline = draft[contract.deadlinePath];
    if (!isValidDate(deadline)) {
      errors.push({
        path: contract.deadlinePath,
        message: contract.deadlineMessage,
      });
    } else if (isValidDate(draft.issueDate) && deadline < draft.issueDate) {
      errors.push({
        path: contract.deadlinePath,
        message: "The deadline cannot be before the issue date.",
      });
    }
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateQuoteDraft(draft = {}) {
  return validateDraftAgainstContract(draft, getDocumentContract(draft.kind));
}

// # Display formatting
export function formatMoney(cents, currency = "USD") {
  if (!Number.isSafeInteger(cents)) throw new TypeError("Money must be provided as integer cents.");
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / MONEY_SCALE);
}

// # Stable document result
export function createDocumentResult(draft = {}) {
  // Resolve the kind/deadline contract once so the exported fields cannot diverge.
  const contract = getDocumentContract(draft.kind);
  const validation = validateDraftAgainstContract(draft, contract);
  if (!validation.valid) throw new QuoteValidationError(validation.errors);
  const totals = calculateQuoteTotals(draft);

  return Object.freeze({
    schema: "toolstead.quote-invoice.v1",
    kind: contract.kind,
    documentNumber: String(draft.documentNumber).trim(),
    issueDate: draft.issueDate,
    deadline: draft[contract.deadlinePath],
    currency: totals.currency,
    business: Object.freeze({
      name: String(draft.business.name).trim(),
      contact: String(draft.business.contact ?? "").trim(),
    }),
    client: Object.freeze({
      name: String(draft.client.name).trim(),
      company: String(draft.client.company ?? "").trim(),
      email: String(draft.client.email ?? "").trim(),
      serviceAddress: String(draft.client.serviceAddress ?? "").trim(),
    }),
    projectTitle: String(draft.projectTitle ?? "").trim(),
    lineItems: totals.lineItems,
    paymentTerms: String(draft.paymentTerms ?? "").trim(),
    notes: String(draft.notes ?? "").trim(),
    totals,
    calculationRules: Object.freeze({
      money: "integer cents",
      quantityPrecision: 3,
      percentagePrecision: 2,
      rounding: "half-up per line and adjustment",
      discountTaxTreatment: "discount allocated proportionally across taxable and non-taxable subtotal",
      processingFeeBase: "discounted subtotal plus tax",
    }),
  });
}

// # Local document export
export function printPreparedDocument(documentResult, printAction) {
  if (documentResult?.schema !== "toolstead.quote-invoice.v1") {
    throw new TypeError("Prepare a valid client document before printing.");
  }
  if (typeof printAction !== "function") {
    throw new TypeError("A browser print action is required.");
  }

  printAction();
  return documentResult;
}
