# ADPULSE v2.0.0 — Tenant Business Core Expansion

## Scope delivered in this package
- Extended user, tenant, membership and invitation lifecycle enums while retaining numeric IDs and compatibility columns.
- Added email verification timestamp and canonical permission codes.
- Added tenant-owned workflows, tenant agents, CRM leads, deals, tenant files, subscriptions, invoices and audit log storage.
- Added fail-closed tenant membership and permission guards, tenant-prefixed storage-key helper, permission catalog, and HMAC audit-event signing/verification primitives.
- Added idempotent RBAC seed command for global system roles, permissions and compatibility membership-role assignments.
- Added additive MySQL 8.4 migration `0004_v2_tenant_business_core.sql` and explicit migration command.
- Public landing `leads` remains the unscoped public prospect inbox; tenant CRM records use `crm_leads` to avoid mixing anonymous prospects with tenant-owned data.

## Commands (run from `app/`)
```bash
npm ci
npm run check
npm run test:tenancy
npm test
npm run build
```

Database operations require a separately verified, restorable backup and an explicitly configured DATABASE_URL:
```bash
npm run db:migrate:v2 -- --confirm-backup
npm run build
npm run db:seed:rbac
```
The migration runner refuses production unless the additional `--allow-production` argument is supplied. Production execution is not authorized by this package generation.

## Compatibility and migration safety
- `ownerId` is retained; no destructive ownerId drop is included.
- Existing `users.role` is retained for compatibility and MUST NOT be used as platform authorization.
- Existing public `leads` table is retained for website enquiries; tenant CRM uses `crm_leads`.
- New business tables have mandatory tenantId. Existing business tables still have nullable tenantId until their ownerId-to-tenantId backfill and every route/worker cutover are verified.
- Migration is additive and may partially apply if MySQL reports an error; inspect schema before retrying. MySQL DDL is not transactionally rolled back.

## Not production-certified
This package does not claim complete application tenant isolation. Existing routers, customer portal, media, business queries, billing, metrics, scheduled jobs and workers still contain ownerId-based access paths. They must be migrated and adversarially tested before removing ownerId. Audit signing primitives exist, but a transactional, concurrency-safe append-only audit writer, key custody/rotation and external immutable retention are still required.

Go-Live remains blocked until all ten release-gate audits pass with reproducible evidence: multi-tenant, security, restore, load, build, E2E, billing, worker, alerting and backup.

Static migration structure check:
```bash
npm run db:verify:v2
```
