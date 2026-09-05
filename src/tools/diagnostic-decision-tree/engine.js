// # Public tool contract
export { TOOL_MANIFEST } from "./manifest.js";

export const DEFAULT_SAFETY_NOTICES = Object.freeze([
  "Stop the workflow if the situation presents an immediate risk to people, property, or equipment.",
  "This tool organizes a configured process; it does not replace a qualified professional or required safety procedure.",
]);

const NODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const MAX_NODES = 500;
const MAX_ANSWERS_PER_NODE = 50;
const MAX_TEXT_LIST_ITEMS = 50;

// # Validation helpers
function issue(code, path, message) {
  return Object.freeze({ code, path, message });
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isText(value, maxLength = 500) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function validateOptionalText(value, path, errors, maxLength = 2_000) {
  if (value === undefined || value === null || value === "") return;
  if (!isText(value, maxLength)) {
    errors.push(
      issue("INVALID_TEXT", path, `Must be non-empty text up to ${maxLength} characters.`),
    );
  }
}

function validateTextList(value, path, errors, { required = false } = {}) {
  if (!Array.isArray(value) || (required && value.length === 0)) {
    errors.push(
      issue(
        "INVALID_LIST",
        path,
        required ? "Must contain at least one safety notice." : "Must be a list.",
      ),
    );
    return;
  }

  if (value.length > MAX_TEXT_LIST_ITEMS) {
    errors.push(
      issue(
        "TOO_MANY_ITEMS",
        path,
        `May contain at most ${MAX_TEXT_LIST_ITEMS} items.`,
      ),
    );
  }

  value.slice(0, MAX_TEXT_LIST_ITEMS + 1).forEach((item, index) => {
    if (!isText(item, 1_000)) {
      errors.push(
        issue(
          "INVALID_TEXT",
          `${path}[${index}]`,
          "Must be non-empty text up to 1000 characters.",
        ),
      );
    }
  });
}

// # Cycle detection
function findCycles(nodesById) {
  const colors = new Map();
  const stack = [];
  const cycles = [];

  function visit(nodeId) {
    colors.set(nodeId, "visiting");
    stack.push(nodeId);
    const node = nodesById.get(nodeId);

    if (node?.type === "question" && Array.isArray(node.answers)) {
      for (const answer of node.answers) {
        const nextId = answer?.nextNodeId;
        if (!nodesById.has(nextId)) continue;
        if (colors.get(nextId) === "visiting") {
          const cycleStart = stack.indexOf(nextId);
          cycles.push([...stack.slice(cycleStart), nextId]);
        } else if (!colors.has(nextId)) {
          visit(nextId);
        }
      }
    }

    stack.pop();
    colors.set(nodeId, "visited");
  }

  for (const nodeId of nodesById.keys()) {
    if (!colors.has(nodeId)) visit(nodeId);
  }

  return cycles;
}

function findReachableNodeIds(startNodeId, nodesById) {
  const reachable = new Set();
  const pending = nodesById.has(startNodeId) ? [startNodeId] : [];

  while (pending.length > 0) {
    const nodeId = pending.pop();
    if (reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    const node = nodesById.get(nodeId);
    if (node?.type === "question" && Array.isArray(node.answers)) {
      node.answers.forEach((answer) => {
        if (nodesById.has(answer?.nextNodeId)) pending.push(answer.nextNodeId);
      });
    }
  }

  return [...reachable];
}

// # Tree validation
export function validateDecisionTree(tree) {
  const errors = [];
  const warnings = [];

  if (!isRecord(tree)) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze([
        issue("INVALID_TREE", "tree", "Decision tree must be an object."),
      ]),
      warnings: Object.freeze([]),
      reachableNodeIds: Object.freeze([]),
    });
  }

  if (!isText(tree.id, 100) || !NODE_ID_PATTERN.test(tree.id)) {
    errors.push(
      issue(
        "INVALID_ID",
        "id",
        "Tree ID must use 1-100 letters, numbers, dots, colons, underscores, or hyphens.",
      ),
    );
  }
  if (!isText(tree.title, 160)) {
    errors.push(issue("INVALID_TITLE", "title", "Title is required (160 characters maximum)."));
  }
  validateOptionalText(tree.description, "description", errors);
  if (!isText(tree.systemBoundary, 500)) {
    errors.push(
      issue(
        "INVALID_SYSTEM_BOUNDARY",
        "systemBoundary",
        "Define the system or subsystem covered by this workflow.",
      ),
    );
  }
  if (!isText(tree.initialSymptom, 1_000)) {
    errors.push(
      issue(
        "INVALID_INITIAL_SYMPTOM",
        "initialSymptom",
        "Define the observed symptom, error, or malfunction.",
      ),
    );
  }
  validateTextList(tree.prerequisites, "prerequisites", errors, {
    required: true,
  });
  validateTextList(tree.safetyNotices, "safetyNotices", errors, {
    required: true,
  });

  if (!Array.isArray(tree.nodes) || tree.nodes.length === 0) {
    errors.push(issue("MISSING_NODES", "nodes", "At least one node is required."));
  } else if (tree.nodes.length > MAX_NODES) {
    errors.push(
      issue("TOO_MANY_NODES", "nodes", `A tree may contain at most ${MAX_NODES} nodes.`),
    );
  }

  const nodes = Array.isArray(tree.nodes) ? tree.nodes.slice(0, MAX_NODES + 1) : [];
  const nodesById = new Map();

  nodes.forEach((node, nodeIndex) => {
    const nodePath = `nodes[${nodeIndex}]`;
    if (!isRecord(node)) {
      errors.push(issue("INVALID_NODE", nodePath, "Node must be an object."));
      return;
    }

    if (!isText(node.id, 100) || !NODE_ID_PATTERN.test(node.id)) {
      errors.push(issue("INVALID_ID", `${nodePath}.id`, "Node ID has an invalid format."));
    } else if (nodesById.has(node.id)) {
      errors.push(issue("DUPLICATE_NODE", `${nodePath}.id`, `Duplicate node ID: ${node.id}.`));
    } else {
      nodesById.set(node.id, node);
    }

    if (node.type !== "question" && node.type !== "outcome") {
      errors.push(
        issue("INVALID_NODE_TYPE", `${nodePath}.type`, "Node type must be question or outcome."),
      );
      return;
    }

    if (node.type === "question") {
      if (!isText(node.prompt, 500)) {
        errors.push(
          issue("INVALID_PROMPT", `${nodePath}.prompt`, "Question prompt is required."),
        );
      }
      validateOptionalText(node.description, `${nodePath}.description`, errors);
      if (!isText(node.testAction, 1_000)) {
        errors.push(
          issue(
            "INVALID_TEST_ACTION",
            `${nodePath}.testAction`,
            "Define the specific diagnostic test action.",
          ),
        );
      }
      if (!isText(node.expectedCriterion, 1_000)) {
        errors.push(
          issue(
            "INVALID_EXPECTED_CRITERION",
            `${nodePath}.expectedCriterion`,
            "Define an exact numeric specification or clear boolean criterion.",
          ),
        );
      }
      validateOptionalText(node.testPoint, `${nodePath}.testPoint`, errors, 500);
      if (node.tools !== undefined) {
        validateTextList(node.tools, `${nodePath}.tools`, errors);
      }

      if (!Array.isArray(node.answers) || node.answers.length === 0) {
        errors.push(
          issue("MISSING_ANSWERS", `${nodePath}.answers`, "Question requires at least one answer."),
        );
      } else if (node.answers.length > MAX_ANSWERS_PER_NODE) {
        errors.push(
          issue(
            "TOO_MANY_ANSWERS",
            `${nodePath}.answers`,
            `A question may contain at most ${MAX_ANSWERS_PER_NODE} answers.`,
          ),
        );
      }

      const answerIds = new Set();
      const answers = Array.isArray(node.answers)
        ? node.answers.slice(0, MAX_ANSWERS_PER_NODE + 1)
        : [];
      answers.forEach((answer, answerIndex) => {
        const answerPath = `${nodePath}.answers[${answerIndex}]`;
        if (!isRecord(answer)) {
          errors.push(issue("INVALID_ANSWER", answerPath, "Answer must be an object."));
          return;
        }
        if (!isText(answer.id, 100) || !NODE_ID_PATTERN.test(answer.id)) {
          errors.push(issue("INVALID_ID", `${answerPath}.id`, "Answer ID has an invalid format."));
        } else if (answerIds.has(answer.id)) {
          errors.push(
            issue(
              "DUPLICATE_ANSWER",
              `${answerPath}.id`,
              `Duplicate answer ID within node ${node.id || nodeIndex}: ${answer.id}.`,
            ),
          );
        } else {
          answerIds.add(answer.id);
        }
        if (!isText(answer.label, 240)) {
          errors.push(issue("INVALID_LABEL", `${answerPath}.label`, "Answer label is required."));
        }
        if (!isText(answer.nextNodeId, 100) || !NODE_ID_PATTERN.test(answer.nextNodeId)) {
          errors.push(
            issue("INVALID_TARGET", `${answerPath}.nextNodeId`, "Answer target is invalid."),
          );
        }
        validateOptionalText(answer.description, `${answerPath}.description`, errors, 1_000);
      });
    } else {
      if (!isText(node.title, 240)) {
        errors.push(issue("INVALID_TITLE", `${nodePath}.title`, "Outcome title is required."));
      }
      if (!isText(node.summary, 2_000)) {
        errors.push(issue("INVALID_SUMMARY", `${nodePath}.summary`, "Outcome summary is required."));
      }
      validateOptionalText(node.safetyNotice, `${nodePath}.safetyNotice`, errors, 1_000);
      if (node.actions !== undefined) {
        validateTextList(node.actions, `${nodePath}.actions`, errors);
      }
      validateTextList(node.verificationSteps, `${nodePath}.verificationSteps`, errors, {
        required: true,
      });
    }
  });

  if (!isText(tree.startNodeId, 100) || !nodesById.has(tree.startNodeId)) {
    errors.push(
      issue("INVALID_START", "startNodeId", "Start node must reference an existing node."),
    );
  }

  nodes.forEach((node, nodeIndex) => {
    if (node?.type !== "question" || !Array.isArray(node.answers)) return;
    node.answers.forEach((answer, answerIndex) => {
      if (isRecord(answer) && isText(answer.nextNodeId, 100) && !nodesById.has(answer.nextNodeId)) {
        errors.push(
          issue(
            "MISSING_TARGET",
            `nodes[${nodeIndex}].answers[${answerIndex}].nextNodeId`,
            `Target node does not exist: ${answer.nextNodeId}.`,
          ),
        );
      }
    });
  });

  findCycles(nodesById).forEach((cycle, index) => {
    errors.push(
      issue("CYCLE_DETECTED", `cycles[${index}]`, `Cycle detected: ${cycle.join(" → ")}.`),
    );
  });

  const reachableNodeIds = findReachableNodeIds(tree.startNodeId, nodesById);
  const reachable = new Set(reachableNodeIds);
  nodesById.forEach((_node, nodeId) => {
    if (!reachable.has(nodeId)) {
      warnings.push(
        issue("UNREACHABLE_NODE", `nodes.${nodeId}`, `Node is unreachable from the start: ${nodeId}.`),
      );
    }
  });

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    reachableNodeIds: Object.freeze(reachableNodeIds),
  });
}

// # Session lifecycle
export class DecisionTreeValidationError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = "DecisionTreeValidationError";
    this.issues = issues;
  }
}

function assertValidTree(tree) {
  const validation = validateDecisionTree(tree);
  if (!validation.valid) {
    throw new DecisionTreeValidationError(
      "The decision tree configuration is invalid.",
      validation.errors,
    );
  }
  return validation;
}

function assertSession(tree, session) {
  if (!isRecord(session) || session.treeId !== tree.id) {
    throw new DecisionTreeValidationError("Session does not belong to this decision tree.");
  }
  if (!Array.isArray(session.history) || !isText(session.currentNodeId, 100)) {
    throw new DecisionTreeValidationError("Session state is invalid.");
  }

  if (session.history.length > tree.nodes.length) {
    throw new DecisionTreeValidationError("Session path exceeds the configured workflow.");
  }

  let expectedNodeId = tree.startNodeId;
  for (const entry of session.history) {
    const fromNode = getNode(tree, expectedNodeId);
    const answer = fromNode?.type === "question"
      ? fromNode.answers.find((candidate) => candidate.id === entry?.answerId)
      : null;
    if (
      !answer ||
      entry.fromNodeId !== expectedNodeId ||
      entry.toNodeId !== answer.nextNodeId ||
      entry.question !== fromNode.prompt ||
      entry.answerLabel !== answer.label
    ) {
      throw new DecisionTreeValidationError("Session history does not match the configured workflow.");
    }
    expectedNodeId = answer.nextNodeId;
  }

  const currentNode = getNode(tree, session.currentNodeId);
  const expectedStatus = currentNode?.type === "outcome" ? "complete" : "active";
  if (!currentNode || session.currentNodeId !== expectedNodeId || session.status !== expectedStatus) {
    throw new DecisionTreeValidationError("Session position does not match its path history.");
  }
}

export function getNode(tree, nodeId) {
  return tree.nodes.find((node) => node.id === nodeId) ?? null;
}

export function createDecisionTreeSession(tree) {
  assertValidTree(tree);
  const startNode = getNode(tree, tree.startNodeId);
  return Object.freeze({
    treeId: tree.id,
    currentNodeId: startNode.id,
    status: startNode.type === "outcome" ? "complete" : "active",
    history: Object.freeze([]),
  });
}

export function chooseDecisionTreeAnswer(tree, session, answerId) {
  const validation = assertValidTree(tree);
  assertSession(tree, session);
  if (session.status === "complete") {
    throw new DecisionTreeValidationError("A completed workflow cannot accept another answer.");
  }

  const currentNode = getNode(tree, session.currentNodeId);
  if (!currentNode || currentNode.type !== "question") {
    throw new DecisionTreeValidationError("The current session node is not a valid question.");
  }
  const answer = currentNode.answers.find((candidate) => candidate.id === answerId);
  if (!answer) {
    throw new DecisionTreeValidationError("The selected answer is not valid for this question.");
  }

  const visited = new Set([
    session.currentNodeId,
    ...session.history.map((entry) => entry.fromNodeId),
  ]);
  if (visited.has(answer.nextNodeId) || session.history.length >= validation.reachableNodeIds.length) {
    throw new DecisionTreeValidationError("The selected path would repeat a node and was stopped.");
  }

  const nextNode = getNode(tree, answer.nextNodeId);
  if (!nextNode) {
    throw new DecisionTreeValidationError("The selected answer points to a missing node.");
  }

  const history = [
    ...session.history,
    Object.freeze({
      fromNodeId: currentNode.id,
      question: currentNode.prompt,
      answerId: answer.id,
      answerLabel: answer.label,
      toNodeId: nextNode.id,
    }),
  ];

  return Object.freeze({
    treeId: tree.id,
    currentNodeId: nextNode.id,
    status: nextNode.type === "outcome" ? "complete" : "active",
    history: Object.freeze(history),
  });
}

export function goBackDecisionTree(tree, session) {
  assertValidTree(tree);
  assertSession(tree, session);
  if (session.history.length === 0) return session;

  const previous = session.history[session.history.length - 1];
  return Object.freeze({
    treeId: tree.id,
    currentNodeId: previous.fromNodeId,
    status: "active",
    history: Object.freeze(session.history.slice(0, -1)),
  });
}

export function restartDecisionTree(tree) {
  return createDecisionTreeSession(tree);
}

export function getDecisionTreeProgress(tree, session) {
  const validation = assertValidTree(tree);
  assertSession(tree, session);
  const currentNode = getNode(tree, session.currentNodeId);
  return Object.freeze({
    answered: session.history.length,
    visited: session.history.length + 1,
    reachable: validation.reachableNodeIds.length,
    complete: currentNode?.type === "outcome",
  });
}
