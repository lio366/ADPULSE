# ADPULSE v1.1.2 — change record

## Product language
- Exactly two supported languages: English and Spanish.
- Regional locale normalization (`es-MX` → `es`, `en-US` → `en`).
- Unsupported locales fall back to English.
- Removed additional locale catalogs and RTL metadata.
- Updated product, engineering, and localization documentation to match the two-language scope.

## Security review
- Added `docs/security/TENANT_ISOLATION_AUDIT_v1.1.2.md`.
- Confirmed code-level owner-scoped query patterns in reviewed business and customer-portal paths.
- Identified blockers: tenant identity is coupled to user identity; roles are global; tenant boundaries are not enforced by database-level row policies/tenant-consistency constraints.
- Production multi-tenant certification remains blocked.

## Tests and validation
- Localization Node test suite: 7/7 passed.
- Full TypeScript check, production build, full test suite, live database tests, penetration tests, and deployment validation: NOT VERIFIED.
