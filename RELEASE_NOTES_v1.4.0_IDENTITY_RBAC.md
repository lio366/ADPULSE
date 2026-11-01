# ADPULSE v1.4.0 — Identity & RBAC Expansion

- Added additive MySQL 8.4 schema migration for lifecycle fields, tenant-scoped roles, permissions, role-permission mappings, membership-role assignments, invitation role binding and invitation event history.
- Extended Drizzle schema for the new structures.
- Added fail-closed RBAC and invitation validation primitives with adversarial unit tests.
- Added explicit backup-confirmed migration runner and npm scripts.
- Preserved legacy `ownerId` and role fields for a controlled compatibility migration.

## Verification status
- Node syntax check for migration runner: PASS.
- Full TypeScript check/build: NOT RUN; dependency installation did not complete in the available environment.
- Vitest: NOT RUN for the same dependency availability reason.
- MySQL migration: NOT RUN; no database connection or backup/restore verification was authorized or available.
- Full API tenant cutover: NOT COMPLETE. Existing routes still query by `ownerId`.

**Release classification: engineering expansion only; not production certified. Go-Live remains blocked.**
