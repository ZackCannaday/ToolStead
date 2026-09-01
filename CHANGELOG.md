# Changelog

All meaningful project changes are recorded here.

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
