import assert from "node:assert/strict";
import test from "node:test";
import {
  TOOL_MANIFEST,
  DecisionTreeValidationError,
  chooseDecisionTreeAnswer,
  createDecisionTreeSession,
  getDecisionTreeProgress,
  goBackDecisionTree,
  restartDecisionTree,
  validateDecisionTree,
} from "../src/tools/diagnostic-decision-tree/engine.js";

// # Test-only configuration
function validTree() {
  return {
    id: "test-workflow",
    title: "Configured workflow",
    description: "A test-only tree used to verify deterministic traversal.",
    systemBoundary: "Test-only workflow boundary",
    initialSymptom: "The test harness needs a deterministic branch result.",
    startNodeId: "start",
    prerequisites: ["Load the isolated test fixture."],
    safetyNotices: ["Stop when the configured safety condition is met."],
    nodes: [
      {
        id: "start",
        type: "question",
        prompt: "Choose a test branch.",
        testAction: "Select one of the test-only branch controls.",
        testPoint: "Fixture control group A",
        tools: ["Test harness", "Result recorder"],
        expectedCriterion: "Exactly one configured branch is selected.",
        answers: [
          { id: "short", label: "Short path", nextNodeId: "complete" },
          { id: "long", label: "Long path", nextNodeId: "follow-up" },
        ],
      },
      {
        id: "follow-up",
        type: "question",
        prompt: "Finish the test path?",
        testAction: "Select the completion control.",
        expectedCriterion: "The completion control returns true.",
        answers: [{ id: "finish", label: "Finish", nextNodeId: "complete" }],
      },
      {
        id: "complete",
        type: "outcome",
        title: "Test complete",
        summary: "The configured test path reached its terminal node.",
        actions: ["Record the test result."],
        verificationSteps: ["Confirm the terminal node ID is complete."],
      },
    ],
  };
}

test("manifest exposes an implemented deterministic tool", () => {
  assert.equal(TOOL_MANIFEST.key, "diagnostic-decision-tree");
  assert.equal(TOOL_MANIFEST.maturity, "foundation");
  assert.ok(TOOL_MANIFEST.capabilities.includes("Cycle and invalid-path protection"));
});

test("validates a complete, acyclic configuration", () => {
  const result = validateDecisionTree(validTree());

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.reachableNodeIds.length, 3);
});

test("accepts blank optional authoring fields", () => {
  const tree = validTree();
  tree.description = "";
  tree.nodes[0].description = "";
  tree.nodes[2].safetyNotice = "";

  assert.equal(validateDecisionTree(tree).valid, true);
});

test("retains the authored test procedure and verification contract", () => {
  const tree = validTree();
  const session = createDecisionTreeSession(tree);
  const testNode = tree.nodes.find((node) => node.id === session.currentNodeId);
  const outcome = tree.nodes.find((node) => node.id === "complete");

  assert.equal(testNode.testAction, "Select one of the test-only branch controls.");
  assert.equal(testNode.testPoint, "Fixture control group A");
  assert.deepEqual(testNode.tools, ["Test harness", "Result recorder"]);
  assert.equal(testNode.expectedCriterion, "Exactly one configured branch is selected.");
  assert.deepEqual(outcome.verificationSteps, [
    "Confirm the terminal node ID is complete.",
  ]);
});

test("requires explicit safety notices", () => {
  const tree = validTree();
  tree.safetyNotices = [];

  const result = validateDecisionTree(tree);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.path === "safetyNotices"));
});

test("reports duplicate nodes and missing answer targets", () => {
  const tree = validTree();
  tree.nodes.push({ ...tree.nodes[2] });
  tree.nodes[0].answers[0].nextNodeId = "missing";

  const result = validateDecisionTree(tree);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "DUPLICATE_NODE"));
  assert.ok(result.errors.some((error) => error.code === "MISSING_TARGET"));
});

test("rejects cycles before a session can start", () => {
  const tree = validTree();
  tree.nodes[1].answers[0].nextNodeId = "start";

  const result = validateDecisionTree(tree);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "CYCLE_DETECTED"));
  assert.throws(
    () => createDecisionTreeSession(tree),
    (error) =>
      error instanceof DecisionTreeValidationError &&
      error.issues.some((entry) => entry.code === "CYCLE_DETECTED"),
  );
});

test("traverses deterministically and records immutable path history", () => {
  const tree = validTree();
  const initial = createDecisionTreeSession(tree);
  const followUp = chooseDecisionTreeAnswer(tree, initial, "long");
  const complete = chooseDecisionTreeAnswer(tree, followUp, "finish");

  assert.equal(initial.currentNodeId, "start");
  assert.equal(followUp.currentNodeId, "follow-up");
  assert.equal(complete.currentNodeId, "complete");
  assert.equal(complete.status, "complete");
  assert.deepEqual(
    complete.history.map((entry) => entry.answerId),
    ["long", "finish"],
  );
  assert.equal(Object.isFrozen(complete.history), true);
});

test("back and restart restore safe earlier states", () => {
  const tree = validTree();
  const initial = createDecisionTreeSession(tree);
  const followUp = chooseDecisionTreeAnswer(tree, initial, "long");
  const complete = chooseDecisionTreeAnswer(tree, followUp, "finish");
  const backedUp = goBackDecisionTree(tree, complete);
  const restarted = restartDecisionTree(tree);

  assert.equal(backedUp.currentNodeId, "follow-up");
  assert.equal(backedUp.status, "active");
  assert.equal(backedUp.history.length, 1);
  assert.deepEqual(restarted, initial);
});

test("blocks answers outside the current question and after completion", () => {
  const tree = validTree();
  const initial = createDecisionTreeSession(tree);
  assert.throws(
    () => chooseDecisionTreeAnswer(tree, initial, "finish"),
    /not valid for this question/,
  );

  const complete = chooseDecisionTreeAnswer(tree, initial, "short");
  assert.throws(
    () => chooseDecisionTreeAnswer(tree, complete, "short"),
    /completed workflow/,
  );
});

test("rejects tampered session history", () => {
  const tree = validTree();
  const session = {
    ...createDecisionTreeSession(tree),
    currentNodeId: "complete",
    status: "complete",
    history: [
      {
        fromNodeId: "start",
        question: "Choose a test branch.",
        answerId: "long",
        answerLabel: "Short path",
        toNodeId: "complete",
      },
    ],
  };

  assert.throws(
    () => goBackDecisionTree(tree, session),
    /history does not match/,
  );
});

test("calculates progress without mutating the session", () => {
  const tree = validTree();
  const initial = createDecisionTreeSession(tree);
  const followUp = chooseDecisionTreeAnswer(tree, initial, "long");
  const progress = getDecisionTreeProgress(tree, followUp);

  assert.deepEqual(progress, {
    answered: 1,
    visited: 2,
    reachable: 3,
    complete: false,
  });
  assert.equal(initial.history.length, 0);
});
