# Wave 1 Code & Reality Release Review

Review date: 2026-09-05  
Scope: the six Wave 1 tool engines and workspaces, shared dashboard integration, manifests, focused/integration tests, and production build.  
Reviewed state: local working tree based on `b48e879e9459c767bc8a00211974fc9cbecd494f`, including the uncommitted Wave 1 repair set present during review.  
Code decision: **PASS for authenticated, session-only beta scope**  
Release decision: **FAIL / NO-GO pending the browser workflow gate**

## Verification evidence

- `npm run verify`: production Vite/Sites build passed; **143 tests passed, 0 failed**.
- `npm run test:sites`: **5 passed, 0 failed**.
- `git diff --check`: passed.
- No `docs/wave1-browser-qa.md` report existed when this review closed, so rendered customer workflows, responsive behavior, and browser export/print actions do not yet have release evidence.

## Resolved findings

### Generated-result freshness — resolved

- Accessibility input mutation clears the prior report and severity filter in `src/tools/accessibility-auditor/AccessibilityAuditor.jsx:162-167`.
- Search Visibility input mutation increments the request generation, clears the pending request, resets the result, and leaves analyzing mode in `src/tools/seo-aeo-analyzer/SeoAeoAnalyzer.jsx:39-49`. Late worker responses are rejected by request ID at lines 51-55.
- Test Generator input mutation clears test cases, validation, expansion, and therefore its derived CSV in `src/tools/test-case-generator/TestCaseGenerator.jsx:108-116`.
- `tests/generated-result-freshness.test.mjs` covers all three contracts.

### Project Planner monetary precision — resolved

`src/tools/project-material-planner/planner.js:67-116` converts exact decimal strings to rational `BigInt` values and applies explicit half-up cent rounding. Line totals round before `safeTotal` sums exact cents; budget comparison also uses cents. Regressions cover `10.075 → 10.08`, `1.005 → 1.01`, negative half-up behavior, fractional labor, multi-line totals, and budget difference.

### Workspace failure containment — resolved

`src/components/tool-workspace-error-boundary.js` contains lazy import and component render failures with an accessible alert, focused heading, reload action, and return-to-library action. `src/App.jsx:204-218` keeps `Suspense` inside the boundary and resets it by workspace ID. Three focused tests verify the fallback contract, error transition/reporting, and App composition.

### Prior Wave 1 blockers — resolved

The reviewed tree also retains the earlier fixes for the production build, accessibility custom-control crash and performance caps, diagnostic test/verification visibility and non-destructive editing, quote kind/deadline consistency, SEO input limits and worker execution, planner overflow and purchase rounding, and CSV spreadsheet-formula neutralization.

## Product-truth and maintainability assessment

- **Manifest and routes: PASS.** All six modules use one validated immutable manifest schema. Catalog keys and workspace routes derive from those manifests; contract tests cover exact catalog attachment and compatibility aliases.
- **Executable behavior: PASS at engine/component-contract level.** Each tool has deterministic input validation, meaningful output, documented limits, and a customer-facing workspace wired through the dashboard.
- **Persistence claims: PASS.** The shared frame says `Beta · session only` and explicitly states that workspace saving and connected services are unavailable.
- **AI claims: PASS.** These tools identify themselves as deterministic local utilities; none implies unimplemented AI, live crawling, research, ranking verification, or generated factual authority.
- **Loading/empty/error/success states: PASS at code level.** The six workspaces expose appropriate initial, validation, result, and export/print status states; Search has an analyzing state; the shared workspace has lazy loading and failure recovery.
- **Test maintainability: PARTIAL.** Engine and contract coverage is strong, but some UI assertions still inspect source strings rather than rendering components. The dedicated browser gate is therefore mandatory before release.

## Per-tool verdict

| Wave 1 tool | Code verdict | Verified behavior |
| --- | --- | --- |
| Search Visibility Studio | **PASS — beta** | Bounded five-pillar worker audit, field errors, stale-request invalidation, evidence-based results, and local Markdown copy/download. |
| Accessibility Compliance Auditor | **PASS — beta** | Bounded static HTML audit, prioritized evidence, manual-review disclosure, filtering, and input/result freshness. |
| Quote, Estimate & Invoice Builder | **PASS — beta** | Integer-cent totals, validation, quote/proposal/invoice/change-order contracts, stable prepared data, and browser print handoff. |
| Diagnostic Flow Builder | **PASS — beta** | Authoring, validation, test instructions, safe traversal/history, non-destructive edit/cancel, outcomes, and verification checklist. |
| Project & Materials Planner | **PASS — beta** | Defined scope, BOM/package rounding, cut/kerf planning, safety boundaries, build sequence, exact-cent costing, budget comparison, and JSON export. |
| Code Quality & Release Desk (Test Case Generator) | **PASS — beta** | Bounded requirements/contracts/schema parsing, traceable positive/negative/boundary cases, filtering, stale-result invalidation, and hardened CSV export. |

## Remaining release gate

The code review is complete, but release remains **NO-GO** until `docs/wave1-browser-qa.md` records successful rendered checks for all six tools:

1. Open each tool from the dashboard on desktop and mobile viewports.
2. Verify initial, validation-error, successful-result, input-mutation, and back-navigation states.
3. Exercise Markdown, CSV, JSON, and browser print actions where offered.
4. Confirm keyboard focus, responsive layout, no uncaught browser errors, and no misleading state.

If that browser report passes without new defects, this code/reality gate advances to **PASS / GO for authenticated, session-only beta** without another code change.
