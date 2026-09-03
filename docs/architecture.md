# Toolstead Platform Architecture

## Decision

Toolstead starts as a **modular monolith**: one Node.js API, one PostgreSQL database, and independently gated product modules.

This is the right operational size for an early product with one owner and a growing tool catalog. It keeps deployment, debugging, transactions, and security manageable while preserving clear module boundaries. A module can later become a separate service only when its scale, deployment cadence, or ownership justifies that cost.

## Current production code foundation

| Concern          | Implementation                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Web application  | React 19 and Vite                                                                                                          |
| API              | Fastify 5, REST, versioned under `/api/v1`                                                                                 |
| Contract         | OpenAPI 3.1 in `docs/openapi.yaml`                                                                                         |
| Database         | Connected Supabase PostgreSQL 17 project with tracked migrations                                                           |
| Authentication   | Supabase Auth browser integration and owner self-registration; legacy Node API sessions retained for server-only evolution |
| Authorization    | Auth-user mapping, workspace membership roles, module entitlements, and authenticated RPC boundaries                       |
| Tenant isolation | Supabase Row Level Security using authenticated workspace membership; live two-owner isolation test passed                 |
| Reliability      | Correlation IDs, structured/redacted logs, request limits, timeouts, idempotent message queue writes                       |
| Security         | Helmet headers, strict cookies, CORS allowlist, rate limiting, input validation, audit records                             |
| Billing          | Bundle and entitlement schema present; enforcement feature flag remains disabled                                           |

## Bounded modules

- **Identity & workspace:** users, owner membership, future employee permissions, workspace switcher.
- **Module catalog:** product modules, subscription bundles, add-ons, and workspace entitlements.
- **CRM core:** contacts, contact channels, consent, work queue, and unified timeline.
- **Communication seam:** consent-aware outbox with idempotency; providers and delivery workers are intentionally deferred.
- **Booking seam:** workspace-scoped appointment records.

Audited maturity:

- **Implemented:** Lead Intake & CRM.
- **Foundation only:** Booking & Calendar; Messaging Hub.
- **Not built:** Sites/Funnels/Forms, MarginPilot, Payments, Media Kit, and Analytics.

Unfinished modules cannot be activated or labeled available.

## Request path

1. Supabase Auth establishes the browser session.
2. Auth onboarding maps the user to one Toolstead owner workspace.
3. Authenticated RPC functions run as the caller and remain subject to RLS.
4. RLS verifies active workspace membership for every customer-data operation.
5. The browser receives only records authorized for the active workspace.
6. Future provider secrets and delivery workers remain in server-controlled components.

## Error contract

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "The request could not be accepted.",
    "requestId": "req-123"
  }
}
```

## Scale path

- Add PgBouncer before increasing application replicas.
- Move outbox dispatch to a dedicated worker and use `FOR UPDATE SKIP LOCKED`.
- Add Redis only for measured hot reads or distributed rate limits.
- Add read replicas only after query and index evidence justifies them.
- Extract a module into a service only when it requires independent scaling or ownership.

## Security deployment requirements

- Use a non-owner PostgreSQL runtime role so RLS cannot be bypassed by table ownership.
- Generate unique production JWT and cookie secrets.
- Require TLS for browser, API, and PostgreSQL traffic.
- Store secrets in the deployment platform, never in committed files.
- Back up PostgreSQL daily and test restoration quarterly.
- Keep billing enforcement disabled until a later approved phase connects a payment provider and webhook verification.

## Migration strategy

Migrations are append-only and tracked in `schema_migrations`. Future destructive changes must use expand-and-contract:

1. add the new nullable structure;
2. deploy compatible readers and writers;
3. backfill and reconcile;
4. enforce constraints;
5. remove the old structure in a later release.
