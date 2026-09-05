import { useMemo, useState } from "react";
import { exportTestCasesCsv, generateTestCases, validateRequirements } from "./engine.js";
import { TOOL_MANIFEST } from "./manifest.js";
import "./styles.css";

const TYPE_LABELS = {
  positive: "Positive",
  negative: "Negative",
  boundary: "Boundary",
};

// # Download local export
function downloadCsv(csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "toolstead-test-cases.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// # Render generator workspace
export default function TestCaseGenerator() {
  const [sourceType, setSourceType] = useState("requirements");
  const [requirements, setRequirements] = useState("");
  const [testCases, setTestCases] = useState([]);
  const [issues, setIssues] = useState({ errors: [], warnings: [] });
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const filteredCases = useMemo(
    () =>
      testCases.filter(
        (testCase) =>
          (typeFilter === "all" || testCase.type === typeFilter) &&
          (priorityFilter === "all" || testCase.priority === priorityFilter),
      ),
    [priorityFilter, testCases, typeFilter],
  );
  const csv = useMemo(() => exportTestCasesCsv(filteredCases), [filteredCases]);

  // # Generate current requirements
  const handleGenerate = (event) => {
    event.preventDefault();
    const validation = validateRequirements(requirements, { sourceType });
    setIssues({ errors: validation.errors, warnings: validation.warnings });
    if (!validation.valid) {
      setTestCases([]);
      setExpandedId(null);
      return;
    }
    const generated = generateTestCases(requirements, { sourceType });
    setTestCases(generated);
    setExpandedId(generated[0]?.id ?? null);
  };

  return (
    <section className="tcg-workspace" aria-labelledby="tcg-title">
      {/* # Workspace heading */}
      <header className="tcg-header">
        <div>
          <p className="tcg-eyebrow">Quality &amp; Testing</p>
          <h1 id="tcg-title">{TOOL_MANIFEST.name}</h1>
          <p>{TOOL_MANIFEST.description}</p>
        </div>
        <div className="tcg-offline-badge" aria-label="Runs locally without network access">
          <span aria-hidden="true" /> Local processing
        </div>
      </header>

      <div className="tcg-layout">
        {/* # Requirement input panel */}
        <form className="tcg-panel tcg-input-panel" onSubmit={handleGenerate} noValidate>
          <div className="tcg-panel-heading">
            <div>
              <span className="tcg-step">01</span>
              <h2>Requirements</h2>
            </div>
            <span>{requirements.split(/\n/).filter((line) => line.trim()).length}/200</span>
          </div>
          <label className="tcg-source-label" htmlFor="tcg-source-type">
            Source type
            <select
              id="tcg-source-type"
              value={sourceType}
              onChange={(event) => {
                setSourceType(event.target.value);
                setTestCases([]);
                setIssues({ errors: [], warnings: [] });
              }}
            >
              <option value="requirements">Written requirements</option>
              <option value="function">Function source code</option>
              <option value="api">API specification</option>
              <option value="schema">JSON or SQL schema</option>
            </select>
          </label>
          <label htmlFor="tcg-requirements">
            {sourceType === "requirements" ? "One requirement per line" : "Source definition"}
            <span>
              {sourceType === "requirements"
                ? " Optional IDs: REQ-001: description"
                : "Public contracts and declared constraints only"}
            </span>
          </label>
          <textarea
            id="tcg-requirements"
            value={requirements}
            onChange={(event) => {
              setRequirements(event.target.value);
              setTestCases([]);
              setIssues({ errors: [], warnings: [] });
              setExpandedId(null);
            }}
            rows="15"
            maxLength="400000"
            placeholder={`Paste ${sourceType === "requirements" ? "requirements" : sourceType === "function" ? "function source code" : sourceType === "api" ? "an API specification" : "a JSON or SQL schema"} here`}
            aria-describedby="tcg-input-help tcg-validation"
          />
          <p id="tcg-input-help" className="tcg-help">
            Public behavior produces positive, negative, and boundary cases using Arrange–Act–Assert steps.
          </p>

          <div id="tcg-validation" className="tcg-validation" aria-live="polite">
            {issues.errors.map((issue) => (
              <p className="tcg-error" key={`${issue.code}-${issue.requirementId ?? issue.message}`}>
                {issue.message}
              </p>
            ))}
            {issues.warnings.length > 0 && (
              <details>
                <summary>{issues.warnings.length} requirement quality warning(s)</summary>
                <ul>
                  {issues.warnings.map((issue, index) => (
                    <li key={`${issue.requirementId}-${index}`}>
                      <strong>{issue.requirementId}:</strong> {issue.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          <button className="tcg-primary-button" type="submit">
            Generate test cases
          </button>
        </form>

        {/* # Generated case panel */}
        <section className="tcg-panel tcg-results-panel" aria-labelledby="tcg-results-title">
          <div className="tcg-panel-heading">
            <div>
              <span className="tcg-step">02</span>
              <h2 id="tcg-results-title">Test cases</h2>
            </div>
            <strong>{filteredCases.length}</strong>
          </div>

          <div className="tcg-toolbar" aria-label="Test case controls">
            <label>
              Type
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                <option value="positive">Positive</option>
                <option value="negative">Negative</option>
                <option value="boundary">Boundary</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="all">All priorities</option>
                <option value="P0">P0 — Critical</option>
                <option value="P1">P1 — High</option>
                <option value="P2">P2 — Standard</option>
                <option value="P3">P3 — Low</option>
              </select>
            </label>
            <button
              className="tcg-secondary-button"
              type="button"
              onClick={() => downloadCsv(csv)}
              disabled={filteredCases.length === 0}
            >
              Export CSV
            </button>
          </div>

          {filteredCases.length === 0 ? (
            <div className="tcg-empty-state" role="status">
              <span aria-hidden="true">✓</span>
              <h3>No test cases yet</h3>
              <p>Enter testable requirements, then generate a traceable test set.</p>
            </div>
          ) : (
            <div className="tcg-case-list">
              {filteredCases.map((testCase) => {
                const expanded = expandedId === testCase.id;
                return (
                  <article className="tcg-case" key={testCase.id}>
                    <button
                      className="tcg-case-summary"
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`${testCase.id}-details`}
                      onClick={() => setExpandedId(expanded ? null : testCase.id)}
                    >
                      <span className={`tcg-type tcg-type-${testCase.type}`}>
                        {TYPE_LABELS[testCase.type]}
                      </span>
                      <span className="tcg-case-copy">
                        <strong>{testCase.title}</strong>
                        <small>{testCase.id} · traces {testCase.requirementId}</small>
                      </span>
                      <span className="tcg-priority">{testCase.priority}</span>
                      <span className="tcg-chevron" aria-hidden="true">⌄</span>
                    </button>
                    {expanded && (
                      <div className="tcg-case-details" id={`${testCase.id}-details`}>
                        <div>
                          <h3>Preconditions</h3>
                          <ul>
                            {testCase.preconditions.map((item) => <li key={item}>{item}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h3>Steps</h3>
                          <ol>
                            {testCase.steps.map((step) => <li key={step.number}>{step.action}</li>)}
                          </ol>
                        </div>
                        <div className="tcg-expected">
                          <h3>Expected result</h3>
                          <p>{testCase.expectedResult}</p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* # CSV output preview */}
      {testCases.length > 0 && (
        <details className="tcg-panel tcg-csv-preview">
          <summary>Preview CSV export</summary>
          <textarea value={csv} readOnly rows="8" aria-label="CSV export preview" />
        </details>
      )}
    </section>
  );
}
