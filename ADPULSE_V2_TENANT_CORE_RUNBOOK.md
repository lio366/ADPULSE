# ADPULSE v2.0 Tenant Core Runbook

## Deployment order
1. Export and verify a restorable MySQL backup.
2. Apply the app release to a staging environment first.
3. Run `npm ci`, `npm run check`, `npm run test:tenancy`, `npm test`, and `npm run build`.
4. Apply `npm run db:migrate:v2 -- --confirm-backup` against staging.
5. Run `npm run db:seed:rbac` after a successful build; verify role/permission counts and sample membership links.
6. Verify existing public lead capture still writes to `leads`; tenant CRM writes only to `crm_leads`.
7. Test A-to-B read/write/export/metrics denial before any tenant-facing production rollout.

## Production command guard
The migration runner requires `--confirm-backup`. It refuses when `NODE_ENV=production` unless `--allow-production` is also explicitly supplied. That switch is a technical safeguard, not production approval. The project release gate remains the authority and all ten PASS results are required.

## Tenant request invariant
- Authenticate the user.
- Resolve the active tenant from trusted server-side session/context, not an untrusted body field.
- Load active membership for `(userId, tenantId)` from the database.
- Resolve effective permission codes through active membership roles.
- Reject suspended/deleted users, memberships, or tenants.
- Scope every select/update/delete/export/aggregate by tenantId even after authorization.
- Propagate tenantId into queue messages, agent execution context, cache keys, object-storage keys and audit events.

## Existing migration debt
The current app still has ownerId-based routes and business query helpers. New schema and guard primitives do not automatically secure those call sites. Do not make tenantId NOT NULL or drop ownerId until the full route/worker cutover, verified backfill, restore test and adversarial tests have passed.
