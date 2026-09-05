import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  CheckCircle,
  ClipboardText,
  DownloadSimple,
  Gauge,
  Lightbulb,
  MagnifyingGlass,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { INPUT_LIMITS, TOOL_MANIFEST, analyzeSeoAeoContent, buildAuditReport, validateSeoAeoInput } from "./analyzer.js";
import "./styles.css";

const EMPTY_INPUT = Object.freeze({ url: "", title: "", metaDescription: "", headings: "", body: "" });
const STATUS_ICON = { pass: CheckCircle, warning: WarningCircle, error: XCircle };

// # Analyzer workspace
export default function SeoAeoAnalyzer() {
  const formId = useId();
  const summaryRef = useRef(null);
  const workerRef = useRef(null);
  const requestRef = useRef(0);
  const pendingRef = useRef(null);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [result, setResult] = useState(() => analyzeSeoAeoContent());
  const [hasRun, setHasRun] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {
    if (hasRun && result.status === "error") summaryRef.current?.focus();
  }, [hasRun, result]);

  const fieldError = (field) => result.status === "error" ? result.errors.find((error) => error.field === field) : null;
  const describedBy = (field) => [`${formId}-${field}-help`, fieldError(field) ? `${formId}-${field}-error` : ""].filter(Boolean).join(" ");

  const updateField = (field) => (event) => {
    const value = event.target.value;
    if (value === input[field]) return;

    requestRef.current += 1;
    pendingRef.current = null;
    setInput((current) => ({ ...current, [field]: value }));
    setResult(analyzeSeoAeoContent());
    setHasRun(false);
    setIsAnalyzing(false);
  };

  const applyResult = (nextResult, requestId) => {
    if (requestId !== requestRef.current) return;
    pendingRef.current = null;
    setResult(nextResult);
    setIsAnalyzing(false);
  };

  const runAnalysis = (event) => {
    event.preventDefault();
    const validation = validateSeoAeoInput(input);
    const isEmpty = validation.input && Object.values(validation.input).every((value) => !value);
    setHasRun(true);
    if (!validation.input || validation.errors.length || isEmpty) {
      setResult(analyzeSeoAeoContent(input));
      return;
    }

    const requestId = ++requestRef.current;
    pendingRef.current = { requestId, input };
    setIsAnalyzing(true);
    if (typeof Worker === "undefined") {
      window.setTimeout(() => applyResult(analyzeSeoAeoContent(input), requestId), 0);
      return;
    }

    if (!workerRef.current) {
      const worker = new Worker(new URL("./analyzer.worker.js", import.meta.url), { type: "module" });
      worker.onmessage = ({ data }) => applyResult(data.result, data.requestId);
      worker.onerror = () => {
        worker.terminate();
        workerRef.current = null;
        const pending = pendingRef.current;
        if (pending) window.setTimeout(() => applyResult(analyzeSeoAeoContent(pending.input), pending.requestId), 0);
      };
      workerRef.current = worker;
    }
    workerRef.current.postMessage({ requestId, input });
  };

  const clearAnalysis = () => {
    requestRef.current += 1;
    setInput(EMPTY_INPUT);
    setResult(analyzeSeoAeoContent());
    setHasRun(false);
    setIsAnalyzing(false);
  };

  return (
    <section className="tsa-workspace" aria-labelledby={`${formId}-title`}>
      <header className="tsa-header">
        <div>
          <span className="tsa-eyebrow">Search performance</span>
          <h1 id={`${formId}-title`}>{TOOL_MANIFEST.name}</h1>
          <p>{TOOL_MANIFEST.description}</p>
        </div>
        <span className="tsa-private-badge">Runs in your browser</span>
      </header>

      <div className="tsa-grid">
        <form className="tsa-panel tsa-form" onSubmit={runAnalysis} noValidate>
          <div className="tsa-panel-heading">
            <div><span className="tsa-step">Input</span><h2>Page content</h2></div>
            <button className="tsa-clear" type="button" onClick={clearAnalysis} disabled={!hasRun && !Object.values(input).some(Boolean)}>
              <ArrowCounterClockwise aria-hidden="true" />Clear
            </button>
          </div>

          <Field label="Canonical URL" id={`${formId}-url`} helpId={`${formId}-url-help`} errorId={`${formId}-url-error`} help={`Full HTTP or HTTPS address · maximum ${INPUT_LIMITS.url.toLocaleString()} characters`} error={fieldError("url")}>
            <input id={`${formId}-url`} type="url" inputMode="url" value={input.url} onChange={updateField("url")} maxLength={INPUT_LIMITS.url} placeholder="https://example.com/service-page" aria-invalid={Boolean(fieldError("url"))} aria-describedby={describedBy("url")} />
          </Field>

          <Field label="Page title" id={`${formId}-title-input`} helpId={`${formId}-title-help`} errorId={`${formId}-title-error`} help={`${input.title.length}/${INPUT_LIMITS.title} characters · SEO target 30–60`} error={fieldError("title")}>
            <input id={`${formId}-title-input`} value={input.title} onChange={updateField("title")} maxLength={INPUT_LIMITS.title} placeholder="Primary topic and customer value" aria-invalid={Boolean(fieldError("title"))} aria-describedby={describedBy("title")} />
          </Field>

          <Field label="Meta description" id={`${formId}-metaDescription`} helpId={`${formId}-metaDescription-help`} errorId={`${formId}-metaDescription-error`} help={`${input.metaDescription.length}/${INPUT_LIMITS.metaDescription} characters · SEO target 140–160`} error={fieldError("metaDescription")}>
            <textarea id={`${formId}-metaDescription`} value={input.metaDescription} onChange={updateField("metaDescription")} rows={3} maxLength={INPUT_LIMITS.metaDescription} placeholder="Accurately summarize what the visitor will find." aria-invalid={Boolean(fieldError("metaDescription"))} aria-describedby={describedBy("metaDescription")} />
          </Field>

          <Field label="Heading outline" id={`${formId}-headings`} helpId={`${formId}-headings-help`} errorId={`${formId}-headings-error`} help={`${input.headings.length.toLocaleString()}/${INPUT_LIMITS.headings.toLocaleString()} characters · use H1: through H6: or Markdown`} error={fieldError("headings")}>
            <textarea id={`${formId}-headings`} value={input.headings} onChange={updateField("headings")} rows={6} maxLength={INPUT_LIMITS.headings} placeholder={"H1: Main page topic\nH2: What does the service include?"} aria-invalid={Boolean(fieldError("headings"))} aria-describedby={describedBy("headings")} />
          </Field>

          <Field label="Visible body copy" id={`${formId}-body`} helpId={`${formId}-body-help`} errorId={`${formId}-body-error`} help={`${input.body.length.toLocaleString()}/${INPUT_LIMITS.body.toLocaleString()} characters · analyzed locally`} error={fieldError("body")}>
            <textarea id={`${formId}-body`} value={input.body} onChange={updateField("body")} rows={11} maxLength={INPUT_LIMITS.body} placeholder="Paste the page’s main visible copy here." aria-invalid={Boolean(fieldError("body"))} aria-describedby={describedBy("body")} />
          </Field>

          <small className="tsa-aggregate-limit">Combined maximum: {INPUT_LIMITS.aggregate.toLocaleString()} characters.</small>
          <button className="tsa-run" type="submit" disabled={isAnalyzing}>
            <MagnifyingGlass aria-hidden="true" />{isAnalyzing ? "Analyzing…" : "Analyze page"}
          </button>
        </form>

        <section className="tsa-panel tsa-results" aria-live="polite" aria-busy={isAnalyzing}>
          {isAnalyzing ? (
            <div className="tsa-empty"><span className="tsa-empty-icon"><Gauge aria-hidden="true" /></span><h2>Analyzing page</h2><p>The bounded audit is running away from the interface thread.</p></div>
          ) : !hasRun || result.status === "empty" ? (
            <div className="tsa-empty"><span className="tsa-empty-icon"><Gauge aria-hidden="true" /></span><h2>Your audit will appear here</h2><p>Add the page fields you have, then run the analyzer for a five-pillar score and specific fixes.</p><ul><li>Keyword intent and readability</li><li>Answer readiness and E-E-A-T evidence</li><li>Structure, technical SEO, and schema</li></ul></div>
          ) : result.status === "error" ? (
            <ErrorSummary result={result} formId={formId} summaryRef={summaryRef} />
          ) : (
            <AuditResults result={result} />
          )}
        </section>
      </div>
    </section>
  );
}

// # Form feedback
function Field({ label, id, helpId, errorId, help, error, children }) {
  return <label className="tsa-field" htmlFor={id}><span>{label}</span>{children}<small id={helpId}>{help}</small>{error && <small className="tsa-field-error" id={errorId}>{error.message}</small>}</label>;
}

function ErrorSummary({ result, formId, summaryRef }) {
  const fieldTarget = { url: "url", title: "title-input", metaDescription: "metaDescription", headings: "headings", body: "body" };
  return (
    <div className="tsa-error-state" role="alert" tabIndex={-1} ref={summaryRef}>
      <XCircle aria-hidden="true" />
      <div><h2>Analysis needs attention</h2><p>{result.summary}</p><ul>{result.errors.map((error, index) => <li key={`${error.field}-${index}`}>{error.field === "input" ? error.message : <a href={`#${formId}-${fieldTarget[error.field]}`}>{error.message}</a>}</li>)}</ul></div>
    </div>
  );
}

// # Results presentation
function AuditResults({ result }) {
  const [copyStatus, setCopyStatus] = useState("");
  const report = buildAuditReport(result);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report);
      setCopyStatus("Report copied.");
    } catch {
      setCopyStatus("Copy was blocked. Download the report instead.");
    }
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([report], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "seo-aeo-audit.md";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setCopyStatus("Report downloaded.");
  };

  return (
    <div className="tsa-audit">
      <div className="tsa-score-row">
        <div className="tsa-score" style={{ "--score": `${result.score * 3.6}deg` }} aria-label={`Grade ${result.grade}, score ${result.score} out of 100`}><strong>{result.grade}</strong><span>{result.score} / 100</span></div>
        <div><span className="tsa-step">Overall grade</span><h2>{result.band}</h2><p>{result.summary}</p><span className="tsa-pass-count">Five pillars · 20 points each</span></div>
      </div>

      <dl className="tsa-metrics tsa-metrics-wide">
        <div><dt>Primary keyword</dt><dd>{result.metrics.primaryKeyword}</dd></div>
        <div><dt>Intent</dt><dd>{result.metrics.searchIntent}</dd></div>
        <div><dt>Readability</dt><dd>{result.metrics.fleschReadingEase ?? "—"} · {result.metrics.readingLevel}</dd></div>
        <div><dt>Keyword density</dt><dd>{result.metrics.keywordDensity}%</dd></div>
        <div><dt>Body words</dt><dd>{result.metrics.bodyWords}</dd></div>
        <div><dt>Headings / questions</dt><dd>{result.metrics.headingCount} / {result.metrics.questionHeadingCount}</dd></div>
      </dl>

      <div className="tsa-pillar-grid" aria-label="Five-pillar scorecard">
        {result.pillars.map((pillar) => <article className={`tsa-pillar tsa-status-${pillar.status}`} key={pillar.id}><span>{pillar.name}</span><strong>{pillar.score}<small>/20</small></strong></article>)}
      </div>

      <div className="tsa-report-actions">
        <button type="button" onClick={copyReport}><ClipboardText aria-hidden="true" />Copy report</button>
        <button type="button" onClick={downloadReport}><DownloadSimple aria-hidden="true" />Download .md</button>
        <span role="status">{copyStatus}</span>
      </div>

      <div className="tsa-findings-heading"><div><span className="tsa-step">Action plan</span><h2>Evidence and fixes</h2></div><Lightbulb aria-hidden="true" /></div>
      <div className="tsa-findings">
        {result.findings.map((item) => {
          const Icon = STATUS_ICON[item.status];
          return <article className={`tsa-finding tsa-status-${item.status}`} key={`${item.pillarId}-${item.id}`}><Icon className="tsa-status-icon" aria-hidden="true" /><div><div className="tsa-finding-title"><div><span>{item.area}</span><h3>{item.title}</h3></div><strong>{item.points}/{item.maxPoints}</strong></div><p><b>Evidence:</b> {item.evidence}</p>{item.status !== "pass" && <p><b>Fix:</b> {item.remediation}</p>}</div></article>;
        })}
      </div>
      <p className="tsa-disclaimer">This deterministic report analyzes only supplied content. It does not verify live rankings, indexing, citations, or page behavior.</p>
    </div>
  );
}
