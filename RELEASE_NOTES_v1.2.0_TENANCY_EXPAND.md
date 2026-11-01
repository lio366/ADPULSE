# ADPULSE USA v1.2.0 — Tenancy foundation (EXPAND)

## Integrated
- Added the v1.2 tenant identity tables: tenants, memberships, platform admins and invitations.
- Added nullable tenantId columns to all 12 business tables as an additive EXPAND migration. Existing ownerId-based application behavior remains compatible during the migration window.
- Added pure authorization policy functions for tenant, platform and customer-portal domains, plus membership-change guardrails.
- Added unit tests for membership denial, suspended tenants, platform/tenant separation, portal gating and last-owner protection.
- Added a dry-run-first backfill script. It fixes the documented information_schema preflight defect by validating TABLE_NAME and COLUMN_NAME separately, blocks orphan/cross-owner customer links, requires explicit backup confirmation for apply, and only promotes legacy admins when explicitly requested.

## Critical migration boundary
This release intentionally does **not** execute the ENFORCE migration and does not claim that all tRPC routes have been converted to tenantId authorization. Existing routes continue to scope queries by authenticated ownerId while EXPAND/BACKFILL is staged. Do not set tenantId NOT NULL or drop ownerId until the application layer has been fully migrated and cross-tenant integration tests pass.

## Migration sequence
1. Take a database backup and prove restoration in an isolated environment.
2. Apply `0001_tenancy_expand.sql` to a staging database.
3. Run `npm run db:backfill:dry`. Resolve every blocker.
4. Run `npm run db:backfill:apply` only after verifying the backup. Add `--promote-platform-admins` only for explicitly approved accounts.
5. Verify tenantId is populated and row counts are unchanged.
6. Keep ENFORCE blocked until all API routers, portal queries, media access, background jobs and tests use tenantId plus active membership authorization.

## Known limits
- No production migration has been run.
- No real database or backup was available for execution.
- ENFORCE and CONTRACT are intentionally deferred; the previous 0002 draft must be reviewed against the actual schema and route conversion before registration.
- Invitation token issuance/acceptance endpoints and tenant selection UI are not yet wired to the application.
- A full build/E2E run remains pending dependency installation and database-backed test environment.
