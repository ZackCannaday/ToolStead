import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import ToolWorkspaceErrorBoundary, {
  ToolWorkspaceErrorFallback,
} from "../src/components/tool-workspace-error-boundary.js";

test("fallback provides an accessible, tool-specific recovery state", () => {
  const markup = renderToStaticMarkup(
    ToolWorkspaceErrorFallback({
      onBack() {},
      onReload() {},
      toolName: "Accessibility Compliance Auditor",
    }),
  );

  assert.match(markup, /role="alert"/);
  assert.match(markup, /aria-live="assertive"/);
  assert.match(markup, /aria-labelledby="tool-workspace-error-title"/);
  assert.match(markup, /Accessibility Compliance Auditor encountered a problem/);
  assert.match(markup, />Reload workspace</);
  assert.match(markup, />Back to Tool Library</);
});

test("boundary enters failure state and reports diagnostic details", () => {
  const reports = [];
  const boundary = new ToolWorkspaceErrorBoundary({
    children: "workspace",
    onError: (...details) => reports.push(details),
  });
  const error = new Error("render failed");
  const info = { componentStack: "Tool" };

  assert.deepEqual(ToolWorkspaceErrorBoundary.getDerivedStateFromError(error), {
    failed: true,
  });
  boundary.componentDidCatch(error, info);
  assert.deepEqual(reports, [[error, info]]);
});

test("App keeps Suspense inside the workspace boundary and preserves its loader", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const boundaryStart = source.indexOf("<ToolWorkspaceErrorBoundary");
  const suspenseStart = source.indexOf("<Suspense", boundaryStart);
  const suspenseEnd = source.indexOf("</Suspense>", suspenseStart);
  const boundaryEnd = source.indexOf("</ToolWorkspaceErrorBoundary>", suspenseEnd);

  assert.ok(boundaryStart >= 0);
  assert.ok(boundaryStart < suspenseStart);
  assert.ok(suspenseStart < suspenseEnd);
  assert.ok(suspenseEnd < boundaryEnd);
  assert.match(source.slice(suspenseStart, suspenseEnd), /Loading tool workspace…/);
  assert.match(source.slice(boundaryStart, boundaryEnd), /resetKey=\{tool\.workspaceId\}/);
  assert.match(source.slice(boundaryStart, boundaryEnd), /onBack=\{onBack\}/);
});
