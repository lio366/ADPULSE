# ADPULSE v1.3.0 — Security baseline staging

- Added baseline HTTP security headers globally in Hono; CSP is Report-Only pending asset/origin inventory.
- Added security policy primitives and rate-limit unit tests (local-only primitive; not production distributed enforcement).
- Added additive SQL schema for refresh-token hashes, encrypted MFA factor material, and signed audit event metadata.
- Added deployment blockers and explicit implementation status.

This is staged security work, not production certification. Existing one-year Kimi session token remains in place pending a complete persistent refresh-session lifecycle. CSRF, distributed rate limiting, MFA flows, and signed audit writer remain unimplemented.
