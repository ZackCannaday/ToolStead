import assert from "node:assert/strict";
import test from "node:test";
import {
  QuoteValidationError,
  calculateQuoteTotals,
  createDocumentResult,
  formatMoney,
  parseMoneyToCents,
  parsePercentToBasisPoints,
  parseQuantity,
  validateCalculationInput,
  validateQuoteDraft,
} from "../src/tools/quote-invoice-builder/logic.js";

// # Parsing precision
test("parses money, quantities, and percentages without floating-point arithmetic", () => {
  assert.equal(parseMoneyToCents("19.99"), 1_999);
  assert.equal(parseQuantity("1.125"), 1_125);
  assert.equal(parsePercentToBasisPoints("8.25"), 825);
  assert.throws(() => parseMoneyToCents("1.999"), RangeError);
  assert.throws(() => parseQuantity("1e3"), RangeError);
  assert.throws(() => parsePercentToBasisPoints("100.01"), RangeError);
});

// # Complete calculation
test("calculates line totals, proportional taxable discount, tax, deposit, and balance", () => {
  const totals = calculateQuoteTotals({
    items: [
      { id: "labor", description: "Installation labor", quantity: "2.5", unitPrice: "100.00", taxable: false },
      { id: "parts", description: "Mounting hardware", quantity: "3", unitPrice: "25.50", taxable: true },
      { id: "optional", description: "Optional upgrade", quantity: "1", unitPrice: "999.00", included: false },
    ],
    discount: { type: "percent", value: "10" },
    taxRate: "8.25",
    deposit: { type: "percent", value: "25" },
  });

  assert.deepEqual(
    {
      subtotal: totals.subtotalCents,
      taxableSubtotal: totals.taxableSubtotalCents,
      discount: totals.discountCents,
      taxableDiscount: totals.taxableDiscountCents,
      taxableBase: totals.taxableBaseCents,
      tax: totals.taxCents,
      total: totals.totalCents,
      deposit: totals.depositCents,
      balance: totals.balanceDueCents,
    },
    {
      subtotal: 32_650,
      taxableSubtotal: 7_650,
      discount: 3_265,
      taxableDiscount: 765,
      taxableBase: 6_885,
      tax: 568,
      total: 29_953,
      deposit: 7_488,
      balance: 22_465,
    },
  );
});

test("rounds each fractional-quantity line half up", () => {
  const totals = calculateQuoteTotals({
    items: [{ description: "Measured material", quantity: "1.125", unitPrice: "19.99" }],
    taxRate: "0",
  });

  assert.equal(totals.lineItems[0].lineTotalCents, 2_249);
  assert.equal(totals.totalCents, 2_249);
});

test("supports fixed discounts, processing fees, and deposits", () => {
  const totals = calculateQuoteTotals({
    items: [{ description: "Service", quantity: "1", unitPrice: "100.00" }],
    discount: { type: "fixed", value: "5.25" },
    taxRate: "0",
    processingFee: { type: "percent", value: "3" },
    deposit: { type: "fixed", value: "20.00" },
  });

  assert.equal(totals.discountCents, 525);
  assert.equal(totals.processingFeeCents, 284);
  assert.equal(totals.totalCents, 9_759);
  assert.equal(totals.depositCents, 2_000);
  assert.equal(totals.balanceDueCents, 7_759);
});

// # Validation behavior
test("returns field-addressable validation errors", () => {
  const result = validateCalculationInput({
    items: [{ description: "", quantity: "0", unitPrice: "12.999" }],
    taxRate: "101",
  });

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.errors.map((error) => error.path),
    ["items.0.description", "items.0.quantity", "items.0.unitPrice", "taxRate"],
  );
});

test("rejects adjustments that exceed their calculation base", () => {
  assert.throws(
    () => calculateQuoteTotals({
      items: [{ description: "Service", quantity: "1", unitPrice: "50.00" }],
      discount: { type: "fixed", value: "60.00" },
      taxRate: "0",
    }),
    (error) => error instanceof QuoteValidationError && error.errors[0].path === "discount",
  );

  assert.throws(
    () => calculateQuoteTotals({
      items: [{ description: "Service", quantity: "1", unitPrice: "50.00" }],
      taxRate: "0",
      deposit: { type: "fixed", value: "60.00" },
    }),
    (error) => error instanceof QuoteValidationError && error.errors[0].path === "deposit",
  );
});

test("requires identity and deadline fields for a client-ready draft", () => {
  const result = validateQuoteDraft({
    kind: "quote",
    issueDate: "2026-09-04",
    expiresOn: "2026-09-03",
    items: [{ description: "Service", quantity: "1", unitPrice: "50.00" }],
    taxRate: "0",
    business: {},
    client: {},
  });

  assert.equal(result.valid, false);
  assert.deepEqual(
    result.errors.map((error) => error.path),
    ["business.name", "client.name", "documentNumber", "expiresOn"],
  );
});

// # Stable result
test("creates a deterministic, audit-ready document result", () => {
  const draft = {
    kind: "invoice",
    documentNumber: "INV-204",
    issueDate: "2026-09-04",
    dueDate: "2026-09-19",
    business: { name: "Example Services", contact: "billing@example.test" },
    client: { name: "Client Name", email: "client@example.test" },
    projectTitle: "Completed service",
    items: [{ id: "1", description: "Diagnostic service", quantity: "1", unitPrice: "125.00", taxable: false }],
    discount: { type: "none", value: "0" },
    taxRate: "0",
    deposit: { type: "fixed", value: "25.00" },
    paymentTerms: "Balance due within 15 days.",
    notes: "Scope completed as listed.",
  };

  const first = createDocumentResult(draft);
  const second = createDocumentResult(structuredClone(draft));

  assert.deepEqual(first, second);
  assert.equal(first.schema, "toolstead.quote-invoice.v1");
  assert.equal(first.deadline, "2026-09-19");
  assert.equal(first.totals.balanceDueCents, 10_000);
  assert.equal(first.calculationRules.rounding, "half-up per line and adjustment");
});

test("supports proposals with an explicit expiration date", () => {
  const result = createDocumentResult({
    kind: "proposal",
    documentNumber: "PROP-12",
    issueDate: "2026-09-04",
    expiresOn: "2026-10-04",
    business: { name: "Example Services" },
    client: { name: "Client Name" },
    items: [{ description: "Project phase", quantity: "1", unitPrice: "500.00" }],
    taxRate: "0",
  });

  assert.equal(result.kind, "proposal");
  assert.equal(result.deadline, "2026-10-04");
});

test("formats integer cents as USD and rejects fractional cents", () => {
  assert.equal(formatMoney(12_345), "$123.45");
  assert.throws(() => formatMoney(12.34), TypeError);
});
