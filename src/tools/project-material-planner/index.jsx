import { useMemo, useState } from "react";
import {
  Calculator,
  CurrencyDollar,
  DownloadSimple,
  Hammer,
  Package,
  Plus,
  ShieldWarning,
  Trash,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  BUILD_PHASES,
  CUT_UNITS,
  GRAIN_ORIENTATIONS,
  MATERIAL_UNITS,
  TOOL_CATEGORIES,
  TOOL_MANIFEST,
  WORK_CATEGORIES,
  SAFETY_BOUNDARIES,
  calculateCutItem,
  calculateMaterial,
  calculateProjectPlan,
  roundCurrency,
  roundQuantity,
  serializeProjectPlan,
  validateBuildStep,
  validateCutItem,
  validateLabor,
  validateMaterial,
  validateOtherCost,
  validateProjectPlan,
  validateScope,
  validateToolItem,
} from "./planner.js";
import "./styles.css";

export {
  BUILD_PHASES,
  CUT_UNITS,
  GRAIN_ORIENTATIONS,
  MATERIAL_UNITS,
  TOOL_CATEGORIES,
  TOOL_MANIFEST,
  WORK_CATEGORIES,
  SAFETY_BOUNDARIES,
  calculateMaterial,
  calculateCutItem,
  calculateProjectPlan,
  roundCurrency,
  roundQuantity,
  serializeProjectPlan,
  validateBuildStep,
  validateCutItem,
  validateLabor,
  validateMaterial,
  validateOtherCost,
  validateProjectPlan,
  validateScope,
  validateToolItem,
};

// # Blank entries
let rowSequence = 0;
function nextId(prefix) {
  rowSequence += 1;
  return `${prefix}-${rowSequence}`;
}

function blankMaterial() {
  return {
    id: nextId("material"),
    name: "",
    quantity: "",
    unit: "each",
    wastePercent: "10",
    packageQuantity: "",
    packagePrice: "",
  };
}

function blankLabor() {
  return {
    id: nextId("labor"),
    description: "",
    hours: "",
    hourlyRate: "",
  };
}

function blankOtherCost() {
  return { id: nextId("cost"), description: "", amount: "" };
}

function blankCutItem() {
  return {
    id: nextId("cut"),
    name: "",
    quantity: "",
    unit: "in",
    finishedLength: "",
    kerfPerCut: "",
    cutsPerPart: "1",
    grainOrientation: "not applicable",
  };
}

function blankToolItem() {
  return { id: nextId("tool"), name: "", category: "cutting", staged: false };
}

function blankBuildStep() {
  return {
    id: nextId("step"),
    phase: "material prep",
    instruction: "",
    dryFitCheckpoint: false,
  };
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

// # Shared form pieces
function NumberField({ id, label, value, onChange, min = "0", step = "0.01", error }) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <label className="pmp-field">
      <span>{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      />
      {error && <small id={errorId}>{error}</small>}
    </label>
  );
}

function EmptyPanel({ children }) {
  return <div className="pmp-empty">{children}</div>;
}

// # Main workspace
export default function ProjectMaterialPlanner() {
  const [scope, setScope] = useState({
    projectName: "",
    finalDimensions: "",
    intendedUse: "",
    aestheticRequirements: "",
    materialTypes: "",
    workCategory: "",
    professionalReviewConfirmed: false,
  });
  const [materials, setMaterials] = useState([]);
  const [cutList, setCutList] = useState([]);
  const [tools, setTools] = useState([]);
  const [buildSteps, setBuildSteps] = useState([]);
  const [labor, setLabor] = useState([]);
  const [otherCosts, setOtherCosts] = useState([]);
  const [budget, setBudget] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  const plan = useMemo(
    () => ({ scope, materials, cutList, tools, buildSteps, labor, otherCosts, budget }),
    [scope, materials, cutList, tools, buildSteps, labor, otherCosts, budget],
  );
  const validation = useMemo(() => validateProjectPlan(plan), [plan]);
  const result = useMemo(() => calculateProjectPlan(plan), [plan]);
  const errors = useMemo(
    () => new Map(validation.errors.map((error) => [error.path, error.message])),
    [validation.errors],
  );

  const updateRow = (setter, id, field, value) => {
    setter((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const removeRow = (setter, id) => {
    setter((rows) => rows.filter((row) => row.id !== id));
  };

  const calculate = () => setShowErrors(true);
  const exportPlan = () => {
    setShowErrors(true);
    if (!result.ok) {
      setExportStatus("Resolve validation errors before exporting.");
      return;
    }
    const content = serializeProjectPlan(plan);
    const filename = `${scope.projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project-plan"}.json`;
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus(`Exported ${filename}`);
  };
  const totals = result.ok
    ? result.totals
    : { materialSubtotal: 0, laborSubtotal: 0, otherSubtotal: 0, total: 0 };

  return (
    <main className="pmp-workspace">
      <header className="pmp-header">
        <div>
          <span className="pmp-kicker">Operations workspace</span>
          <h1>Project Material Planner</h1>
          <p>
            Calculate purchase quantities and project costs. Quantities stay in the
            unit you select; this planner does not perform unit conversions.
          </p>
        </div>
        <label className="pmp-budget">
          <span>Project budget (USD)</span>
          <div>
            <CurrencyDollar aria-hidden="true" />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              aria-invalid={showErrors && errors.has("budget")}
            />
          </div>
          {showErrors && errors.has("budget") && <small>{errors.get("budget")}</small>}
        </label>
      </header>

      <section className="pmp-section" aria-labelledby="scope-heading">
        <div className="pmp-section-head">
          <div><Hammer aria-hidden="true" /><div><h2 id="scope-heading">Project scope</h2><p>Record the intended result before planning stock and cuts.</p></div></div>
        </div>
        <div className="pmp-scope-grid">
          {[
            ["projectName", "Project name", 120],
            ["finalDimensions", "Final dimensions", 240],
            ["intendedUse", "Intended use", 240],
            ["materialTypes", "Material types", 240],
            ["aestheticRequirements", "Aesthetic requirements", 240],
          ].map(([field, label, maxLength]) => (
            <label className={`pmp-field ${field === "aestheticRequirements" ? "pmp-span-two" : ""}`} key={field}>
              <span>{label}</span>
              <input
                value={scope[field]}
                maxLength={maxLength}
                onChange={(event) => setScope((current) => ({ ...current, [field]: event.target.value }))}
                aria-invalid={showErrors && errors.has(`scope.${field}`)}
              />
              {showErrors && errors.has(`scope.${field}`) && <small>{errors.get(`scope.${field}`)}</small>}
            </label>
          ))}
          <label className="pmp-field">
            <span>Work category</span>
            <select
              value={scope.workCategory}
              onChange={(event) => setScope((current) => ({
                ...current,
                workCategory: event.target.value,
                professionalReviewConfirmed: false,
              }))}
              aria-invalid={showErrors && errors.has("scope.workCategory")}
            >
              <option value="">Select category</option>
              {WORK_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
            {showErrors && errors.has("scope.workCategory") && <small>{errors.get("scope.workCategory")}</small>}
          </label>
          {WORK_CATEGORIES.find((category) => category.value === scope.workCategory)?.regulated && (
            <label className="pmp-check pmp-review-check">
              <input
                type="checkbox"
                checked={scope.professionalReviewConfirmed}
                onChange={(event) => setScope((current) => ({ ...current, professionalReviewConfirmed: event.target.checked }))}
                aria-invalid={showErrors && errors.has("scope.professionalReviewConfirmed")}
              />
              <span>I understand this plan requires qualified professional review before work begins.</span>
              {showErrors && errors.has("scope.professionalReviewConfirmed") && <small>{errors.get("scope.professionalReviewConfirmed")}</small>}
            </label>
          )}
        </div>
        <aside className="pmp-boundary" aria-label="Safety and scope boundaries">
          <ShieldWarning aria-hidden="true" />
          <div>
            <strong>Planning boundary</strong>
            <ul>{SAFETY_BOUNDARIES.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul>
          </div>
        </aside>
      </section>

      {showErrors && !validation.valid && (
        <div className="pmp-alert" role="alert">
          <WarningCircle aria-hidden="true" />
          <span>Review {validation.errors.length} highlighted field{validation.errors.length === 1 ? "" : "s"}.</span>
        </div>
      )}

      {showErrors && validation.valid && validation.warnings.length > 0 && (
        <div className="pmp-advisory" role="status">
          <WarningCircle aria-hidden="true" />
          <div><strong>Plan is valid with {validation.warnings.length} readiness note{validation.warnings.length === 1 ? "" : "s"}</strong><ul>{validation.warnings.map((warning) => <li key={`${warning.path}-${warning.message}`}>{warning.message}</li>)}</ul></div>
        </div>
      )}

      <section className="pmp-section" aria-labelledby="materials-heading">
        <div className="pmp-section-head">
          <div>
            <Package aria-hidden="true" />
            <div>
              <h2 id="materials-heading">Materials</h2>
              <p>Waste is added before purchase packages are rounded up.</p>
            </div>
          </div>
          <button className="pmp-add" type="button" onClick={() => setMaterials((rows) => [...rows, blankMaterial()])}>
            <Plus aria-hidden="true" /> Add material
          </button>
        </div>

        {materials.length === 0 ? (
          <EmptyPanel>Add your first material to begin a bill of materials.</EmptyPanel>
        ) : (
          <div className="pmp-list">
            {materials.map((item, index) => {
              const line = validateMaterial(item).length === 0 ? calculateMaterial(item) : null;
              const prefix = `materials.${index}`;
              return (
                <article className="pmp-row pmp-material-row" key={item.id}>
                  <label className="pmp-field pmp-name">
                    <span>Material</span>
                    <input
                      value={item.name}
                      maxLength="120"
                      onChange={(event) => updateRow(setMaterials, item.id, "name", event.target.value)}
                      aria-invalid={showErrors && errors.has(`${prefix}.name`)}
                    />
                    {showErrors && errors.has(`${prefix}.name`) && <small>{errors.get(`${prefix}.name`)}</small>}
                  </label>
                  <NumberField id={`${item.id}-quantity`} label="Needed" value={item.quantity} min="0.0001" step="any" onChange={(value) => updateRow(setMaterials, item.id, "quantity", value)} error={showErrors && errors.get(`${prefix}.quantity`)} />
                  <label className="pmp-field">
                    <span>Unit</span>
                    <select value={item.unit} onChange={(event) => updateRow(setMaterials, item.id, "unit", event.target.value)}>
                      {MATERIAL_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </label>
                  <NumberField id={`${item.id}-waste`} label="Waste %" value={item.wastePercent} step="0.1" onChange={(value) => updateRow(setMaterials, item.id, "wastePercent", value)} error={showErrors && errors.get(`${prefix}.wastePercent`)} />
                  <NumberField id={`${item.id}-package-quantity`} label="Per package" value={item.packageQuantity} min="0.0001" step="any" onChange={(value) => updateRow(setMaterials, item.id, "packageQuantity", value)} error={showErrors && errors.get(`${prefix}.packageQuantity`)} />
                  <NumberField id={`${item.id}-package-price`} label="Package price" value={item.packagePrice} onChange={(value) => updateRow(setMaterials, item.id, "packagePrice", value)} error={showErrors && errors.get(`${prefix}.packagePrice`)} />
                  <div className="pmp-line-result" aria-live="polite">
                    <span>Purchase</span>
                    <strong>{line ? `${line.packagesRequired} pkg · ${money(line.lineTotal)}` : "—"}</strong>
                    {line && <small>{line.purchasedQuantity} {line.unit} total</small>}
                  </div>
                  <button className="pmp-remove" type="button" onClick={() => removeRow(setMaterials, item.id)} aria-label={`Remove ${item.name || `material ${index + 1}`}`}>
                    <Trash aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="pmp-section" aria-labelledby="cut-list-heading">
        <div className="pmp-section-head">
          <div><Package aria-hidden="true" /><div><h2 id="cut-list-heading">Cut list</h2><p>Track finished length, cut count, blade kerf, and grain direction in one unit.</p></div></div>
          <button className="pmp-add" type="button" onClick={() => setCutList((rows) => [...rows, blankCutItem()])}><Plus aria-hidden="true" /> Add cut part</button>
        </div>
        {cutList.length === 0 ? <EmptyPanel>No cut parts entered.</EmptyPanel> : (
          <div className="pmp-list">
            {cutList.map((item, index) => {
              const prefix = `cutList.${index}`;
              const line = validateCutItem(item).length === 0 ? calculateCutItem(item) : null;
              return <article className="pmp-row pmp-cut-row" key={item.id}>
                <label className="pmp-field pmp-name"><span>Part</span><input value={item.name} maxLength="120" onChange={(event) => updateRow(setCutList, item.id, "name", event.target.value)} aria-invalid={showErrors && errors.has(`${prefix}.name`)} />{showErrors && errors.has(`${prefix}.name`) && <small>{errors.get(`${prefix}.name`)}</small>}</label>
                <NumberField id={`${item.id}-quantity`} label="Parts" value={item.quantity} min="1" step="1" onChange={(value) => updateRow(setCutList, item.id, "quantity", value)} error={showErrors && errors.get(`${prefix}.quantity`)} />
                <NumberField id={`${item.id}-length`} label="Finished length" value={item.finishedLength} min="0.0001" step="any" onChange={(value) => updateRow(setCutList, item.id, "finishedLength", value)} error={showErrors && errors.get(`${prefix}.finishedLength`)} />
                <label className="pmp-field"><span>Unit</span><select value={item.unit} onChange={(event) => updateRow(setCutList, item.id, "unit", event.target.value)}>{CUT_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                <NumberField id={`${item.id}-kerf`} label="Kerf per cut" value={item.kerfPerCut} step="any" onChange={(value) => updateRow(setCutList, item.id, "kerfPerCut", value)} error={showErrors && errors.get(`${prefix}.kerfPerCut`)} />
                <NumberField id={`${item.id}-cuts`} label="Cuts per part" value={item.cutsPerPart} min="1" step="1" onChange={(value) => updateRow(setCutList, item.id, "cutsPerPart", value)} error={showErrors && errors.get(`${prefix}.cutsPerPart`)} />
                <label className="pmp-field"><span>Grain direction</span><select value={item.grainOrientation} onChange={(event) => updateRow(setCutList, item.id, "grainOrientation", event.target.value)}>{GRAIN_ORIENTATIONS.map((option) => <option key={option}>{option}</option>)}</select></label>
                <div className="pmp-line-result" aria-live="polite"><span>Stock length</span><strong>{line ? `${line.totalStockLength} ${line.unit}` : "—"}</strong>{line && <small>{line.totalKerfAllowance} {line.unit} kerf</small>}</div>
                <button className="pmp-remove" type="button" onClick={() => removeRow(setCutList, item.id)} aria-label={`Remove ${item.name || `cut part ${index + 1}`}`}><Trash aria-hidden="true" /></button>
              </article>;
            })}
          </div>
        )}
      </section>

      <div className="pmp-columns">
        <section className="pmp-section" aria-labelledby="tools-heading">
          <div className="pmp-section-head">
            <div><Hammer aria-hidden="true" /><div><h2 id="tools-heading">Tools &amp; safety</h2><p>Stage tools and personal protective equipment.</p></div></div>
            <button className="pmp-add" type="button" onClick={() => setTools((rows) => [...rows, blankToolItem()])}><Plus aria-hidden="true" /> Add item</button>
          </div>
          {tools.length === 0 ? <EmptyPanel>No tools or safety items entered.</EmptyPanel> : <div className="pmp-list">{tools.map((item, index) => {
            const prefix = `tools.${index}`;
            return <article className="pmp-row pmp-tool-row" key={item.id}>
              <label className="pmp-field pmp-name"><span>Tool or PPE</span><input value={item.name} maxLength="120" onChange={(event) => updateRow(setTools, item.id, "name", event.target.value)} aria-invalid={showErrors && errors.has(`${prefix}.name`)} />{showErrors && errors.has(`${prefix}.name`) && <small>{errors.get(`${prefix}.name`)}</small>}</label>
              <label className="pmp-field"><span>Category</span><select value={item.category} onChange={(event) => updateRow(setTools, item.id, "category", event.target.value)}>{TOOL_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="pmp-check"><input type="checkbox" checked={item.staged} onChange={(event) => updateRow(setTools, item.id, "staged", event.target.checked)} /><span>Staged</span></label>
              <button className="pmp-remove" type="button" onClick={() => removeRow(setTools, item.id)} aria-label={`Remove ${item.name || `tool ${index + 1}`}`}><Trash aria-hidden="true" /></button>
            </article>;
          })}</div>}
        </section>

        <section className="pmp-section" aria-labelledby="steps-heading">
          <div className="pmp-section-head">
            <div><Package aria-hidden="true" /><div><h2 id="steps-heading">Build sequence</h2><p>Steps stay in the order shown; include a dry-fit checkpoint.</p></div></div>
            <button className="pmp-add" type="button" onClick={() => setBuildSteps((rows) => [...rows, blankBuildStep()])}><Plus aria-hidden="true" /> Add step</button>
          </div>
          {buildSteps.length === 0 ? <EmptyPanel>No build steps entered.</EmptyPanel> : <ol className="pmp-list pmp-step-list">{buildSteps.map((item, index) => {
            const prefix = `buildSteps.${index}`;
            return <li className="pmp-row pmp-step-row" key={item.id}>
              <span className="pmp-step-number" aria-hidden="true">{index + 1}</span>
              <label className="pmp-field"><span>Phase</span><select value={item.phase} onChange={(event) => updateRow(setBuildSteps, item.id, "phase", event.target.value)} aria-invalid={showErrors && errors.has(`${prefix}.phase`)}>{BUILD_PHASES.map((phase) => <option key={phase}>{phase}</option>)}</select>{showErrors && errors.has(`${prefix}.phase`) && <small>{errors.get(`${prefix}.phase`)}</small>}</label>
              <label className="pmp-field pmp-name"><span>Instruction</span><input value={item.instruction} maxLength="300" onChange={(event) => updateRow(setBuildSteps, item.id, "instruction", event.target.value)} aria-invalid={showErrors && errors.has(`${prefix}.instruction`)} />{showErrors && errors.has(`${prefix}.instruction`) && <small>{errors.get(`${prefix}.instruction`)}</small>}</label>
              <label className="pmp-check"><input type="checkbox" checked={item.dryFitCheckpoint} onChange={(event) => updateRow(setBuildSteps, item.id, "dryFitCheckpoint", event.target.checked)} aria-invalid={showErrors && errors.has(`${prefix}.dryFitCheckpoint`)} /><span>Dry-fit checkpoint</span>{showErrors && errors.has(`${prefix}.dryFitCheckpoint`) && <small>{errors.get(`${prefix}.dryFitCheckpoint`)}</small>}</label>
              <button className="pmp-remove" type="button" onClick={() => removeRow(setBuildSteps, item.id)} aria-label={`Remove build step ${index + 1}`}><Trash aria-hidden="true" /></button>
            </li>;
          })}</ol>}
        </section>
      </div>

      <div className="pmp-columns">
        <section className="pmp-section" aria-labelledby="labor-heading">
          <div className="pmp-section-head">
            <div><Users aria-hidden="true" /><div><h2 id="labor-heading">Labor</h2><p>Hours multiplied by hourly rate.</p></div></div>
            <button className="pmp-add" type="button" onClick={() => setLabor((rows) => [...rows, blankLabor()])}><Plus aria-hidden="true" /> Add labor</button>
          </div>
          {labor.length === 0 ? <EmptyPanel>No labor entered.</EmptyPanel> : (
            <div className="pmp-list">
              {labor.map((item, index) => {
                const prefix = `labor.${index}`;
                const valid = validateLabor(item).length === 0;
                return <article className="pmp-row pmp-cost-row" key={item.id}>
                  <label className="pmp-field pmp-name"><span>Description</span><input value={item.description} maxLength="120" onChange={(event) => updateRow(setLabor, item.id, "description", event.target.value)} aria-invalid={showErrors && errors.has(`${prefix}.description`)} />{showErrors && errors.has(`${prefix}.description`) && <small>{errors.get(`${prefix}.description`)}</small>}</label>
                  <NumberField id={`${item.id}-hours`} label="Hours" value={item.hours} min="0.01" onChange={(value) => updateRow(setLabor, item.id, "hours", value)} error={showErrors && errors.get(`${prefix}.hours`)} />
                  <NumberField id={`${item.id}-rate`} label="Hourly rate" value={item.hourlyRate} onChange={(value) => updateRow(setLabor, item.id, "hourlyRate", value)} error={showErrors && errors.get(`${prefix}.hourlyRate`)} />
                  <strong className="pmp-inline-total">{valid ? money(Number(item.hours) * Number(item.hourlyRate)) : "—"}</strong>
                  <button className="pmp-remove" type="button" onClick={() => removeRow(setLabor, item.id)} aria-label={`Remove ${item.description || `labor ${index + 1}`}`}><Trash aria-hidden="true" /></button>
                </article>;
              })}
            </div>
          )}
        </section>

        <section className="pmp-section" aria-labelledby="other-heading">
          <div className="pmp-section-head">
            <div><Hammer aria-hidden="true" /><div><h2 id="other-heading">Other costs</h2><p>Fees, rentals, delivery, and supplies.</p></div></div>
            <button className="pmp-add" type="button" onClick={() => setOtherCosts((rows) => [...rows, blankOtherCost()])}><Plus aria-hidden="true" /> Add cost</button>
          </div>
          {otherCosts.length === 0 ? <EmptyPanel>No additional costs entered.</EmptyPanel> : (
            <div className="pmp-list">
              {otherCosts.map((item, index) => {
                const prefix = `otherCosts.${index}`;
                return <article className="pmp-row pmp-other-row" key={item.id}>
                  <label className="pmp-field pmp-name"><span>Description</span><input value={item.description} maxLength="120" onChange={(event) => updateRow(setOtherCosts, item.id, "description", event.target.value)} aria-invalid={showErrors && errors.has(`${prefix}.description`)} />{showErrors && errors.has(`${prefix}.description`) && <small>{errors.get(`${prefix}.description`)}</small>}</label>
                  <NumberField id={`${item.id}-amount`} label="Amount" value={item.amount} onChange={(value) => updateRow(setOtherCosts, item.id, "amount", value)} error={showErrors && errors.get(`${prefix}.amount`)} />
                  <button className="pmp-remove" type="button" onClick={() => removeRow(setOtherCosts, item.id)} aria-label={`Remove ${item.description || `cost ${index + 1}`}`}><Trash aria-hidden="true" /></button>
                </article>;
              })}
            </div>
          )}
        </section>
      </div>

      <section className="pmp-summary" aria-labelledby="summary-heading">
        <div className="pmp-summary-title"><Calculator aria-hidden="true" /><div><span className="pmp-kicker">Project estimate</span><h2 id="summary-heading">Cost summary</h2></div></div>
        <dl>
          <div><dt>Materials</dt><dd>{money(totals.materialSubtotal)}</dd></div>
          <div><dt>Labor</dt><dd>{money(totals.laborSubtotal)}</dd></div>
          <div><dt>Other</dt><dd>{money(totals.otherSubtotal)}</dd></div>
          <div className="pmp-grand-total"><dt>Estimated total</dt><dd>{money(totals.total)}</dd></div>
          {result.ok && totals.budget !== null && <div className={totals.overBudget ? "pmp-budget-over" : "pmp-budget-under"}><dt>{totals.overBudget ? "Over budget" : "Budget remaining"}</dt><dd>{money(Math.abs(totals.budgetDifference))}</dd></div>}
        </dl>
        <div className="pmp-summary-actions">
          <button className="pmp-calculate pmp-secondary" type="button" onClick={calculate}><Calculator aria-hidden="true" /> Validate plan</button>
          <button className="pmp-calculate" type="button" onClick={exportPlan}><DownloadSimple aria-hidden="true" /> Export JSON</button>
          {exportStatus && <small role="status">{exportStatus}</small>}
        </div>
      </section>
    </main>
  );
}
