import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  CheckCircle,
  FileText,
  Plus,
  Printer,
  Receipt,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  TOOL_MANIFEST,
  QuoteValidationError,
  calculateQuoteTotals,
  createDocumentResult,
  formatMoney,
  validateQuoteDraft,
} from "./logic.js";
import "./styles.css";

export * from "./logic.js";

// # Empty draft
const EMPTY_DRAFT = {
  kind: "quote",
  documentNumber: "",
  issueDate: "",
  expiresOn: "",
  dueDate: "",
  business: { name: "", contact: "" },
  client: { name: "", company: "", email: "", serviceAddress: "" },
  projectTitle: "",
  items: [
    {
      id: "line-1",
      description: "",
      quantity: "1",
      unitPrice: "0.00",
      taxable: true,
      included: true,
    },
  ],
  discount: { type: "none", value: "0" },
  taxRate: "0",
  processingFee: { type: "none", value: "0" },
  deposit: { type: "none", value: "0" },
  paymentTerms: "",
  notes: "",
};

const DOCUMENT_LABELS = {
  quote: "Quote",
  proposal: "Proposal",
  invoice: "Invoice",
  change_order: "Change order",
};

function fieldError(errors, path) {
  return errors.find((error) => error.path === path)?.message ?? "";
}

function ErrorText({ id, message }) {
  return message ? (
    <span className="qib-field-error" id={id} role="alert">
      {message}
    </span>
  ) : null;
}

// # Form control
function TextField({ label, error, className = "", ...props }) {
  const errorId = `${props.id}-error`;
  return (
    <label className={`qib-field ${className}`} htmlFor={props.id}>
      <span>{label}</span>
      <input {...props} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />
      <ErrorText id={errorId} message={error} />
    </label>
  );
}

function AdjustmentControl({ id, label, adjustment, error, onChange }) {
  const valueLabel = adjustment.type === "percent" ? `${label} percent` : `${label} amount`;
  return (
    <div className="qib-adjustment">
      <label className="qib-field" htmlFor={`${id}-type`}>
        <span>{label}</span>
        <select
          id={`${id}-type`}
          value={adjustment.type}
          onChange={(event) => onChange({ ...adjustment, type: event.target.value, value: "0" })}
        >
          <option value="none">None</option>
          <option value="percent">Percent</option>
          <option value="fixed">Fixed amount</option>
        </select>
      </label>
      {adjustment.type !== "none" && (
        <TextField
          id={`${id}-value`}
          label={valueLabel}
          value={adjustment.value}
          onChange={(event) => onChange({ ...adjustment, value: event.target.value })}
          inputMode="decimal"
          error={error}
        />
      )}
    </div>
  );
}

// # Financial preview
function Totals({ totals }) {
  return (
    <dl className="qib-totals">
      <div><dt>Subtotal</dt><dd>{formatMoney(totals.subtotalCents)}</dd></div>
      {totals.discountCents > 0 && <div><dt>Discount</dt><dd>−{formatMoney(totals.discountCents)}</dd></div>}
      <div><dt>Tax</dt><dd>{formatMoney(totals.taxCents)}</dd></div>
      {totals.processingFeeCents > 0 && <div><dt>Processing fee</dt><dd>{formatMoney(totals.processingFeeCents)}</dd></div>}
      <div className="qib-total"><dt>Total</dt><dd>{formatMoney(totals.totalCents)}</dd></div>
      {totals.depositCents > 0 && <div><dt>Deposit</dt><dd>−{formatMoney(totals.depositCents)}</dd></div>}
      <div className="qib-balance"><dt>Balance due</dt><dd>{formatMoney(totals.balanceDueCents)}</dd></div>
    </dl>
  );
}

function DocumentPreview({ draft, totals, preparedResult }) {
  const kindLabel = DOCUMENT_LABELS[draft.kind];
  const usesExpiration = draft.kind === "quote" || draft.kind === "proposal";
  const deadline = usesExpiration ? draft.expiresOn : draft.dueDate;
  return (
    <aside className="qib-preview" aria-label={`${kindLabel} preview`}>
      <div className="qib-paper">
        <header className="qib-paper-header">
          <div>
            <span className="qib-preview-kicker">{kindLabel}</span>
            <h2>{draft.business.name || "Your business"}</h2>
            <p>{draft.business.contact || "Business contact details"}</p>
          </div>
          <dl>
            <div><dt>Number</dt><dd>{draft.documentNumber || "Not set"}</dd></div>
            <div><dt>Issued</dt><dd>{draft.issueDate || "Not set"}</dd></div>
            <div><dt>{usesExpiration ? "Expires" : "Due"}</dt><dd>{deadline || "Not set"}</dd></div>
          </dl>
        </header>

        <section className="qib-bill-to">
          <span>Prepared for</span>
          <strong>{draft.client.name || "Client name"}</strong>
          {draft.client.company && <p>{draft.client.company}</p>}
          {draft.client.email && <p>{draft.client.email}</p>}
          {draft.client.serviceAddress && <p>{draft.client.serviceAddress}</p>}
        </section>

        {draft.projectTitle && <h3 className="qib-project-title">{draft.projectTitle}</h3>}

        <div className="qib-preview-table" role="table" aria-label="Line item summary">
          <div className="qib-preview-row qib-preview-head" role="row">
            <span role="columnheader">Scope</span>
            <span role="columnheader">Qty</span>
            <span role="columnheader">Rate</span>
            <span role="columnheader">Amount</span>
          </div>
          {totals.lineItems.map((item) => (
            <div className={`qib-preview-row ${item.included ? "" : "is-optional"}`} role="row" key={item.id}>
              <span role="cell">
                {item.description || "Untitled line item"}
                {!item.included && <small>Optional — not included</small>}
              </span>
              <span role="cell">{item.quantity}</span>
              <span role="cell">{formatMoney(item.unitPriceCents)}</span>
              <span role="cell">{formatMoney(item.lineTotalCents)}</span>
            </div>
          ))}
        </div>

        <Totals totals={totals} />

        {(draft.paymentTerms || draft.notes) && (
          <div className="qib-preview-notes">
            {draft.paymentTerms && <section><h3>Payment terms</h3><p>{draft.paymentTerms}</p></section>}
            {draft.notes && <section><h3>Scope notes</h3><p>{draft.notes}</p></section>}
          </div>
        )}
      </div>

      <div className="qib-preview-actions">
        <button type="button" className="qib-secondary" onClick={() => window.print()} disabled={!preparedResult}>
          <Printer aria-hidden="true" /> Print prepared draft
        </button>
        <span>{preparedResult ? "Validated and ready to print" : "Prepare the draft before printing"}</span>
      </div>
    </aside>
  );
}

// # Builder workspace
export default function QuoteInvoiceBuilder() {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  const [preparedResult, setPreparedResult] = useState(null);
  const nextLineId = useRef(2);

  const validation = useMemo(() => validateQuoteDraft(draft), [draft]);
  const visibleErrors = showErrors ? validation.errors : [];
  const totals = useMemo(() => {
    try {
      return calculateQuoteTotals(draft);
    } catch {
      return {
        lineItems: draft.items.map((item) => ({
          ...item,
          unitPriceCents: 0,
          lineTotalCents: 0,
          taxable: item.taxable !== false,
          included: item.included !== false,
        })),
        subtotalCents: 0,
        discountCents: 0,
        taxCents: 0,
        processingFeeCents: 0,
        totalCents: 0,
        depositCents: 0,
        balanceDueCents: 0,
      };
    }
  }, [draft]);

  useEffect(() => setPreparedResult(null), [draft]);

  const updateParty = (party, field, value) => {
    setDraft((current) => ({ ...current, [party]: { ...current[party], [field]: value } }));
  };
  const updateLine = (id, field, value) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };
  const addLine = () => {
    const id = `line-${nextLineId.current++}`;
    setDraft((current) => ({
      ...current,
      items: [...current.items, { id, description: "", quantity: "1", unitPrice: "0.00", taxable: true, included: true }],
    }));
  };
  const removeLine = (id) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  };
  const prepareDocument = () => {
    setShowErrors(true);
    try {
      setPreparedResult(createDocumentResult(draft));
    } catch (error) {
      if (!(error instanceof QuoteValidationError)) throw error;
      setPreparedResult(null);
    }
  };

  return (
    <main className="qib-workspace">
      <header className="qib-toolbar">
        <div className="qib-title">
          <span className="qib-icon"><Receipt aria-hidden="true" /></span>
          <div>
            <span className="qib-eyebrow">Finance workspace</span>
            <h1>{TOOL_MANIFEST.name}</h1>
            <p>Build a precise client document. Draft data remains in this browser tab.</p>
          </div>
        </div>
        <div className="qib-toolbar-actions">
          <span className="qib-local-badge"><Calculator aria-hidden="true" /> Local calculation</span>
          <button type="button" className="qib-primary" onClick={prepareDocument}>
            <CheckCircle aria-hidden="true" /> Prepare document
          </button>
        </div>
      </header>

      {showErrors && !validation.valid && (
        <div className="qib-error-summary" role="alert" tabIndex="-1">
          <WarningCircle aria-hidden="true" />
          <div><strong>Finish {validation.errors.length} required field{validation.errors.length === 1 ? "" : "s"}.</strong><span>Review the highlighted inputs before preparing this document.</span></div>
        </div>
      )}
      {preparedResult && (
        <div className="qib-success" role="status">
          <CheckCircle aria-hidden="true" /> Document validated. Totals are ready for a future save or PDF workflow.
        </div>
      )}

      <div className="qib-layout">
        <form className="qib-editor" onSubmit={(event) => event.preventDefault()} noValidate>
          <section className="qib-card">
            <div className="qib-section-head">
              <div><span>01</span><h2>Document details</h2></div>
              <div className="qib-segmented" aria-label="Document type">
                {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={draft.kind === value} onClick={() => setDraft((current) => ({ ...current, kind: value }))}>{label}</button>
                ))}
              </div>
            </div>
            <div className="qib-form-grid">
              <TextField id="qib-business-name" label="Business name" value={draft.business.name} onChange={(event) => updateParty("business", "name", event.target.value)} error={fieldError(visibleErrors, "business.name")} />
              <TextField id="qib-business-contact" label="Business contact" value={draft.business.contact} onChange={(event) => updateParty("business", "contact", event.target.value)} placeholder="Email, phone, or address" />
              <TextField id="qib-document-number" label="Document number" value={draft.documentNumber} onChange={(event) => setDraft((current) => ({ ...current, documentNumber: event.target.value }))} error={fieldError(visibleErrors, "documentNumber")} />
              <TextField id="qib-issue-date" label="Issue date" type="date" value={draft.issueDate} onChange={(event) => setDraft((current) => ({ ...current, issueDate: event.target.value }))} error={fieldError(visibleErrors, "issueDate")} />
              {draft.kind === "quote" || draft.kind === "proposal" ? (
                <TextField id="qib-expires" label={`${DOCUMENT_LABELS[draft.kind]} expires`} type="date" value={draft.expiresOn} onChange={(event) => setDraft((current) => ({ ...current, expiresOn: event.target.value }))} error={fieldError(visibleErrors, "expiresOn")} />
              ) : (
                <TextField id="qib-due" label="Payment due" type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} error={fieldError(visibleErrors, "dueDate")} />
              )}
              <TextField id="qib-project-title" label="Project or job" value={draft.projectTitle} onChange={(event) => setDraft((current) => ({ ...current, projectTitle: event.target.value }))} />
            </div>
          </section>

          <section className="qib-card">
            <div className="qib-section-head"><div><span>02</span><h2>Client details</h2></div></div>
            <div className="qib-form-grid">
              <TextField id="qib-client-name" label="Client name" value={draft.client.name} onChange={(event) => updateParty("client", "name", event.target.value)} error={fieldError(visibleErrors, "client.name")} />
              <TextField id="qib-client-company" label="Company" value={draft.client.company} onChange={(event) => updateParty("client", "company", event.target.value)} />
              <TextField id="qib-client-email" label="Email" type="email" value={draft.client.email} onChange={(event) => updateParty("client", "email", event.target.value)} />
              <TextField id="qib-service-address" label="Service address" value={draft.client.serviceAddress} onChange={(event) => updateParty("client", "serviceAddress", event.target.value)} />
            </div>
          </section>

          <section className="qib-card">
            <div className="qib-section-head">
              <div><span>03</span><h2>Itemized scope</h2></div>
              <button type="button" className="qib-secondary" onClick={addLine}><Plus aria-hidden="true" /> Add line</button>
            </div>
            <div className="qib-lines">
              {draft.items.map((item, index) => (
                <fieldset className="qib-line" key={item.id}>
                  <legend>Line item {index + 1}</legend>
                  <TextField id={`qib-description-${item.id}`} className="qib-description" label="Description" value={item.description} onChange={(event) => updateLine(item.id, "description", event.target.value)} error={fieldError(visibleErrors, `items.${index}.description`)} placeholder="Specific service, material, or deliverable" />
                  <TextField id={`qib-quantity-${item.id}`} label="Quantity / hours" value={item.quantity} onChange={(event) => updateLine(item.id, "quantity", event.target.value)} inputMode="decimal" error={fieldError(visibleErrors, `items.${index}.quantity`)} />
                  <TextField id={`qib-rate-${item.id}`} label="Unit rate" value={item.unitPrice} onChange={(event) => updateLine(item.id, "unitPrice", event.target.value)} inputMode="decimal" error={fieldError(visibleErrors, `items.${index}.unitPrice`)} />
                  <label className="qib-check"><input type="checkbox" checked={item.taxable} onChange={(event) => updateLine(item.id, "taxable", event.target.checked)} /> Taxable</label>
                  <label className="qib-check"><input type="checkbox" checked={item.included} onChange={(event) => updateLine(item.id, "included", event.target.checked)} /> Included in total</label>
                  <button type="button" className="qib-delete" onClick={() => removeLine(item.id)} disabled={draft.items.length === 1} aria-label={`Remove line item ${index + 1}`}><Trash aria-hidden="true" /></button>
                </fieldset>
              ))}
            </div>
          </section>

          <section className="qib-card">
            <div className="qib-section-head"><div><span>04</span><h2>Pricing and terms</h2></div></div>
            <div className="qib-adjustment-grid">
              <AdjustmentControl id="qib-discount" label="Discount / credit" adjustment={draft.discount} onChange={(discount) => setDraft((current) => ({ ...current, discount }))} error={fieldError(visibleErrors, "discount")} />
              <TextField id="qib-tax" label="Tax rate (%)" value={draft.taxRate} onChange={(event) => setDraft((current) => ({ ...current, taxRate: event.target.value }))} inputMode="decimal" error={fieldError(visibleErrors, "taxRate")} />
              <AdjustmentControl id="qib-fee" label="Processing fee" adjustment={draft.processingFee} onChange={(processingFee) => setDraft((current) => ({ ...current, processingFee }))} error={fieldError(visibleErrors, "processingFee")} />
              <AdjustmentControl id="qib-deposit" label="Deposit" adjustment={draft.deposit} onChange={(deposit) => setDraft((current) => ({ ...current, deposit }))} error={fieldError(visibleErrors, "deposit")} />
            </div>
            <div className="qib-textareas">
              <label className="qib-field" htmlFor="qib-payment-terms"><span>Payment terms and methods</span><textarea id="qib-payment-terms" rows="3" value={draft.paymentTerms} onChange={(event) => setDraft((current) => ({ ...current, paymentTerms: event.target.value }))} placeholder="State due timing, accepted methods, and any late-fee policy." /></label>
              <label className="qib-field" htmlFor="qib-notes"><span>Scope notes</span><textarea id="qib-notes" rows="3" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Clarify inclusions, exclusions, assumptions, or client responsibilities." /></label>
            </div>
          </section>

          {preparedResult && (
            <details className="qib-data-result">
              <summary><FileText aria-hidden="true" /> View stable document data</summary>
              <pre>{JSON.stringify(preparedResult, null, 2)}</pre>
            </details>
          )}
        </form>

        <DocumentPreview draft={draft} totals={totals} preparedResult={preparedResult} />
      </div>
    </main>
  );
}
