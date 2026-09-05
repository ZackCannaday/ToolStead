# Wave 1 Security Release Review

Date: 2026-09-05  
Branch: `feature/skill-tools-wave-1`  
Review target: current working tree based on local checkpoint `b48e879`  
Decision: **PASS for authenticated, session-only beta release**

## Release boundary

This decision covers the six Wave 1 workspaces as presently shipped: deterministic tools that process user-supplied data in the browser and retain it only in the active session.

- Accessibility Compliance Auditor
- Diagnostic Flow Builder
- Project & Materials Planner
- Quote, Estimate & Invoice Builder
- Search Visibility Studio
- Code Quality & Release Desk / Test Case Generator

The review included the production authentication gate, workspace context lookup, tool catalog/entitlement presentation, local exports, input bounds, injection risks, arithmetic integrity, algorithmic-complexity/denial-of-service behavior, client-side secrets, and the existing API tenant guards. It did not perform DAST against a deployed environment, inspect the live Supabase project's policies, or validate infrastructure outside this repository.

## Severity summary

| State | Critical | High | Medium | Low |
|---|---:|---:|---:|---:|
| Open release-blocking findings | 0 | 0 | 0 | 0 |
| Resolved since the prior review | 0 | 0 | 2 | 2 |

No known exploitable Critical, High, or Medium vulnerability remains in the reviewed release boundary.

## Remediation verification

### W1-SEC-001 — Resolved — Planner arithmetic overflow

Fingerprint: `project-material-planner:finite-input-unbounded-arithmetic:v1`  
Previous severity: Medium  
Classification: CWE-190, CWE-682

The planner now defines explicit row, quantity, money, labor, cut, aggregate-quantity, and project-total limits in `src/tools/project-material-planner/planner.js:34-44`. Material, labor, cut-list, collection, and budget validation reject out-of-contract values and non-finite derived calculations (`planner.js:147-169`, `172-215`, `242-257`, `276-294`). Aggregate totals pass through a finite and maximum check before a result can return `ok: true` (`planner.js:356-381`).

Regression evidence: tests reject non-finite fields, multiplication overflow, row floods, invalid budgets, and aggregate project overflow. The focused/full security regression command completed without failures.

### W1-SEC-002 — Resolved — CSV formula injection after leading controls

Fingerprint: `test-case-generator:csv-leading-control-formula:v1`  
Previous severity: Medium  
Classification: CWE-1236

The CSV boundary now detects formula markers after any leading ASCII control/whitespace sequence and inserts an inert apostrophe before RFC 4180 quoting (`src/tools/test-case-generator/engine.js:774-781`). Regression cases cover spaces, tabs, carriage returns, newlines, multiple leading controls, all four formula markers, benign whitespace, and mid-cell markers.

### W1-SEC-003 — Resolved — Accessibility selector complexity

Fingerprint: `accessibility-auditor:selector-sibling-quadratic:v1`  
Previous severity: Low  
Classification: CWE-407

Selector ordinals and sibling totals are now built once in a linear indexing pass and reused while formatting findings (`src/tools/accessibility-auditor/analyzer.js:547-582`). The parser enforces 500,000 input characters and 20,000 elements; report generation caps findings at 2,000 and explicitly reports truncation (`analyzer.js:2-4`, `443-449`, `740-745`, `1295-1307`).

Adversarial verification: 15,000 empty sibling buttons completed in 0.614 seconds including Node startup, returned exactly the 2,000-finding cap, and set `findingsTruncated`.

### W1-SEC-004 — Resolved — Malformed SQL parser complexity

Fingerprint: `test-case-generator:sql-create-table-quadratic:v1`  
Previous severity: Low  
Classification: CWE-1333, CWE-407

SQL table discovery is a bounded forward scanner, advances its cursor on every branch, rejects unclosed table definitions, and caps extracted tables/columns (`src/tools/test-case-generator/engine.js:400-446`, `449-484`). The engine enforces its 400,000-character source limit, rather than depending only on the textarea (`engine.js:507-515`).

Adversarial verification: a 400,000-character sequence of malformed `CREATE TABLE x (` prefixes was rejected in 0.295 seconds including Node startup.

## Security controls verified

### Authentication, tenant boundaries, and entitlements

- Production cannot silently downgrade to local mode. Missing Supabase configuration produces `AUTH_CONFIGURATION_MISSING`; absent or unverifiable sessions return the login state (`src/data-client.js:63-100`). The application does not render a tool workspace until connection resolution has passed (`src/App.jsx:1336-1369`, `1562-1564`).
- Supabase context loading requires an authenticated account linked to a workspace (`src/data-client.js:38-59`). Existing regression tests cover verified sessions, explicit connection failure, password recovery, and sign-out.
- Server-side API routes authenticate before database access. Workspace IDs come from verified claims, SQL uses parameters, workspace transactions set tenant context, and module-protected APIs use `requireModule` against the same workspace (`server/plugins/security.js:4-47`). Migration regression tests cover row-level security and authenticated RPC boundaries.
- All six Wave 1 tools are intentionally exposed as **beta, session-only previews** even when their paid module entitlement is not enabled. They do not read or mutate tenant records. This is acceptable for the current test release, but it is not a commercial entitlement boundary.

### Injection and export safety

- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `Function` constructor, command execution, user-controlled dynamic import, or untrusted navigation sink exists in the reviewed tool modules.
- Pasted HTML is parsed as inert text; displayed inputs/evidence are rendered through React escaping.
- Quote/customer content is rendered through React and the local print dialog; it is not assembled into executable HTML.
- CSV text is formula-neutralized and quote-escaped. JSON and Markdown exports are local data files with fixed filenames and MIME types.
- SEO canonical URLs accept only HTTP/HTTPS syntax and are used as analysis data, not clickable/navigation targets.

### Bounds, privacy, and claims

- Accessibility input, element, and finding limits are enforced in the engine.
- SEO applies per-field and aggregate limits before analysis and runs accepted work in a Web Worker (`src/tools/seo-aeo-analyzer/analyzer.js:109-131`; `SeoAeoAnalyzer.jsx:51-80`).
- Diagnostic workflows cap nodes, answers, list sizes, identifiers, and text; validation rejects cycles and tampered session paths.
- Project planning caps each collection and all meaningful numeric/derived totals. Quote calculations use bounded integer cents and BigInt intermediates.
- Test generation caps source size, requirements, requirement length, SQL tables, and SQL columns; the UI-generated export is therefore bounded.
- The reviewed tools make no network calls and use no browser persistence. Source material, client details, plans, and audit inputs remain in memory for the current tab.
- Accessibility results explicitly avoid claiming WCAG conformance. SEO results explicitly avoid claiming live ranking, indexing, citation, or schema verification. Regulated project/diagnostic work retains professional-review and safety boundaries.

### Secrets and dependencies

- Repository scan found no embedded API key, Supabase secret/service-role key, private key, or hardcoded password. The only `service_role`/`sb_secret_` match was a negative assertion in `tests/api-foundation.test.mjs`.
- `npm audit --omit=dev --json`: 0 production dependency vulnerabilities across 160 production dependencies (0 Critical/High/Moderate/Low).

## Commands and results

| Command/check | Result |
|---|---|
| `node --test` across all 11 test files | **PASS — 133/133 tests**, 0 failed/skipped/todo |
| 15,000-sibling accessibility adversarial check | **PASS — 0.614 s**, bounded/truncated result |
| 400,000-character malformed SQL adversarial check | **PASS — 0.295 s**, safely rejected |
| `npm audit --omit=dev --json` | **PASS — 0 vulnerabilities** |
| credential-pattern scan | **PASS — no credential found** |
| `git diff --check` | **PASS — no whitespace errors** |

## Residual conditions and release decision

**PASS for an authenticated, session-only beta release.** The four prior findings are verified resolved, the security regression suite is green, and no new release-blocking vulnerability was identified.

Before any Wave 1 tool is marketed as entitlement-restricted, persists tenant data, accepts automated/imported workloads, or executes server-side, require a new security gate that adds and verifies: server-enforced module authorization, tenant-scoped storage/RLS, API request/body/rate limits, explicit export collection limits at every newly exposed public boundary, audit logging for state changes, and deployed-environment DAST. This report is code-visible evidence, not a compliance certification.
