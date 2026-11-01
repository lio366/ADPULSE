# Tenant isolation audit — ADPULSE v1.1.2

**Status: NOT CERTIFIED FOR MULTI-TENANT PRODUCTION**  
**Review type:** Static source review; no live database, penetration test, concurrency test, or runtime authorization test was performed.

## Scope reviewed

- `app/db/schema.ts`
- `app/api/middleware.ts`
- `app/api/context.ts`
- `app/api/business-router.ts`
- `app/api/queries/business.ts`
- `app/api/queries/portal.ts`
- `app/api/portal-router.ts`
- `app/api/media-router.ts`
- `app/api/lead-router.ts`

## Controls observed

1. Business workspace reads in `api/queries/business.ts` filter business records by `ownerId`.
2. Business mutations generally write `ownerId` from the authenticated user context; they do not accept the owner ID from client input.
3. Record lookups for tasks, customers, inventory, estimates, and business records combine record ID and owner ID.
4. Customer portal resolution binds a portal account to a customer using both `customerId` and `ownerId`.
5. Portal estimates, records, media, and updates are scoped by owner and customer identifiers.
6. Media list, remove, and customer upload paths apply owner/customer context checks.
7. Business routes require the `admin` role; portal routes require authentication and resolve the linked customer account.

These are positive code-level controls, not proof of isolation under all execution paths.

## Blocking findings

### P1 — Tenant identity is a user identity

Business tables use `ownerId` tied operationally to `ctx.user.id`. There is no independent `businesses`/`tenants` entity and no membership relation connecting multiple users to one business. This prevents a clean model for company owners, employees, locations, role assignments, ownership transfer, and multiple businesses per user.

**Required:** introduce tenant/business identity, tenant membership, and explicit tenant-scoped authorization. Migrate every business-owned table from user ownership to tenant ownership with a reviewed migration and rollback plan.

### P1 — Global role model

`users.role` is a global enum (`user`, `admin`), and `adminQuery` checks that global value. It does not represent tenant-specific roles. A user cannot safely be an administrator in one company and a regular employee/customer in another under this model.

**Required:** replace business authorization with tenant membership roles and permissions. Keep platform operator privileges separate from tenant roles and require explicit platform-level authorization for cross-tenant support.

### P1 — No database-enforced tenant boundary

Tenant isolation is implemented by manually including `ownerId` in individual Drizzle queries. The reviewed schema does not show database row-level security or foreign-key constraints enforcing tenant-consistent relationships. A future query that omits the owner predicate could leak data.

**Required:** add tenant-consistency foreign keys/composite keys where supported, centralize tenant-scoped repositories, and implement database-enforced isolation where the selected database supports it. Add negative cross-tenant integration tests for every read/write surface.

### P2 — Ownership constraints and data model

`businessSettings.ownerId` is unique, which currently enforces one settings row per user rather than one per business. Customer and portal relationships also depend on globally unique row IDs plus application-level owner checks; the database does not express the full tenant-consistency invariant.

**Required:** redesign unique constraints and relational keys around `tenantId`; verify tenant/customer consistency at the database layer.

## Additional verification required

- Enumerate every table, API procedure, background job, object-storage operation, export, webhook, and admin/support action.
- Prove cross-tenant denial for list, get-by-ID, update, delete, bulk operations, signed URLs, and exports.
- Test race conditions for portal invitation claims, membership revocation, role changes, and concurrent writes.
- Add audit events for tenant membership and privileged cross-tenant access.
- Add tenant isolation regression tests to CI; fail the release on any cross-tenant read/write.
- Confirm backups, restore, and support tooling preserve tenant boundaries.

## Release decision

Do not represent the current implementation as certified multi-tenant isolation and do not onboard unrelated production tenants until the P1 items are addressed and negative integration tests pass. This audit is a static review only; it does not establish that a vulnerability was exploited or that every route is defective.
