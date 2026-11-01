# ADPULSE Identity & RBAC — v1.4.0

## Delivered in this increment
- Additive MySQL 8.4 migration `0003_identity_rbac_governance.sql`.
- User and tenant lifecycle fields: status and `deletedAt`; tenant commercial `plan`.
- Normalized `roles`, `permissions`, `role_permissions`, and `membership_roles` tables.
- Invitation lifecycle extension (`roleId`, `deletedAt`) and invitation event ledger.
- Fail-closed RBAC primitives with tenant-scope, membership, tenant-status, permission, invitation-email, and role-assignment checks.
- Explicit migration command requiring verified backup confirmation; resumable migration marker.

## Compatibility strategy
Existing `users.role`, `tenant_memberships.role`, `ownerId`, and invitation role enum remain during transition. Do not remove or repurpose them until every API router, portal route, media operation, export, analytics query, worker, scheduled task, and agent execution has migrated and passed cross-tenant tests.

## Migration command
From `app/`:

```bash
# Create and independently verify a restorable database backup first.
# Set DATABASE_URL for the intended MySQL 8.4 database.
npm run db:migrate:identity
```

The command includes `--confirm-backup`, records successful completion in `adpulse_schema_migrations`, and refuses to run without `DATABASE_URL`. MySQL DDL auto-commits; on failure, no success marker is written. Correct the reported issue and rerun. Never run against production until backup/restore has passed in a staging clone.

## Security invariants
- Authorization requires a validated principal, active membership, active tenant, exact tenant match, and effective permission.
- The client-supplied tenant identifier is never an authorization source.
- Tenant-owned roles must belong to the actor's tenant. Platform system roles are separate.
- Invitation acceptance requires an unused, unrevoked, unexpired invitation and exact normalized email match.
- Soft-deleted users, tenants, memberships, roles, and invitations are excluded from authorization.
- Platform administration does not imply tenant data access.

## Not yet production-certified
Existing API routes still contain `ownerId`-scoped queries. This increment does not claim complete tenant migration, runtime DB-backed permission resolution, full invitation endpoints, signed append-only audit implementation, cross-tenant FK enforcement on all business tables, or all ten release-gate passes. Go-Live remains blocked until every route and asynchronous execution path is migrated and the full release matrix passes.
