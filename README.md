# Toolstead Platform Foundation v0.3

A modular Node/PostgreSQL platform with an entitlement-aware tool shell, searchable Tool Library, and Lead Intake & CRM as the first production module.

## What is included

- Fastify API with versioned REST routes and an OpenAPI contract
- PostgreSQL migrations for workspaces, users, future employee memberships, roles, module entitlements, bundle tiers, CRM contacts, consent, timeline, work queue, appointments, outbox, and audit history
- Secure owner sign-in foundation with rotating refresh sessions
- API-connected CRM actions for creating, editing, searching, noting, and archiving contacts
- Subscription-bundle and add-on records with billing enforcement intentionally disabled
- Clearly marked demo fallback when the API or PostgreSQL is not running
- Sites-ready frontend build and static worker

## First local setup

1. Copy `.env.example` to `.env` and replace the development secrets.
2. Start PostgreSQL. The included `docker-compose.yml` is one option:

```bash
docker compose up -d postgres
```

3. Run the migration:

```bash
npm run db:migrate
```

4. Set `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, and `WORKSPACE_NAME` in the environment, then create or update the first owner workspace:

```bash
npm run db:bootstrap-owner
```

Do not commit a real `.env` file or place credentials in commands that will be saved to shell history.

## Run the platform

```bash
npm install
npm run dev
```

The web application and API run together. Without PostgreSQL, the dashboard deliberately falls back to records labeled `--- DEMO DATA`.

## Production verification

```bash
npm run verify
```

## Important decisions

- Architecture: modular monolith, not premature microservices
- Backend: custom Node.js API and PostgreSQL
- Product model: subscription bundles plus optional add-on modules
- Billing: schema included, payment enforcement deferred
- Account model: solo owner now; memberships, roles, and permissions ready for employees later

See `docs/architecture.md` for the system design, `docs/openapi.yaml` for the API contract, and `CHANGELOG.md` for release history.

Design comparison and browser test results are documented in `design-qa.md`.
