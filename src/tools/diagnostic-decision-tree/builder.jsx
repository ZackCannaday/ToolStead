import { useState } from "react";
import { Plus, Trash, Warning } from "@phosphor-icons/react";
import { validateDecisionTree } from "./engine.js";

// # Blank workflow draft
function createDraft(initialTree) {
  if (initialTree) return JSON.parse(JSON.stringify(initialTree));
  return {
    id: "",
    title: "",
    description: "",
    systemBoundary: "",
    initialSymptom: "",
    prerequisites: [],
    safetyNotices: [],
    startNodeId: "",
    nodes: [],
  };
}

function linesToList(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listToLines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function nextId(nodes, prefix) {
  const existing = new Set(nodes.map((node) => node.id));
  let number = 1;
  while (existing.has(`${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function normalizeTreeId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

// # Workflow authoring UI
export default function DecisionTreeBuilder({ initialTree = null, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => createDraft(initialTree));
  const [attempted, setAttempted] = useState(false);
  const validation = validateDecisionTree(draft);

  function setField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function addNode(type) {
    setDraft((current) => {
      const id = nextId(current.nodes, type === "question" ? "test" : "outcome");
      const node =
        type === "question"
          ? {
              id,
              type,
              prompt: "",
              description: "",
              testAction: "",
              expectedCriterion: "",
              testPoint: "",
              tools: [],
              answers: [],
            }
          : {
              id,
              type,
              title: "",
              summary: "",
              safetyNotice: "",
              verificationSteps: [],
              actions: [],
            };
      return {
        ...current,
        startNodeId: current.startNodeId || id,
        nodes: [...current.nodes, node],
      };
    });
  }

  function updateNode(nodeId, update) {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...update } : node,
      ),
    }));
  }

  function removeNode(nodeId) {
    setDraft((current) => ({
      ...current,
      startNodeId: current.startNodeId === nodeId ? "" : current.startNodeId,
      nodes: current.nodes
        .filter((node) => node.id !== nodeId)
        .map((node) =>
          node.type === "question"
            ? {
                ...node,
                answers: node.answers.filter((answer) => answer.nextNodeId !== nodeId),
              }
            : node,
        ),
    }));
  }

  function addAnswer(nodeId) {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== nodeId || node.type !== "question") return node;
        const id = nextId(
          node.answers.map((answer) => ({ id: answer.id })),
          "answer",
        );
        return {
          ...node,
          answers: [
            ...node.answers,
            { id, label: "", description: "", nextNodeId: "" },
          ],
        };
      }),
    }));
  }

  function updateAnswer(nodeId, answerId, update) {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId && node.type === "question"
          ? {
              ...node,
              answers: node.answers.map((answer) =>
                answer.id === answerId ? { ...answer, ...update } : answer,
              ),
            }
          : node,
      ),
    }));
  }

  function removeAnswer(nodeId, answerId) {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId && node.type === "question"
          ? {
              ...node,
              answers: node.answers.filter((answer) => answer.id !== answerId),
            }
          : node,
      ),
    }));
  }

  function submit(event) {
    event.preventDefault();
    setAttempted(true);
    if (!validation.valid) return;
    onSave(draft);
  }

  return (
    <form className="diagnostic-builder" onSubmit={submit} noValidate>
      <section className="diagnostic-builder__section" aria-labelledby="workflow-details-title">
        <div className="diagnostic-builder__section-heading">
          <div>
            <span className="diagnostic-tree__eyebrow">Step 1</span>
            <h2 id="workflow-details-title">Define the problem</h2>
          </div>
          <p>Set a narrow boundary and one observable starting symptom.</p>
        </div>

        <div className="diagnostic-builder__grid">
          <Field label="Workflow name" required>
            <input
              value={draft.title}
              onChange={(event) => {
                const title = event.target.value;
                setDraft((current) => ({
                  ...current,
                  title,
                  id: initialTree ? current.id : normalizeTreeId(title),
                }));
              }}
              maxLength="160"
              required
            />
          </Field>
          <Field label="System boundary" hint="The exact system or subsystem covered." required>
            <input
              value={draft.systemBoundary}
              onChange={(event) => setField("systemBoundary", event.target.value)}
              maxLength="500"
              required
            />
          </Field>
          <Field label="Observed symptom or error" wide required>
            <textarea
              value={draft.initialSymptom}
              onChange={(event) => setField("initialSymptom", event.target.value)}
              rows="3"
              maxLength="1000"
              required
            />
          </Field>
          <Field label="Description" wide>
            <textarea
              value={draft.description}
              onChange={(event) => setField("description", event.target.value)}
              rows="2"
              maxLength="2000"
            />
          </Field>
          <Field label="Prerequisite conditions" hint="One required condition per line." required>
            <textarea
              value={listToLines(draft.prerequisites)}
              onChange={(event) => setField("prerequisites", linesToList(event.target.value))}
              rows="4"
              required
            />
          </Field>
          <Field label="Critical safety precautions" hint="One stop condition or precaution per line." required>
            <textarea
              value={listToLines(draft.safetyNotices)}
              onChange={(event) => setField("safetyNotices", linesToList(event.target.value))}
              rows="4"
              required
            />
          </Field>
        </div>
      </section>

      <section className="diagnostic-builder__section" aria-labelledby="workflow-nodes-title">
        <div className="diagnostic-builder__section-heading">
          <div>
            <span className="diagnostic-tree__eyebrow">Step 2</span>
            <h2 id="workflow-nodes-title">Build the diagnostic path</h2>
          </div>
          <p>Order simple, probable, non-invasive tests before advanced checks.</p>
        </div>

        <div className="diagnostic-builder__node-actions">
          <button type="button" className="diagnostic-tree__utility" onClick={() => addNode("question")}>
            <Plus aria-hidden="true" /> Add diagnostic test
          </button>
          <button type="button" className="diagnostic-tree__utility" onClick={() => addNode("outcome")}>
            <Plus aria-hidden="true" /> Add terminal outcome
          </button>
        </div>

        {draft.nodes.length === 0 ? (
          <div className="diagnostic-builder__blank">
            <p>No tests or outcomes added. Start with the quickest safe test.</p>
          </div>
        ) : (
          <div className="diagnostic-builder__nodes">
            {draft.nodes.map((node, index) => (
              <NodeEditor
                key={node.id}
                node={node}
                index={index}
                nodes={draft.nodes}
                onUpdate={(update) => updateNode(node.id, update)}
                onRemove={() => removeNode(node.id)}
                onAddAnswer={() => addAnswer(node.id)}
                onUpdateAnswer={(answerId, update) =>
                  updateAnswer(node.id, answerId, update)
                }
                onRemoveAnswer={(answerId) => removeAnswer(node.id, answerId)}
              />
            ))}
          </div>
        )}

        <Field label="Starting test" required>
          <select
            value={draft.startNodeId}
            onChange={(event) => setField("startNodeId", event.target.value)}
            required
          >
            <option value="">Select the first test</option>
            {draft.nodes
              .filter((node) => node.type === "question")
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {node.prompt.trim() || `Diagnostic test ${draft.nodes.indexOf(node) + 1}`}
                </option>
              ))}
          </select>
        </Field>
      </section>

      {attempted && !validation.valid && (
        <div className="diagnostic-tree__runtime-error diagnostic-builder__validation" role="alert">
          <Warning aria-hidden="true" />
          <div>
            <strong>Complete the workflow before running it.</strong>
            <ul>
              {validation.errors.map((error, index) => (
                <li key={`${error.path}-${error.code}-${index}`}>{error.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <footer className="diagnostic-builder__footer">
        {onCancel && (
          <button type="button" className="diagnostic-tree__utility" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="diagnostic-tree__primary">
          Validate and run workflow
        </button>
      </footer>
    </form>
  );
}

// # Node editor
function NodeEditor({
  node,
  index,
  nodes,
  onUpdate,
  onRemove,
  onAddAnswer,
  onUpdateAnswer,
  onRemoveAnswer,
}) {
  return (
    <fieldset className="diagnostic-builder__node">
      <legend>
        {node.type === "question" ? `Diagnostic test ${index + 1}` : `Terminal outcome ${index + 1}`}
      </legend>
      <button
        type="button"
        className="diagnostic-builder__remove"
        onClick={onRemove}
        aria-label={`Remove ${node.type === "question" ? "diagnostic test" : "terminal outcome"} ${index + 1}`}
      >
        <Trash aria-hidden="true" /> Remove
      </button>

      {node.type === "question" ? (
        <>
          <div className="diagnostic-builder__grid">
            <Field label="Question shown to the user" wide required>
              <input
                value={node.prompt}
                onChange={(event) => onUpdate({ prompt: event.target.value })}
                maxLength="500"
                required
              />
            </Field>
            <Field label="Specific test action" wide required>
              <textarea
                value={node.testAction}
                onChange={(event) => onUpdate({ testAction: event.target.value })}
                rows="3"
                maxLength="1000"
                required
              />
            </Field>
            <Field label="Expected specification or boolean result" wide required>
              <textarea
                value={node.expectedCriterion}
                onChange={(event) => onUpdate({ expectedCriterion: event.target.value })}
                rows="2"
                maxLength="1000"
                required
              />
            </Field>
            <Field label="Test point or location">
              <input
                value={node.testPoint}
                onChange={(event) => onUpdate({ testPoint: event.target.value })}
                maxLength="500"
              />
            </Field>
            <Field label="Required tools" hint="One tool per line.">
              <textarea
                value={listToLines(node.tools)}
                onChange={(event) => onUpdate({ tools: linesToList(event.target.value) })}
                rows="3"
              />
            </Field>
            <Field label="Supporting instruction" wide>
              <textarea
                value={node.description}
                onChange={(event) => onUpdate({ description: event.target.value })}
                rows="2"
                maxLength="2000"
              />
            </Field>
          </div>

          <div className="diagnostic-builder__answers-editor">
            <div className="diagnostic-builder__subheading">
              <h3>Result branches</h3>
              <button type="button" className="diagnostic-tree__utility" onClick={onAddAnswer}>
                <Plus aria-hidden="true" /> Add branch
              </button>
            </div>
            {node.answers.map((answer, answerIndex) => (
              <div className="diagnostic-builder__answer" key={answer.id}>
                <Field label={`Branch ${answerIndex + 1} result`} required>
                  <input
                    value={answer.label}
                    onChange={(event) =>
                      onUpdateAnswer(answer.id, { label: event.target.value })
                    }
                    maxLength="240"
                    required
                  />
                </Field>
                <Field label="Next test or outcome" required>
                  <select
                    value={answer.nextNodeId}
                    onChange={(event) =>
                      onUpdateAnswer(answer.id, { nextNodeId: event.target.value })
                    }
                    required
                  >
                    <option value="">Select destination</option>
                    {nodes
                      .filter((candidate) => candidate.id !== node.id)
                      .map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.type === "question" ? "Test" : "Outcome"}: {candidate.prompt || candidate.title || candidate.id}
                        </option>
                      ))}
                  </select>
                </Field>
                <button
                  type="button"
                  className="diagnostic-builder__remove diagnostic-builder__remove--answer"
                  onClick={() => onRemoveAnswer(answer.id)}
                  aria-label={`Remove branch ${answerIndex + 1}`}
                >
                  <Trash aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="diagnostic-builder__grid">
          <Field label="Outcome title" required>
            <input
              value={node.title}
              onChange={(event) => onUpdate({ title: event.target.value })}
              maxLength="240"
              required
            />
          </Field>
          <Field label="Safety checkpoint">
            <input
              value={node.safetyNotice}
              onChange={(event) => onUpdate({ safetyNotice: event.target.value })}
              maxLength="1000"
            />
          </Field>
          <Field label="Isolated result or root-cause summary" wide required>
            <textarea
              value={node.summary}
              onChange={(event) => onUpdate({ summary: event.target.value })}
              rows="3"
              maxLength="2000"
              required
            />
          </Field>
          <Field label="Post-work verification steps" hint="One confirmation step per line." required>
            <textarea
              value={listToLines(node.verificationSteps)}
              onChange={(event) =>
                onUpdate({ verificationSteps: linesToList(event.target.value) })
              }
              rows="4"
              required
            />
          </Field>
          <Field label="Next actions" hint="One evidence-based action per line.">
            <textarea
              value={listToLines(node.actions)}
              onChange={(event) => onUpdate({ actions: linesToList(event.target.value) })}
              rows="4"
            />
          </Field>
        </div>
      )}
    </fieldset>
  );
}

function Field({ label, hint, required = false, wide = false, children }) {
  return (
    <label className={`diagnostic-builder__field${wide ? " diagnostic-builder__field--wide" : ""}`}>
      <span>
        {label}
        {required && <em aria-hidden="true"> *</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
