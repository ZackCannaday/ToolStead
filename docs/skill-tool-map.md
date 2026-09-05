# ToolStead Skill-to-Product Map

Status date: 2026-09-04  
Catalog baseline: 36 source skills consolidated into exactly 15 customer-facing products.

## Mapping rules

- Every source skill has one—and only one—primary product assignment.
- Products are organized around a customer outcome, not a single prompt or implementation technique.
- Narrow capabilities are merged when customers would reasonably expect them in the same workflow.
- “Readiness” describes the product definition, while “Wave 1 status” reports repository evidence observed on the status date. An isolated module is not considered released until dashboard integration, persistence, authorization, and release gates pass.

## Product portfolio

### 1. Search Visibility Studio

- **Primary source skills:** `seo-aeo-content-analyzer`, `aeo-content-formatter`, `geo-citation-strategist`, `jsonld-schema-builder`, `programmatic-seo-designer`, `core-web-vitals-optimizer`
- **Outcome:** Audit and improve a site’s organic-search, answer-engine, generative-engine, structured-data, scalable-page, crawl, and performance readiness from one workspace.
- **User:** Small-business owner, marketer, SEO consultant, content lead, or web developer.
- **Inputs:** Page URL or pasted copy; target keyword and audience; brand/entity facts; sitemap or route inventory; optional performance metrics and page-template dataset.
- **Workflow:** Ingest content and technical evidence → score search intent, structure, authority, extractability, and vitals → generate prioritized repairs → produce direct-answer copy and schema → design eligible scalable pages → re-check technical and content gates.
- **Outputs:** 100-point audit, prioritized issue list, rewritten title/meta/H1/direct-answer blocks, citation plan, validated JSON-LD, programmatic page specification, internal-link and sitemap rules, Core Web Vitals remediation checklist.
- **Dependencies:** URL/content fetcher, HTML parser, readability and keyword metrics, schema validator, performance-data adapter, export service, optional OpenAI generation behind a server-side key.
- **Security/privacy risks:** Untrusted HTML and URL-based server-side request forgery (SSRF), copyrighted/private content retention, prompt injection in fetched pages, false claims or fabricated citations, schema publishing facts not visible on-page.
- **Readiness:** High for deterministic pasted-content analysis; medium for live crawling, field performance data, citation verification, and automated publishing.
- **Merge rationale:** Content scoring, AEO formatting, GEO citations, schema, scalable templates, and web vitals are stages of one visibility job. Selling them separately would fragment one diagnosis-to-remediation workflow.
- **Phased order:** Phase 1.
- **Wave 1 status:** Isolated analyzer UI, analysis engine, styles, and focused tests are present. Consolidated schema/GEO/programmatic/performance capabilities, tenant persistence, dashboard registration, and release review remain pending.

### 2. Interface Design Studio

- **Primary source skills:** `design-token-generator`, `ui-component-scaffolder`, `animation-choreographer`, `css-layout-troubleshooter`, `storybook-doc-drafter`
- **Outcome:** Turn a design direction into an accessible, responsive, documented component system with intentional motion and layout diagnostics.
- **User:** Product designer, frontend developer, agency, or founder shipping a web interface.
- **Inputs:** Brand colors, visual references or wireframes, framework preferences, component requirements, existing markup/CSS, breakpoints, and interaction states.
- **Workflow:** Establish semantic tokens → define component hierarchy and props → scaffold responsive components → diagnose layout defects → add reduced-motion-safe interactions → generate state stories and interaction documentation.
- **Outputs:** CSS variables/Tailwind theme, typed React components, responsive layout fixes, animation variants, Storybook CSF3 stories, accessibility-aware state and usage documentation.
- **Dependencies:** React/TypeScript parser, CSS and contrast utilities, component preview sandbox, Storybook-compatible exporter, optional browser screenshots.
- **Security/privacy risks:** Executing untrusted preview code, dependency supply-chain risk, accidental inclusion of secrets in pasted source, unsafe generated markup, and denial-of-service from excessive preview assets.
- **Readiness:** Medium; generation rules are defined, but safe compilation, preview isolation, and framework-version adapters are required.
- **Merge rationale:** Tokens, components, motion, layout repair, and Storybook documentation share the same component lifecycle and should produce one coherent system instead of disconnected code snippets.
- **Phased order:** Phase 2.
- **Wave 1 status:** Not started as a dedicated customer tool. Shared dashboard styling exists, but that is platform UI rather than this product’s generation and preview workflow.

### 3. Accessibility Compliance Auditor

- **Primary source skills:** `accessibility-wcag-auditor`
- **Outcome:** Identify and explain accessibility failures across semantics, keyboard behavior, focus management, forms, ARIA, and color contrast, with actionable fixes.
- **User:** Website owner, designer, developer, quality-assurance reviewer, or compliance lead.
- **Inputs:** Public URL, HTML/component source, optional screenshot, target Web Content Accessibility Guidelines (WCAG) level, and supported browser/assistive-technology matrix.
- **Workflow:** Parse page/component → run deterministic rules → inspect landmarks, headings, labels, ARIA, keyboard/focus, and contrast → classify severity → suggest repairs → re-test supplied revisions.
- **Outputs:** Issue inventory by WCAG criterion and severity, affected element locations, keyboard test plan, contrast results, remediation snippets, and pass/fail summary.
- **Dependencies:** DOM parser, accessibility rule engine, color-contrast calculator, browser automation for interaction checks, safe source viewer, report export.
- **Security/privacy risks:** Fetching private/intranet URLs, storing customer page source, misleading “compliance” guarantees from automation alone, and active-page scripts in previews.
- **Readiness:** High for static checks; medium for keyboard, focus, and screen-reader verification that requires browser-assisted/manual review.
- **Merge rationale:** Accessibility is a distinct buyer outcome and compliance workflow. It remains standalone while consuming shared design and reporting infrastructure.
- **Phased order:** Phase 1.
- **Wave 1 status:** Isolated UI, deterministic analyzer, styles, and focused tests are present. Live URL scanning, browser interaction checks, persistence, dashboard registration, and human-review disclaimers remain pending.

### 4. Application Security Center

- **Primary source skills:** `stride-threat-modeler`, `owasp-api-hardener`, `csp-header-architect`, `secret-exposure-auditor`
- **Outcome:** Model architectural threats, audit APIs and server actions, design deployable browser-security headers, and detect credential exposure in one defensive review.
- **User:** Software owner, security engineer, technical lead, or developer preparing a release.
- **Inputs:** Architecture/data-flow description, repository or selected files, endpoint inventory, deployment platform, external origins, authentication model, and data sensitivity.
- **Workflow:** Map assets and trust boundaries → enumerate STRIDE threats → inspect endpoint authorization/validation → scan for exposed secrets → generate CSP and complementary headers → rank remediation and verify defensive configuration.
- **Outputs:** Threat register, risk scores, API findings, tenant-authorization checklist, secret findings with rotation guidance, CSP/report-only and enforced policies, security-header configuration, prioritized remediation plan.
- **Dependencies:** Repository scanner, secret-pattern and entropy detector, static code analysis, URL/origin inventory, CVSS/DREAD calculator, framework-specific header templates, secure job isolation.
- **Security/privacy risks:** Processing proprietary code and architecture, exposing detected secrets in reports/logs, unsafe active scanning, SSRF in outbound URL checks, and overconfidence from automated coverage.
- **Readiness:** Medium; defensive static analysis is feasible, but secret redaction, repository isolation, explicit target authorization, and report-only CSP rollout are mandatory.
- **Merge rationale:** Threat modeling identifies risks; API, header, and secret audits close the most common resulting control gaps. Together they form a coherent pre-release security review.
- **Phased order:** Phase 1 shared infrastructure, customer workspace in Phase 3.
- **Wave 1 status:** Platform security headers and focused header tests exist. The customer-facing threat/API/secret audit workspace and isolated scanning service are not started.

### 5. Database Reliability Studio

- **Primary source skills:** `postgres-rls-builder`, `sql-performance-tuner`
- **Outcome:** Produce secure tenant-isolation policies and evidence-based PostgreSQL query/index improvements from one database review.
- **User:** Supabase/PostgreSQL developer, SaaS founder, database administrator, or backend engineer.
- **Inputs:** Database schema, access matrix, representative queries, sanitized execution plans, table/index statistics, and workload characteristics.
- **Workflow:** Model roles and permitted operations → generate and inspect Row Level Security (RLS) policies → test negative tenant boundaries → analyze plans and estimates → propose limited indexes/query rewrites → compare expected or measured effects.
- **Outputs:** Access matrix, RLS SQL, security-definer helpers with safe search paths, negative authorization tests, query findings, index Data Definition Language (DDL), and before/after plan report.
- **Dependencies:** SQL parser, PostgreSQL plan parser, Supabase-compatible templates, isolated database test environment, migration exporter.
- **Security/privacy risks:** Production data or credentials in plans, destructive/locking DDL, policies that leak tenant rows, elevated security-definer functions, and recommendations based on unrepresentative statistics.
- **Readiness:** Medium; offline generation is straightforward, while connected execution requires read-only defaults, explicit approvals, backups, and rollback plans.
- **Merge rationale:** RLS predicates and indexes directly affect both tenant safety and query performance; reviewing them together prevents secure-but-slow or fast-but-leaky designs.
- **Phased order:** Phase 3.
- **Wave 1 status:** Not started as a customer tool; platform Supabase/auth work does not constitute this product.

### 6. API & Webhook Workshop

- **Primary source skills:** `openapi-contract-drafter`, `webhook-payload-handler`, `regex-parser-architect`
- **Outcome:** Design strict REST contracts and resilient event receivers, including safe validation and parsing utilities for payload boundaries.
- **User:** Backend developer, integration engineer, SaaS founder, or agency connecting external services.
- **Inputs:** Endpoint requirements, data models, authentication scheme, sample webhook payloads and headers, provider signature rules, parsing examples, positive and negative test cases.
- **Workflow:** Define reusable schemas/security → draft operations and error contracts → model signature and replay checks → define idempotent ingestion/retries → create bounded parsers where schema parsing is insufficient → validate examples and edge cases.
- **Outputs:** OpenAPI 3.1 YAML/JSON, JSON Schemas, webhook handler blueprint/code, event table and retry policy, safe regex/tokenizer with tests and explanation, integration checklist.
- **Dependencies:** OpenAPI and JSON Schema validators, language/framework templates, regex timeout/performance harness, cryptographic primitives, optional queue/database adapters.
- **Security/privacy risks:** Real webhook secrets or customer payload data, replay and signature mistakes, catastrophic regex backtracking, insecure example authentication, and generated contracts drifting from implementations.
- **Readiness:** Medium; contract and parser generation are deterministic, while runnable webhook deployment needs provider-specific verified adapters and secret management.
- **Merge rationale:** Contracts define inbound boundaries, webhooks implement asynchronous boundaries, and parsers handle the few fields that need textual extraction. They belong in one integration-building workflow.
- **Phased order:** Phase 3.
- **Wave 1 status:** Not started.

### 7. Code Quality & Release Desk

- **Primary source skills:** `fullstack-code-reviewer`, `test-case-generator`, `git-release-notes-builder`
- **Outcome:** Review a change, produce contract-focused regression tests, and turn verified differences into accurate merge and release documentation.
- **User:** Developer, maintainer, engineering lead, or agency team.
- **Inputs:** Code files or diff, repository context, API/schema contracts, test framework, bug report or acceptance criteria, and commit range.
- **Workflow:** Understand intent → review correctness/types/performance/security → generate prioritized findings → derive happy, boundary, negative, and concurrency tests → run or export tests → summarize only verified changes into commit/PR/changelog formats.
- **Outputs:** Severity-ranked code review, patch guidance, executable test suite and fixtures, coverage matrix, conventional commit, pull-request summary, changelog and customer-facing release notes.
- **Dependencies:** Language parsers, repository/diff reader, sandboxed test runner, framework templates, artifact exporter, optional source-control read integration.
- **Security/privacy risks:** Proprietary code retention, malicious test execution, secrets in diffs, dependency installation risk, and release notes that claim unverified functionality.
- **Readiness:** High for review/reporting and test drafting; medium for sandboxed execution across arbitrary stacks.
- **Merge rationale:** Review findings should drive tests, and passing evidence should drive release notes. Combining the sequence prevents disconnected tests and inaccurate change summaries.
- **Phased order:** Phase 1 internal quality gate, customer workspace in Phase 2.
- **Wave 1 status:** Isolated test-generator UI, engine, manifest, styles, and focused tests are present. Full code review, safe multi-language execution, diff ingestion, release-note generation, persistence, and dashboard integration remain pending.

### 8. Product Architecture Planner

- **Primary source skills:** `technical-spec-drafter`, `state-machine-modeler`
- **Outcome:** Convert product requirements into an implementable technical specification with explicit lifecycle states, transitions, guards, failure paths, and phased delivery.
- **User:** Founder, product manager, software architect, or engineering team planning a feature.
- **Inputs:** Problem statement, users, requirements, constraints, existing stack, entities, integrations, workflows, non-goals, and success metrics.
- **Workflow:** Normalize requirements → define goals/non-goals → model architecture, data, APIs, security, and errors → identify stateful processes → generate deterministic statecharts/types → sequence milestones and acceptance gates.
- **Outputs:** Product/technical specification, architecture description, relational schema, endpoint contracts, state/event/guard table, typed reducer or XState scaffold, risk register, implementation roadmap.
- **Dependencies:** Diagram/export renderer, schema and OpenAPI templates, TypeScript generator, versioned document storage, optional OpenAI generation.
- **Security/privacy risks:** Sensitive roadmap or architecture retention, hallucinated technical constraints, insecure default architecture, and generated state logic missing domain-specific legal/safety requirements.
- **Readiness:** High for guided document generation; medium for generated runnable state code pending compilation and user validation.
- **Merge rationale:** Lifecycle ambiguity is a major cause of incomplete technical specifications. State modeling is therefore embedded in architecture planning rather than sold as a narrow developer utility.
- **Phased order:** Phase 2.
- **Wave 1 status:** Not started.

### 9. Customer Messaging Hub

- **Primary source skills:** `customer-communication-assistant`
- **Outcome:** Draft contextual customer inquiries, confirmations, updates, follow-ups, complaint resolutions, and review responses from a consistent business voice.
- **User:** Owner-operator, customer support representative, field-service dispatcher, or account manager.
- **Inputs:** Customer message, communication type, verified job/account facts, desired channel, business voice, timeline, approved policies, and call to action.
- **Workflow:** Classify scenario and urgency → retrieve only authorized context → draft direct response → check tone, promises, policy alignment, and personally identifiable information (PII) → require human approval before sending.
- **Outputs:** Email/SMS/review-response drafts, subject lines, concise action steps, follow-up variants, and conversation notes.
- **Dependencies:** Server-side generation, business-profile and template store, optional customer relationship management (CRM), email/SMS adapters, approval queue, audit log.
- **Security/privacy risks:** PII leakage, unauthorized automated sending, fabricated promises, prompt injection from inbound messages, harassment or discriminatory responses, and cross-tenant context leakage.
- **Readiness:** Medium; drafting can ship earlier, but any send action requires verified identity, tenant isolation, consent handling, templates, and human approval.
- **Merge rationale:** The source covers one complete communications outcome and should remain focused; channel delivery is an integration, not a separate product.
- **Phased order:** Phase 3.
- **Wave 1 status:** Not started.

### 10. Quote, Estimate & Invoice Builder

- **Primary source skills:** `client-quote-invoice-generator`, `repair-estimate-formatter`
- **Outcome:** Build professional proposals, trade/repair estimates, work orders, change orders, and invoices with transparent totals and customer-friendly scope explanations.
- **User:** Contractor, automotive/equipment technician, freelancer, service-business owner, or office manager.
- **Inputs:** Business/client details, vehicle/equipment/job information, findings, line items, labor rate and hours, parts, taxes/fees/discounts, urgency, payment terms, and quote expiration.
- **Workflow:** Select document/job type → capture parties and scope → itemize labor/parts/services → calculate validated totals → classify recommendations where applicable → generate plain-language explanation and terms → preview/export.
- **Outputs:** Itemized quote, repair estimate, proposal, work order, change order, or invoice; totals breakdown; customer summary; print/PDF-ready representation.
- **Dependencies:** Decimal-safe calculation engine, tax/fee configuration, document numbering, customer/job persistence, PDF renderer, authorization and audit trail, optional payment integration.
- **Security/privacy risks:** Customer PII, financial record exposure, tax/rounding errors, unauthorized invoice edits, unsupported repair claims, unsafe recommendations, and document-number collisions.
- **Readiness:** High for local deterministic document construction; medium for durable records, taxes by jurisdiction, payments, and legally reviewed terms.
- **Merge rationale:** General quoting/invoicing and repair estimating share customers, line-item arithmetic, terms, approval, and export infrastructure; repair-specific vehicle, findings, and urgency fields become an industry mode.
- **Phased order:** Phase 1.
- **Wave 1 status:** Isolated quote/invoice UI, calculation logic, styles, and focused tests are present. Repair-industry mode, PDF export, durable tenant records, dashboard registration, authorization, and final quality gates remain pending.

### 11. Field Operations Manager

- **Primary source skills:** `route-logistics-coordinator`, `equipment-maintenance-tracker`
- **Outcome:** Plan daily field-service routes and ensure assigned vehicles, tools, and equipment are available, maintained, calibrated, and correctly staged for each stop.
- **User:** Mobile service owner, dispatcher, fleet/equipment manager, field technician, or operations supervisor.
- **Inputs:** Jobs and appointment windows, locations, travel constraints, estimated durations, assigned equipment, service intervals/readings, site access notes, required tools/parts, and technician availability.
- **Workflow:** Validate jobs and resource readiness → identify overdue/failed equipment → sequence eligible stops → add travel/setup/cleanup/contingency buffers → create per-stop packing and site checklists → log completion/readings/corrective actions.
- **Outputs:** Daily route manifest, conflict/late-risk warnings, tool and material packing lists, site notes, maintenance schedule, inspection checklist, service history, and out-of-service alerts.
- **Dependencies:** Mapping/travel-time provider, scheduling engine, equipment database, notification service, offline-capable mobile UI, role-based access, audit log.
- **Security/privacy risks:** Exposure of customer addresses/gate codes, employee location tracking, unsafe routing, use of overdue equipment, inaccurate maintenance specifications, and third-party map data sharing.
- **Readiness:** Medium-low; useful deterministic manifests can ship first, but real optimization, live traffic, offline sync, location privacy, and maintenance records require backend integrations.
- **Merge rationale:** Route feasibility depends on equipment readiness and staging. Joining them produces an operational plan a field-service buyer can act on, instead of separate schedules that can contradict each other.
- **Phased order:** Phase 4.
- **Wave 1 status:** Not started.

### 12. Diagnostic Flow Builder

- **Primary source skills:** `diagnostic-decision-tree`
- **Outcome:** Convert a symptom into a safe, explicit, branching troubleshooting procedure with measurable pass/fail criteria and post-repair verification.
- **User:** Automotive/equipment technician, technical support lead, maintenance team, or skilled do-it-yourself user.
- **Inputs:** System/equipment identity, symptoms and codes, operating conditions, known specifications and sources, available tools, safety constraints, and previous test results.
- **Workflow:** Define boundary and prerequisites → order low-effort/high-probability checks → define each test action/specification → branch on measured results → attach safety stops → require final verification.
- **Outputs:** Interactive decision tree, technician checklist, required tools, measurement/spec table, safety warnings, isolated root-cause paths, and completion report.
- **Dependencies:** Graph/state engine, validated specification/source store, persistence, printable/mobile renderer, optional manual or data-source review.
- **Security/privacy risks:** Injury or equipment damage from incorrect procedures, invented specifications, unsupported replacement advice, reliance on incomplete symptoms, and exposure of customer/asset records.
- **Readiness:** Medium; deterministic tree creation exists, but sourced specifications, domain disclaimers, persistence, and safety review are required for production use.
- **Merge rationale:** Diagnostic branching is already a coherent standalone product with a distinct technician workflow; it should integrate with estimates later without being reduced to an estimate subfeature.
- **Phased order:** Phase 1.
- **Wave 1 status:** Isolated UI, decision-tree engine, styles, and focused tests are present. Verified specification sourcing, persistence, dashboard registration, printable output, and domain safety review remain pending.

### 13. Market & Sourcing Intelligence

- **Primary source skills:** `competitor-benchmarking`, `parts-supplier-sourcing`
- **Outcome:** Compare market offerings or supplier candidates using transparent evidence, normalize cost/quality/availability trade-offs, and recommend the option that best fits the buyer’s constraint.
- **User:** Small-business owner, product strategist, buyer, repair shop, contractor, or procurement lead.
- **Inputs:** Comparison goal, candidate businesses/products/suppliers, URLs or supplied evidence, pricing/features/specifications, compatibility, shipping/lead times, warranty/returns, budget, deadline, and weighting priorities.
- **Workflow:** Define direct/indirect candidates and criteria → collect timestamped evidence → normalize units and total landed cost → score features, quality, availability, and risk → identify market gaps or sourcing trade-offs → cite recommendation and confidence.
- **Outputs:** Evidence-linked comparison matrix, normalized price/feature table, supplier shortlist, companion-item/core-charge warnings, positioning gaps, weighted recommendation, and refresh date.
- **Dependencies:** Approved web/data connectors, citation capture, currency/unit normalization, configurable scoring, export service, optional scheduled refresh.
- **Security/privacy risks:** Stale or copyrighted pricing data, scraping terms violations, incorrect compatibility, affiliate bias, fabricated evidence, and exposing confidential negotiated rates.
- **Readiness:** Medium; supplied-data comparison can ship first, while live research requires permitted sources, freshness metadata, citations, and compatibility disclaimers.
- **Merge rationale:** Both skills gather comparable candidates, normalize commercial evidence, evaluate trade-offs, and recommend a purchase or positioning action. Domain-specific scorecards preserve depth within one intelligence product.
- **Phased order:** Phase 4.
- **Wave 1 status:** Not started.

### 14. Project & Materials Planner

- **Primary source skills:** `project-material-planner`
- **Outcome:** Turn project dimensions and constraints into a sequenced build plan, bill of materials (BOM), cut list, cost estimate, tools, safety controls, and contingency.
- **User:** Contractor, fabricator, woodworker, restorer, trade professional, or serious do-it-yourself builder.
- **Inputs:** Project type, dimensions, materials, construction method, finish, budget, available tools, location constraints, and waste/kerf assumptions.
- **Workflow:** Validate dimensions and use case → calculate quantities and cut layout → add hardware/consumables/contingency → sequence preparation, dry-fit, assembly, and finish → attach tools/PPE and risk checkpoints → summarize cost and assumptions.
- **Outputs:** BOM, cut list, tools and personal protective equipment (PPE) checklist, chronological build sequence, estimated cost, waste allowance, safety notes, and printable plan.
- **Dependencies:** Unit-safe arithmetic, material library, cut/quantity calculator, configurable price input, project persistence, export/print service.
- **Security/privacy risks:** Unsafe structural guidance, inaccurate quantities/costs, missing code/permit requirements, hazardous-material advice, and user reliance on unverified load calculations.
- **Readiness:** High for non-structural planning; regulated, structural, electrical, gas, or load-bearing projects require clear exclusions or qualified review.
- **Merge rationale:** The source is a complete project-planning workflow and should remain standalone, while sharing calculation and export primitives with estimating products.
- **Phased order:** Phase 1.
- **Wave 1 status:** Isolated UI, planning engine, styles, and focused tests are present. Full component inspection, persistence, dashboard registration, pricing inputs, export, and safety-scope gate remain pending.

### 15. Career Achievement Journal

- **Primary source skills:** `career-milestone-logger`
- **Outcome:** Capture work wins while details are fresh and turn them into truthful, quantified resume bullets and performance-review stories.
- **User:** Employee, tradesperson, technician, developer, contractor, job seeker, or manager documenting team impact.
- **Inputs:** Situation, task, actions, tools/skills, outcome, evidence or metric, date, employer/project, target role, and privacy preference.
- **Workflow:** Capture raw milestone → distinguish fact from missing metric → prompt for defensible measurement angles → generate Situation-Task-Action-Result (STAR) record and concise bullet variants → tag skills → save/search/export selected entries.
- **Outputs:** Timestamped accomplishment record, STAR narrative, resume-ready bullets, performance-review summary, skill/certification tags, and exportable achievement history.
- **Dependencies:** Encrypted user storage, tagging/search, document export, optional server-side generation, account deletion and retention controls.
- **Security/privacy risks:** Sensitive employer/project information, fabricated metrics, confidential customer details, employment discrimination exposure, and unwanted long-term retention.
- **Readiness:** Medium-high; drafting is straightforward, but privacy controls, evidence labels, encryption, deletion, and explicit “do not invent metrics” behavior are required.
- **Merge rationale:** The source serves a distinct personal recordkeeping outcome that does not fit customer messaging or project documentation without confusing buyer intent.
- **Phased order:** Phase 4.
- **Wave 1 status:** Not started.

## Phased delivery order

| Phase | Products | Release purpose |
| --- | --- | --- |
| 1 — Deterministic foundation | Search Visibility Studio; Accessibility Compliance Auditor; Quote, Estimate & Invoice Builder; Diagnostic Flow Builder; Project & Materials Planner; Code Quality & Release Desk (internal gate first) | Finish the six isolated modules already evidenced in the repository; integrate them through the shared workspace, data, authorization, and export contracts. |
| 2 — Creation workflows | Interface Design Studio; Product Architecture Planner; Code Quality & Release Desk (customer release) | Add generation/preview products after safe compilation and artifact handling are established. |
| 3 — Connected and sensitive workflows | Application Security Center; Database Reliability Studio; API & Webhook Workshop; Customer Messaging Hub | Add code/data/integration workflows only after isolation, redaction, audit logging, approvals, and tenant controls are proven. |
| 4 — Operational expansion | Field Operations Manager; Market & Sourcing Intelligence; Career Achievement Journal | Add mapping/research/personal-record integrations after connector governance, freshness, privacy, and retention controls are available. |

## Shared release gates

Every product must pass the same minimum gates before it can be labeled available:

1. Authenticated tenant-scoped storage and server-side authorization.
2. Strict input validation, payload/size limits, rate limits, and safe error responses.
3. No private provider key in the client bundle; secrets are redacted from logs and exports.
4. Deterministic calculations and generated claims have separate provenance labels.
5. Loading, empty, validation, failure, retry, and success states work on mobile and desktop.
6. Keyboard and screen-reader review, responsive/overflow review, and reduced-motion support.
7. Unit, integration, security, and browser smoke tests pass; build and type checks pass where applicable.
8. Exported artifacts are accurate, sanitized, and isolated by tenant.
9. Product-specific risk disclaimers and human-approval steps appear before high-impact actions.
10. Dashboard registration, entitlements, audit events, monitoring, rollback, and production verification are complete.

## Coverage verification contract

- Expected source definitions: **36**
- Primary mappings in this document: **36**
- Customer-facing products: **15**
- Duplicate primary assignments allowed: **0**
- Unmapped source definitions allowed: **0**
