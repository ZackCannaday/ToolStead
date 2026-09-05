import { useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  CheckCircle,
  Code,
  Info,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  analyzeAccessibility,
  AuditInputError,
  MAX_FINDINGS,
  MAX_HTML_LENGTH,
} from "./analyzer.js";
import "./styles.css";

const SEVERITIES = ["all", "critical", "serious", "moderate", "minor"];

function sentence(value) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function ResultsSummary({ report }) {
  return (
    <section className="ts-a11y-summary" aria-labelledby="a11y-results-title">
      <div className="ts-a11y-score" data-score={report.score}>
        <span>Automated score</span>
        <strong>{report.score}</strong>
        <small>out of 100</small>
      </div>
      <div className="ts-a11y-summary-copy">
        <span className="ts-a11y-kicker">WCAG 2.2 baseline</span>
        <h2 id="a11y-results-title">{sentence(report.conformance)}</h2>
        <p>
          Audited {report.analyzedElements.toLocaleString("en-US")} elements.
          Automated checks found {report.summary.total.toLocaleString("en-US")} issue
          {report.summary.total === 1 ? "" : "s"}.
        </p>
        <div className="ts-a11y-counts" aria-label="Findings by impact">
          {SEVERITIES.slice(1).map((severity) => (
            <span key={severity} data-severity={severity}>
              <strong>{report.summary[severity]}</strong> {severity}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function FindingCard({ finding }) {
  return (
    <details className="ts-a11y-finding" data-severity={finding.severity}>
      <summary>
        <span className="ts-a11y-severity">{finding.severity}</span>
        <span className="ts-a11y-finding-title">
          <strong>{finding.message}</strong>
          <small>
            WCAG {finding.wcag} · {finding.criterion} · Level {finding.level}
          </small>
        </span>
        <span className="ts-a11y-location">Line {finding.line}</span>
      </summary>
      <div className="ts-a11y-finding-body">
        <dl>
          <div>
            <dt>Location</dt>
            <dd><code>{finding.selector}</code></dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd><code>{finding.evidence}</code></dd>
          </div>
          <div>
            <dt>Remediation</dt>
            <dd>{finding.remediation}</dd>
          </div>
        </dl>
      </div>
    </details>
  );
}

// # Tool workspace
export default function AccessibilityAuditor() {
  const [html, setHtml] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [severity, setSeverity] = useState("all");

  const visibleFindings = useMemo(() => {
    if (!report) return [];
    return severity === "all"
      ? report.findings
      : report.findings.filter((finding) => finding.severity === severity);
  }, [report, severity]);

  const runAudit = (event) => {
    event.preventDefault();
    setError("");
    if (!html.trim()) {
      setReport(null);
      setError("Paste HTML markup before running the audit.");
      return;
    }
    try {
      setReport(analyzeAccessibility(html));
      setSeverity("all");
    } catch (reason) {
      setReport(null);
      setError(
        reason instanceof AuditInputError
          ? reason.message
          : "The audit could not process this markup. Review the input and try again.",
      );
    }
  };

  const clearAudit = () => {
    setHtml("");
    setReport(null);
    setError("");
    setSeverity("all");
  };

  return (
    <main className="ts-a11y-workspace">
      <header className="ts-a11y-header">
        <div className="ts-a11y-heading-mark" aria-hidden="true">
          <ShieldCheck weight="duotone" />
        </div>
        <div>
          <span className="ts-a11y-kicker">Quality & compliance</span>
          <h1>Accessibility Auditor</h1>
          <p>
            Find deterministic markup barriers against WCAG 2.2 Level AA and
            get code-level remediation guidance.
          </p>
        </div>
      </header>

      <form className="ts-a11y-input-panel" onSubmit={runAudit} noValidate>
        <div className="ts-a11y-panel-heading">
          <div>
            <h2><Code aria-hidden="true" /> HTML source</h2>
            <p>Markup stays in this browser and is never rendered or executed.</p>
          </div>
          <span className="ts-a11y-character-count">
            {html.length.toLocaleString("en-US")} / {MAX_HTML_LENGTH.toLocaleString("en-US")}
          </span>
        </div>
        <label htmlFor="ts-a11y-html" className="ts-a11y-label">
          Paste a component, template, or complete page
        </label>
        <textarea
          id="ts-a11y-html"
          value={html}
          onChange={(event) => {
            setHtml(event.target.value);
            setReport(null);
            setError("");
            setSeverity("all");
          }}
          maxLength={MAX_HTML_LENGTH}
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={'<main>\n  <h1>Page title</h1>\n</main>'}
          aria-describedby={`ts-a11y-input-help${error ? " ts-a11y-input-error" : ""}`}
          aria-invalid={Boolean(error)}
        />
        <div className="ts-a11y-input-footer">
          <p id="ts-a11y-input-help">
            Static analysis cannot verify real screen-reader behavior, focus order,
            or computed styles. Those checks remain in the manual review plan.
          </p>
          <div className="ts-a11y-actions">
            {(html || report) && (
              <button type="button" className="ts-a11y-button secondary" onClick={clearAudit}>
                <ArrowCounterClockwise aria-hidden="true" /> Clear
              </button>
            )}
            <button type="submit" className="ts-a11y-button primary">
              <ShieldCheck aria-hidden="true" /> Run accessibility audit
            </button>
          </div>
        </div>
        {error && (
          <p id="ts-a11y-input-error" className="ts-a11y-error" role="alert">
            <WarningCircle weight="fill" aria-hidden="true" /> {error}
          </p>
        )}
      </form>

      {!report && !error && (
        <section className="ts-a11y-empty" aria-labelledby="a11y-empty-title">
          <ShieldCheck weight="duotone" aria-hidden="true" />
          <h2 id="a11y-empty-title">Ready for markup</h2>
          <p>
            Results include severity, exact WCAG criteria, source evidence,
            element location, and a concrete remediation path.
          </p>
        </section>
      )}

      {report && (
        <div className="ts-a11y-results">
          <p className="ts-a11y-live" role="status">
            Audit complete. Score {report.score} out of 100 with {report.summary.total} findings.
          </p>
          <ResultsSummary report={report} />

          <section className="ts-a11y-results-panel" aria-labelledby="a11y-findings-title">
            <div className="ts-a11y-panel-heading">
              <div>
                <h2 id="a11y-findings-title">Findings</h2>
                <p>Prioritized by user impact, then source location.</p>
              </div>
              <div className="ts-a11y-filter" aria-label="Filter findings by severity">
                {SEVERITIES.map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={severity === item}
                    onClick={() => setSeverity(item)}
                  >
                    {item === "all" ? `All ${report.summary.total}` : `${item} ${report.summary[item]}`}
                  </button>
                ))}
              </div>
            </div>

            {report.findingsTruncated && (
              <p className="ts-a11y-error" role="status">
                <WarningCircle weight="fill" aria-hidden="true" /> Showing the first {MAX_FINDINGS.toLocaleString("en-US")} findings. Reduce the markup scope to review additional issues safely.
              </p>
            )}

            {visibleFindings.length ? (
              <div className="ts-a11y-finding-list">
                {visibleFindings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            ) : (
              <div className="ts-a11y-filter-empty" role="status">
                <CheckCircle weight="fill" aria-hidden="true" />
                No {severity === "all" ? "automated" : severity} findings detected.
              </div>
            )}
          </section>

          <div className="ts-a11y-review-grid">
            <section className="ts-a11y-review-card" aria-labelledby="a11y-passed-title">
              <h2 id="a11y-passed-title"><CheckCircle weight="fill" aria-hidden="true" /> Passed checks</h2>
              {report.passedChecks.length ? (
                <ul>
                  {report.passedChecks.map((check) => (
                    <li key={check.ruleId}>
                      <span>WCAG {check.wcag}</span> {check.criterion}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No automated rule has passed yet.</p>
              )}
            </section>
            <section className="ts-a11y-review-card manual" aria-labelledby="a11y-manual-title">
              <h2 id="a11y-manual-title"><Info weight="fill" aria-hidden="true" /> Manual review required</h2>
              <ul>
                {report.manualChecks.map((check) => (
                  <li key={check.id}>{check.label}</li>
                ))}
              </ul>
              <p>
                Passing this scan is not a WCAG conformance claim. Complete
                assistive-technology and keyboard testing before release.
              </p>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
