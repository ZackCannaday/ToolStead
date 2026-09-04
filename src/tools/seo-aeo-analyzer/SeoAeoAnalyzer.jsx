import { useId, useState } from "react";
import {
  ArrowCounterClockwise,
  CheckCircle,
  Gauge,
  Lightbulb,
  MagnifyingGlass,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { TOOL_MANIFEST, analyzeSeoAeoContent } from "./analyzer.js";
import "./styles.css";

const EMPTY_INPUT = Object.freeze({
  url: "",
  title: "",
  metaDescription: "",
  headings: "",
  body: "",
});

const STATUS_ICON = {
  pass: CheckCircle,
  warning: WarningCircle,
  error: XCircle,
};

// # Analyzer workspace
export default function SeoAeoAnalyzer() {
  const formId = useId();
  const [input, setInput] = useState(EMPTY_INPUT);
  const [result, setResult] = useState(() => analyzeSeoAeoContent());
  const [hasRun, setHasRun] = useState(false);

  const updateField = (field) => (event) => {
    setInput((current) => ({ ...current, [field]: event.target.value }));
  };

  const runAnalysis = (event) => {
    event.preventDefault();
    setResult(analyzeSeoAeoContent(input));
    setHasRun(true);
  };

  const clearAnalysis = () => {
    setInput(EMPTY_INPUT);
    setResult(analyzeSeoAeoContent());
    setHasRun(false);
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
            <div>
              <span className="tsa-step">Input</span>
              <h2>Page content</h2>
            </div>
            <button className="tsa-clear" type="button" onClick={clearAnalysis} disabled={!hasRun && !Object.values(input).some(Boolean)}>
              <ArrowCounterClockwise aria-hidden="true" />
              Clear
            </button>
          </div>

          <label className="tsa-field" htmlFor={`${formId}-url`}>
            <span>Canonical URL</span>
            <input
              id={`${formId}-url`}
              type="url"
              inputMode="url"
              value={input.url}
              onChange={updateField("url")}
              placeholder="https://example.com/service-page"
              aria-describedby={`${formId}-url-help`}
            />
            <small id={`${formId}-url-help`}>Include the full HTTP or HTTPS address.</small>
          </label>

          <label className="tsa-field" htmlFor={`${formId}-title-input`}>
            <span>Page title</span>
            <input
              id={`${formId}-title-input`}
              value={input.title}
              onChange={updateField("title")}
              maxLength={200}
              placeholder="Primary topic and customer value"
            />
            <small>{input.title.length} characters · target 30–60</small>
          </label>

          <label className="tsa-field" htmlFor={`${formId}-meta`}>
            <span>Meta description</span>
            <textarea
              id={`${formId}-meta`}
              value={input.metaDescription}
              onChange={updateField("metaDescription")}
              rows={3}
              maxLength={400}
              placeholder="Accurately summarize what the visitor will find on this page."
            />
            <small>{input.metaDescription.length} characters · target 120–160</small>
          </label>

          <label className="tsa-field" htmlFor={`${formId}-headings`}>
            <span>Heading outline</span>
            <textarea
              id={`${formId}-headings`}
              value={input.headings}
              onChange={updateField("headings")}
              rows={6}
              placeholder={"H1: Main page topic\nH2: What does the service include?\nH2: How does the process work?"}
            />
            <small>One heading per line using H1: through H6: or Markdown # syntax.</small>
          </label>

          <label className="tsa-field" htmlFor={`${formId}-body`}>
            <span>Visible body copy</span>
            <textarea
              id={`${formId}-body`}
              value={input.body}
              onChange={updateField("body")}
              rows={11}
              placeholder="Paste the page’s main visible copy here."
            />
            <small>Plain text is enough. Nothing is uploaded.</small>
          </label>

          <button className="tsa-run" type="submit">
            <MagnifyingGlass aria-hidden="true" />
            Analyze page
          </button>
        </form>

        <section className="tsa-panel tsa-results" aria-live="polite" aria-busy="false">
          {!hasRun || result.status === "empty" ? (
            <div className="tsa-empty">
              <span className="tsa-empty-icon"><Gauge aria-hidden="true" /></span>
              <h2>Your audit will appear here</h2>
              <p>Add the page fields you have, then run the analyzer for a prioritized score and specific fixes.</p>
              <ul>
                <li>Search snippet fundamentals</li>
                <li>Heading structure and topic alignment</li>
                <li>Answer-engine readiness and readability</li>
              </ul>
            </div>
          ) : result.status === "error" ? (
            <div className="tsa-error-state" role="alert">
              <XCircle aria-hidden="true" />
              <div>
                <h2>Analysis needs attention</h2>
                <p>{result.summary}</p>
                {result.errors.map((error) => <p key={error.field}>{error.message}</p>)}
              </div>
            </div>
          ) : (
            <AuditResults result={result} />
          )}
        </section>
      </div>
    </section>
  );
}

// # Results presentation
function AuditResults({ result }) {
  const passed = result.findings.filter((item) => item.status === "pass").length;
  return (
    <div className="tsa-audit">
      <div className="tsa-score-row">
        <div className="tsa-score" style={{ "--score": `${result.score * 3.6}deg` }} aria-label={`Score ${result.score} out of 100`}>
          <strong>{result.score}</strong>
          <span>/ 100</span>
        </div>
        <div>
          <span className="tsa-step">Overall score</span>
          <h2>{result.band}</h2>
          <p>{result.summary}</p>
          <span className="tsa-pass-count">{passed} of {result.findings.length} checks passed</span>
        </div>
      </div>

      <dl className="tsa-metrics">
        <div><dt>Body words</dt><dd>{result.metrics.bodyWords}</dd></div>
        <div><dt>Headings</dt><dd>{result.metrics.headingCount}</dd></div>
        <div><dt>Question headings</dt><dd>{result.metrics.questionHeadingCount}</dd></div>
        <div><dt>Avg. sentence</dt><dd>{result.metrics.averageSentenceWords || "—"} {result.metrics.averageSentenceWords ? "words" : ""}</dd></div>
      </dl>

      <div className="tsa-findings-heading">
        <div>
          <span className="tsa-step">Action plan</span>
          <h2>Evidence and fixes</h2>
        </div>
        <Lightbulb aria-hidden="true" />
      </div>

      <div className="tsa-findings">
        {result.findings.map((item) => {
          const Icon = STATUS_ICON[item.status];
          return (
            <article className={`tsa-finding tsa-status-${item.status}`} key={item.id}>
              <Icon className="tsa-status-icon" aria-hidden="true" />
              <div>
                <div className="tsa-finding-title">
                  <div>
                    <span>{item.area}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <strong>{item.points}/{item.maxPoints}</strong>
                </div>
                <p><b>Evidence:</b> {item.evidence}</p>
                {item.status !== "pass" && <p><b>Fix:</b> {item.remediation}</p>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
