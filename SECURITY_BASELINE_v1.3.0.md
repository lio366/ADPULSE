# ADPULSE Security Baseline v1.3.0 — implementation status

This package adds a staged security foundation. It is NOT a production security certification.

## Included in source
- Security policy primitives: 15-minute access-token target, 30-day refresh-token target, unsafe-method classification, strict origin comparison, and CSP/security-header policy.
- Local rate-limit primitive with unit tests. This is development/test only; it is not safe for multi-process or multi-node production.
- Additive MySQL migration for hashed refresh-token records, MFA factor ciphertext, and signed audit-event storage.

## Not yet wired / not verified
- Existing login is Kimi OAuth plus a one-year first-party HS256 session cookie. Token rotation/revocation is not implemented by this patch; replacing the external identity flow requires an explicit provider MFA capability and persistent session service.
- No Redis-backed distributed rate limiter is wired. Production must not rely on the local in-memory limiter.
- CSRF enforcement is not globally enabled yet. It must be wired with the deployed canonical origin and cookie strategy; OAuth callback is a separate cross-site entry point.
- CSP is a policy template, not yet attached globally. Existing frontend inline styles/scripts and third-party resources must be inventoried before enforcement to avoid breaking the application.
- Helmet is Express middleware and is not directly compatible with this Hono server. Use Hono-compatible security headers after CSP validation.
- MFA enrollment, TOTP verification, recovery codes, and mandatory admin MFA are not implemented. The schema only stages encrypted factor storage; encryption key management is required.
- Audit event schema stages signature fields, but no append-only writer, signing-key rotation, independent verification job, or immutable storage is implemented.

## Deployment blockers
1. Implement and test refresh-token rotation, reuse detection, revocation, and secure cookie handling.
2. Use shared Redis-backed rate limiting with per-IP, user, tenant, and route dimensions.
3. Wire CSRF protection for cookie-authenticated state-changing requests and validate exact allowed origins.
4. Validate CSP in report-only mode, then enforce; generate per-response nonces and remove unsafe inline scripts where possible.
5. Implement MFA lifecycle with encrypted TOTP secrets, recovery codes, step-up auth, and mandatory platform-admin MFA.
6. Implement signed audit writes using canonical serialization, keyed signatures, append-only permissions, external key management, and verification tests.
7. Run full build, lint, unit/integration/E2E tests, MySQL migration rehearsal, restore test, and cross-tenant adversarial suite.

Never claim zero-failure or production-ready until every blocker is closed with evidence.
