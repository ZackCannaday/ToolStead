import { useEffect, useMemo, useState } from "react";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  CheckCircle,
  Warning,
} from "@phosphor-icons/react";
import {
  DEFAULT_SAFETY_NOTICES,
  TOOL_MANIFEST,
  chooseDecisionTreeAnswer,
  createDecisionTreeSession,
  getDecisionTreeProgress,
  getNode,
  goBackDecisionTree,
  restartDecisionTree,
  validateDecisionTree,
} from "./engine.js";
import "./styles.css";

export * from "./engine.js";

// # Diagnostic workspace
export default function DiagnosticDecisionTreeWorkspace({
  tree = null,
  className = "",
  onComplete,
  onStateChange,
}) {
  const validation = useMemo(() => validateDecisionTree(tree), [tree]);
  const [session, setSession] = useState(() =>
    validation.valid ? createDecisionTreeSession(tree) : null,
  );
  const [runtimeError, setRuntimeError] = useState("");

  useEffect(() => {
    setRuntimeError("");
    setSession(validation.valid ? createDecisionTreeSession(tree) : null);
  }, [tree, validation.valid]);

  const notices =
    validation.valid && tree.safetyNotices.length > 0
      ? tree.safetyNotices
      : DEFAULT_SAFETY_NOTICES;

  function updateSession(nextSession) {
    setSession(nextSession);
    onStateChange?.(nextSession);
    const nextNode = getNode(tree, nextSession.currentNodeId);
    if (nextNode?.type === "outcome") onComplete?.(nextNode, nextSession);
  }

  function selectAnswer(answerId) {
    try {
      setRuntimeError("");
      updateSession(chooseDecisionTreeAnswer(tree, session, answerId));
    } catch (error) {
      setRuntimeError(error.message || "The workflow could not continue safely.");
    }
  }

  function goBack() {
    try {
      setRuntimeError("");
      updateSession(goBackDecisionTree(tree, session));
    } catch (error) {
      setRuntimeError(error.message || "The previous step could not be restored.");
    }
  }

  function restart() {
    try {
      setRuntimeError("");
      updateSession(restartDecisionTree(tree));
    } catch (error) {
      setRuntimeError(error.message || "The workflow could not be restarted.");
    }
  }

  return (
    <section
      className={`diagnostic-tree ${className}`.trim()}
      aria-labelledby="diagnostic-tree-title"
    >
      <header className="diagnostic-tree__header">
        <div>
          <span className="diagnostic-tree__eyebrow">Guided workflow</span>
          <h1 id="diagnostic-tree-title">
            {validation.valid ? tree.title : TOOL_MANIFEST.name}
          </h1>
          <p>
            {validation.valid
              ? tree.description || TOOL_MANIFEST.description
              : "Add a validated decision-tree configuration to begin."}
          </p>
        </div>
        {session && (
          <button className="diagnostic-tree__utility" type="button" onClick={restart}>
            <ArrowCounterClockwise aria-hidden="true" />
            Restart
          </button>
        )}
      </header>

      <aside className="diagnostic-tree__safety" aria-labelledby="diagnostic-safety-title">
        <Warning aria-hidden="true" weight="fill" />
        <div>
          <h2 id="diagnostic-safety-title">Safety first</h2>
          <ul>
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      </aside>

      {validation.valid && (
        <section className="diagnostic-tree__context" aria-labelledby="diagnostic-context-title">
          <div>
            <span className="diagnostic-tree__eyebrow">Before you begin</span>
            <h2 id="diagnostic-context-title">Workflow boundary</h2>
            <p><strong>System:</strong> {tree.systemBoundary}</p>
            <p><strong>Starting symptom:</strong> {tree.initialSymptom}</p>
          </div>
          <div>
            <h3>Prerequisites</h3>
            <ul>
              {tree.prerequisites.map((prerequisite) => (
                <li key={prerequisite}>{prerequisite}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {!validation.valid ? (
        <ConfigurationError errors={validation.errors} />
      ) : (
        session && (
          <ActiveWorkflow
            tree={tree}
            session={session}
            runtimeError={runtimeError}
            onAnswer={selectAnswer}
            onBack={goBack}
            onRestart={restart}
          />
        )
      )}
    </section>
  );
}

// # Configuration state
function ConfigurationError({ errors }) {
  const hasTree = !errors.some((error) => error.code === "INVALID_TREE");
  return (
    <div className="diagnostic-tree__panel diagnostic-tree__empty" role="status">
      <span className="diagnostic-tree__empty-icon" aria-hidden="true">
        <Warning weight="bold" />
      </span>
      <h2>{hasTree ? "Workflow unavailable" : "No workflow configured"}</h2>
      <p>
        {hasTree
          ? "Correct the configuration issues before this workflow can run."
          : "This workspace intentionally contains no prefilled diagnostic procedure."}
      </p>
      {hasTree && (
        <ul className="diagnostic-tree__errors">
          {errors.map((error, index) => (
            <li key={`${error.path}-${error.code}-${index}`}>{error.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// # Active workflow
function ActiveWorkflow({
  tree,
  session,
  runtimeError,
  onAnswer,
  onBack,
  onRestart,
}) {
  const currentNode = getNode(tree, session.currentNodeId);
  const progress = getDecisionTreeProgress(tree, session);
  const progressPercent = progress.complete
    ? 100
    : Math.min(99, Math.round((progress.visited / progress.reachable) * 100));

  return (
    <div className="diagnostic-tree__layout">
      <aside className="diagnostic-tree__history" aria-labelledby="diagnostic-history-title">
        <div className="diagnostic-tree__history-heading">
          <h2 id="diagnostic-history-title">Path history</h2>
          <span>{progress.answered} answered</span>
        </div>
        {session.history.length === 0 ? (
          <p className="diagnostic-tree__muted">Your selected path will appear here.</p>
        ) : (
          <ol>
            {session.history.map((entry) => (
              <li key={`${entry.fromNodeId}-${entry.answerId}`}>
                <span>{entry.question}</span>
                <strong>{entry.answerLabel}</strong>
              </li>
            ))}
          </ol>
        )}
      </aside>

      <div className="diagnostic-tree__panel diagnostic-tree__stage">
        <div className="diagnostic-tree__progress-row">
          <span>{progress.complete ? "Outcome reached" : "Workflow progress"}</span>
          <span>{progressPercent}%</span>
        </div>
        <div
          className="diagnostic-tree__progress"
          role="progressbar"
          aria-label="Workflow progress"
          aria-valuenow={progressPercent}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>

        {runtimeError && (
          <div className="diagnostic-tree__runtime-error" role="alert">
            <Warning aria-hidden="true" />
            {runtimeError}
          </div>
        )}

        {currentNode.type === "question" ? (
          <QuestionNode node={currentNode} onAnswer={onAnswer} />
        ) : (
          <OutcomeNode node={currentNode} />
        )}

        <footer className="diagnostic-tree__actions">
          <button
            className="diagnostic-tree__utility"
            type="button"
            onClick={onBack}
            disabled={session.history.length === 0}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </button>
          {progress.complete && (
            <button className="diagnostic-tree__primary" type="button" onClick={onRestart}>
              <ArrowCounterClockwise aria-hidden="true" />
              Start again
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function QuestionNode({ node, onAnswer }) {
  return (
    <fieldset className="diagnostic-tree__question">
      <legend>{node.prompt}</legend>
      {node.description && <p>{node.description}</p>}
      <section className="diagnostic-tree__test-card" aria-labelledby={`test-action-${node.id}`}>
        <span className="diagnostic-tree__eyebrow">Perform this test first</span>
        <h2 id={`test-action-${node.id}`}>{node.testAction}</h2>
        <dl>
          {node.testPoint && (
            <div>
              <dt>Test point</dt>
              <dd>{node.testPoint}</dd>
            </div>
          )}
          {Array.isArray(node.tools) && node.tools.length > 0 && (
            <div>
              <dt>Required tools</dt>
              <dd>
                <ul>
                  {node.tools.map((tool) => <li key={tool}>{tool}</li>)}
                </ul>
              </dd>
            </div>
          )}
          <div>
            <dt>Expected criterion</dt>
            <dd>{node.expectedCriterion}</dd>
          </div>
        </dl>
      </section>
      <h2 className="diagnostic-tree__branch-heading">Record the observed result</h2>
      <div className="diagnostic-tree__answers">
        {node.answers.map((answer) => (
          <button key={answer.id} type="button" onClick={() => onAnswer(answer.id)}>
            <span>
              <strong>{answer.label}</strong>
              {answer.description && <small>{answer.description}</small>}
            </span>
            <span aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function OutcomeNode({ node }) {
  return (
    <article className="diagnostic-tree__outcome" aria-live="polite">
      <CheckCircle aria-hidden="true" weight="fill" />
      <span className="diagnostic-tree__eyebrow">Completed outcome</span>
      <h2>{node.title}</h2>
      <p>{node.summary}</p>
      {node.safetyNotice && (
        <div className="diagnostic-tree__outcome-safety">
          <Warning aria-hidden="true" weight="fill" />
          <strong>{node.safetyNotice}</strong>
        </div>
      )}
      {Array.isArray(node.actions) && node.actions.length > 0 && (
        <div className="diagnostic-tree__next-actions">
          <h3>Recommended next actions</h3>
          <ul>
            {node.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="diagnostic-tree__verification">
        <h3>Post-work verification checklist</h3>
        <p>Complete every check before treating this outcome as verified.</p>
        <ul>
          {node.verificationSteps.map((step, index) => (
            <li key={`${node.id}-verification-${index}`}>
              <label>
                <input type="checkbox" />
                <span>{step}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
