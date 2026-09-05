# Changelog

All meaningful project changes are recorded here.

## Unreleased

- Integrate all six Wave 1 deterministic modules into the shared Tool Library and workspace shell.
- Consolidate the quote module into the existing Smart Intake product instead of creating a duplicate product tile.
- Label runnable modules without tenant persistence as Beta/session-only and reserve Working for complete workflows.
- Add responsive back navigation, truthful runnable-tool sidebar entries, and registry-to-component integration tests.
- Add a validated immutable manifest contract for every Wave 1 workspace.
- Bound accessibility and SQL analysis workloads, cap findings, and harden CSV exports against formula injection.
- Invalidate generated results when their source inputs change, including in-flight SEO worker results.
- Use exact decimal-to-cent arithmetic for project budgets and contain lazy workspace failures with an accessible recovery boundary.
- Preserve authored diagnostic procedures and verification checklists through builder and runner modes.
- Add local Markdown, JSON, CSV, and print/PDF export paths where each tool supports them.
- Prevent production deployments from falling back to unauthenticated local test mode.
- Inject the public Supabase browser configuration from the Sites runtime environment.
- Add a clearly labeled sidebar sign-out control and respond to Supabase `SIGNED_OUT` events.
- Add an explicit public, isolated `toolstead-preview=1` sandbox for the six client-only Wave 1 tools while keeping CRM, accounts, tenant data, persistence, and APIs behind authentication.

### Added

- Secure Supabase password recovery from the Toolstead sign-in screen.
- Recovery-link handling, 12-character password confirmation, and global session revocation after a successful reset.

### Verified

- The requested owner email is not currently registered in the connected Toolstead Supabase project.
- Wave 1 production build, Sites packaging, preview-boundary security review, and 149 automated tests pass.
- Rendered desktop QA passes for the isolated six-tool preview; tablet/mobile visual QA remains outstanding.

## 0.4.0 — Supabase connection and tool truth audit

### Added

- Supabase Auth client, owner-workspace provisioning, publishable-key configuration, and authenticated RPC facade.
- Membership-based Row Level Security policies for customer data.
- Persisted CRM lifecycle stages and stage filtering.
- Implementation audit details and readiness checks for all eight registered tools.
- Automated tests preventing unfinished modules from being labeled available.

### Fixed

- Removed four fabricated preview customer records.
- Replaced dead global search, notification, workspace, and account controls with working or explicitly unavailable states.
- Corrected false “Available” claims for seven unfinished tools.
- Added error handling for CRM notes and archive operations.
- Prevented a configured Supabase outage or expired session from silently entering local test mode.
- Added RPC input limits and hardened the shared update trigger search path.
- Closed entitlement leakage by requiring Messaging and Booking access on their foundation endpoints.
- Corrected SMS destination lookup, made message idempotency retries timeline-safe, rejected duplicate consent channels, and added appointment timeline events with solo-owner overlap prevention.
- Converted known PostgreSQL uniqueness, overlap, foreign-key, and validation failures into safe 4xx API responses instead of generic server errors.
- Hardened Supabase owner provisioning so verified email changes update the existing auth-linked user instead of colliding with the unique mapping.
- Reduced browser-role table grants to the exact operations required by the authenticated CRM functions.
- Added the missing authenticated `USAGE` permission for the private authorization-helper schema, discovered by the live RLS test.
- Reconciled the reused project's restrictive Data API event-trigger policy for the exact Toolstead tables while preserving the deny policy on all legacy tables.
- Remediated Supabase advisor findings with an explicit server-only session policy, removal of redundant Supabase workspace policies, and covering indexes for every reported foreign key.
- Added Supabase owner self-registration and email-confirmation handling so credentials never need to be manually inserted or shared in chat.

### Verification

- Production build and Sites packaging passed.
- 21 automated tests passed, including authentication checks across every implemented or foundation API route.
- Runtime dependency audit reported zero vulnerabilities.
- Live Supabase Auth provisioning, CRM RPCs, and cross-workspace RLS isolation passed using rollback-only test identities.
- Supabase Security Advisor reported zero findings after remediation; only expected unused-index information remains on the empty database.
- Current responsive browser QA remains gated on deploying this connected build.

### Verified maturity

- Lead Intake & CRM: implemented.
- Booking & Calendar and Messaging Hub: foundation only.
- Sites/Funnels/Forms, MarginPilot, Payments, Media Kit, and Analytics: not built.

## 0.3.0 — Multi-tool platform shell

### Added

- Entitlement-aware My Tools home and active-tool sidebar.
- Searchable, category-filtered Tool Library with eight registered modules.
- Lead Intake & CRM directory with create, edit, search, filter, note, timeline, and archive flows.
- PostgreSQL-backed contact API routes for listing, creating, updating, note creation, and soft archiving.
- Responsive mobile navigation and CRM layouts.
- Clearly labeled browser-session preview mode when the production API is unavailable.

### Changed

- Replaced the single-screen Priority Flow demo with the modular Toolstead platform shell.
- Preserved billing enforcement as disabled and prevented preview activation from creating purchases.

## 0.2.0 — Production foundation

### Added

- Custom Node.js API foundation using Fastify.
- PostgreSQL schema and migration runner.
- Owner authentication, refresh sessions, workspace membership, and role seams.
- CRM contacts, consent records, work queue, timeline, outbox, and audit tables.
- Module catalog, subscription bundle schema, and workspace entitlements.
- Billing-enforcement feature flag, intentionally disabled.
- OpenAPI contract, environment template, PostgreSQL container definition, and owner bootstrap script.
- API-aware frontend data loading with clearly marked demo fallback.
- Backend-focused automated tests and verification commands.

### Preserved

- Verified Priority Flow Workbench layout and responsive behavior.
- Sites packaging runtime and static worker.

## 0.1.0 — Interactive prototype

- Implemented the selected Priority Flow Workbench design.
- Added queue, search, contact timeline, response, consent, scheduling, and menu interactions.
- Added responsive desktop, tablet, and mobile layouts.
