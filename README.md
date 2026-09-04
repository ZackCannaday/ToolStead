# Toolstead Platform Foundation v0.4

A modular Node/PostgreSQL platform with an entitlement-aware tool shell, searchable Tool Library, and Lead Intake & CRM as the first production module.

## What is included

- Fastify API with versioned REST routes and an OpenAPI contract
- PostgreSQL migrations for workspaces, users, future employee memberships, roles, module entitlements, bundle tiers, CRM contacts, consent, timeline, work queue, appointments, outbox, and audit history
- Supabase Auth integration layer with secure owner-workspace provisioning migration
- Email-based password recovery with account-enumeration-safe messaging and global session revocation after reset
- Row-level security (RLS) policies and authenticated database functions, verified against the connected Supabase project
- API-connected CRM actions for creating, editing, searching, noting, and archiving contacts
- Subscription-bundle and add-on records with billing enforcement intentionally disabled
- Empty local test mode when live persistence is unavailable—no fabricated customers
- Audited maturity states for every advertised utility
- Sites-ready frontend build and static worker

## First local setup

1. Create or select the dedicated Toolstead Supabase project.
2. Apply every SQL file in `server/db/migrations` in numeric order.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Run the application:

```bash
npm install
npm run dev
```

Do not commit a real `.env` file or place credentials in commands that will be saved to shell history.

## Run the platform

```bash
npm install
npm run dev
```

With Supabase configured, authentication and CRM records persist through Row Level Security. Without a live provider, the dashboard enters an empty local test mode and stores only records created during that browser session.

The connected project has passed live owner provisioning, authenticated CRM RPC, and cross-workspace isolation tests. All temporary verification identities and records were rolled back.

## Production verification

```bash
npm run verify
```

## Important decisions

- Architecture: modular monolith, not premature microservices
- Data foundation: Supabase Auth and PostgreSQL, with the custom Node.js API retained for future provider-side operations
- Product model: subscription bundles plus optional add-on modules
- Billing: schema included, payment enforcement deferred
- Account model: solo owner now; memberships, roles, and permissions ready for employees later
- Tool maturity: CRM is implemented; Booking and Messaging are foundations only; five remaining utilities are not built

See `docs/architecture.md` for the system design, `docs/openapi.yaml` for the API contract, and `CHANGELOG.md` for release history.

Historical prototype design results and the current verification status are documented in `design-qa.md`.
