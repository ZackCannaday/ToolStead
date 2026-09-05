import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const runnerSource = await readFile(
  new URL("../src/tools/diagnostic-decision-tree/index.jsx", import.meta.url),
  "utf8",
);

// # Runner safety contract
test("run mode renders every authored diagnostic instruction before branches", () => {
  const actionIndex = runnerSource.indexOf("{node.testAction}");
  const pointIndex = runnerSource.indexOf("{node.testPoint}");
  const toolsIndex = runnerSource.indexOf("node.tools.map");
  const criterionIndex = runnerSource.indexOf("{node.expectedCriterion}");
  const answersIndex = runnerSource.indexOf('className="diagnostic-tree__answers"');

  for (const sourceIndex of [actionIndex, pointIndex, toolsIndex, criterionIndex]) {
    assert.ok(sourceIndex >= 0, "missing an authored diagnostic instruction");
    assert.ok(sourceIndex < answersIndex, "diagnostic instructions must precede branch controls");
  }
});

test("outcomes expose authored verification steps as checklist controls", () => {
  assert.match(runnerSource, /node\.verificationSteps\.map/);
  assert.match(runnerSource, /<input type="checkbox"/);
  assert.match(runnerSource, /Post-work verification checklist/);
});

// # Authoring lifecycle contract
test("edit and cancel preserve the saved tree", () => {
  assert.match(appSource, /const \[mode, setMode\] = useState\("author"\)/);
  assert.match(appSource, /initialTree=\{tree\}/);
  assert.match(appSource, /onCancel=\{tree \? \(\) => setMode\("run"\) : undefined\}/);
  assert.match(appSource, /onClick=\{\(\) => setMode\("author"\)\}/);
  assert.doesNotMatch(appSource, /Edit workflow[\s\S]{0,120}setTree\(null\)/);
});
