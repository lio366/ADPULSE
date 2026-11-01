# ADPULSE — US SaaS technical gap audit v1.1.5

**Decision: NOT APPROVED FOR PRODUCTION / NOT CERTIFIED MULTI-TENANT.**

**Audit basis:** static inspection of the v1.1.4 archive (React 19, Vite 7, TypeScript, Hono, tRPC, Drizzle, MySQL 8.4) and the separate Express/JSON backend source supplied in conversation. No production environment, database, credentials, or live payment system was accessed. No penetration test or full runtime build was completed.

## 1. Executive decision

Use the existing React/Hono/tRPC/Drizzle application as the product baseline. Do not merge the supplied Express server as a second backend. The Express code uses a separate API contract, JWT bearer authentication, and `data/db.json`; direct integration would create duplicate identity, persistence, and authorization systems.

The current source is a useful product prototype with a public landing page, login flow, business workspace, customer portal, and database-backed business records. It is not yet a complete independently provisioned multi-tenant SaaS platform.

## 2. Critical and high-priority findings

### P0 — No independent tenant and membership model (release blocker)

Observed: business tables use `ownerId` tied to the authenticated user ID. There is no first-class tenant/business table and tenant-membership relation covering multiple employees, multiple businesses, role assignment, ownership transfer, and tenant-scoped authorization.

Impact: the current model cannot safely express a company account with multiple users and different permissions, nor a user belonging to multiple businesses.

Required: add `tenants`, `tenant_memberships`, invitations, tenant-scoped roles, and a separately governed `platform_admin`; migrate all business-owned rows to `tenantId` with reviewed migration, backfill, rollback, and data-integrity checks.

### P0 — Global role model is too coarse

Observed: `users.role` is a global enum `user/admin`; `adminQuery` checks the global `admin` role. The supplied Express backend separately treats tenant `owner/admin` membership as sufficient for `/api/admin/stats`, which exposes cross-tenant platform data to ordinary tenant owners if that backend were deployed.

Required: distinguish `platform_admin`, `tenant_owner`, `tenant_admin`, `tenant_member`, and customer-portal identity. Platform routes must require `platform_admin` only. Tenant permissions must be checked against the active tenant membership on every operation.

### P0 — Tenant boundary is application-predicate based

Observed: many Drizzle queries scope by `ownerId`, which is a useful control, but the schema does not provide a complete tenant-consistency boundary. The existing audit already identifies missing tenant-level constraints and incomplete coverage across all surfaces.

Required: central tenant-scoped repositories; tenant-consistent foreign/composite keys; database-level controls where supported; negative integration tests for every API, object, media URL, export, webhook, and job.

### P1 — Authentication is tied to external Kimi OAuth

Observed: login/session handling exchanges Kimi OAuth codes and verifies sessions using an HMAC secret derived from `APP_SECRET`; session lifetime is one year. The environment loader requires Kimi endpoints and app credentials in production.

Impact: commercial US onboarding depends on an external identity provider and its account lifecycle. Long-lived sessions increase exposure if a cookie is stolen. No session revocation/session inventory is evident in the reviewed code.

Required: decide whether Kimi is an intentional identity dependency for US customers. If not, implement a supported customer identity provider or first-party identity lifecycle. Add short-lived/rotatable sessions, revocation, session inventory, MFA policy for privileged accounts, login abuse controls, CSRF review, and recovery flows. Verify `APP_SECRET` strength/rotation and cookie behavior in the actual deployment.

### P1 — Logout is cookie clearing, not demonstrated server-side revocation

Observed: logout expires the session cookie. The signed token is stateless and has a one-year expiry; no server-side session denylist/revocation store is visible in the reviewed files.

Required: implement revocable sessions or short-lived access tokens with rotating refresh/session identifiers and revoke-on-logout/password/security-event semantics.

### P1 — Cookie/CSRF policy needs deployment validation

Observed: non-localhost cookies use `SameSite=None; Secure`; the reviewed flow does not show a complete CSRF token/origin enforcement design.

Required: document trusted origins, enforce origin/CSRF controls for cookie-authenticated mutations, test cross-site requests, and confirm proxy/TLS behavior. Do not weaken `Secure` in production.

### P1 — Marketing demo state is not a real autonomous runtime

Observed: the marketing console stores a browser-local simulation. It is not a durable worker, scheduler, or real agent execution ledger.

Required: keep demo labeling explicit. Implement server-side job orchestration, durable queue consumers, scheduler, idempotency, retry/dead-letter handling, approval gates, tenant-scoped usage metering, and execution audit before claiming autonomous 24/7 operation.

### P1 — Billing and trial conversion incomplete

Observed in the source README: Stripe billing, financial ledger, and persistent 15-day trial conversion are not implemented in the integrated source baseline. The supplied Express code merely changes a subscription record and has no verified payment provider flow.

Required: Stripe customer/subscription lifecycle, server-side price IDs, signed/idempotent webhooks, cancellation/refund/dunning handling, tax integration after tax review, entitlement enforcement, immutable financial ledger, and reconciliation. Never accept arbitrary client-supplied plan/price values.

### P1 — Backups and disaster recovery not proven

Observed: Compose defines a local MySQL backup profile with 14-day retention, but off-host encrypted backup and a tested recovery drill remain pending per the source README.

Required: encrypted off-host backups, retention policy, key management, point-in-time recovery strategy, restore drills, measured RPO/RTO, and tenant/data integrity verification.

### P1 — Build and release verification incomplete

Observed: source README records incomplete dependency installation; typecheck and Vite build were not verified. Prior validation attempted `npm run check` but could not resolve `@types/node` and `vite/client` in the archived environment.

Required: clean reproducible `npm ci`, `npm run check`, `npm run lint`, `npm test`, `npm run test:i18n`, `npm run build`, container build, smoke tests, and browser E2E in CI. Preserve logs and artifact hashes.

### P1 — Localization is partial

Observed: English and Spanish selector/foundation exist, but the source README explicitly says the full application is not fully translated.

Required: complete translation of public landing, login, customer portal, admin console, emails, validation/errors, consent/legal flows, and accessibility labels. Test locale fallback and persistence.

### P1 — US legal/tax/compliance readiness not established

Observed: the project has no evidence in the reviewed source of completed US state privacy analysis, Florida-specific legal review, tax nexus determination, CAN-SPAM/TCPA workflow review, or executed customer/vendor agreements.

Required: legal/tax review based on actual customer data, states, communication channels, payment flow, and vendors. Do not claim SOC 2, PCI DSS, HIPAA, or other certification without independent evidence and a defined scope.

## 3. Findings in supplied Express/JSON backend (do not merge as-is)

- `JWT_SECRET` falls back to the predictable literal `adpulse-dev-secret`.
- `/api/admin/stats` authorizes any tenant owner/admin, not a separate platform administrator; exposes global tenant/activity information.
- `db.json` writes are non-transactional and vulnerable to concurrent lost updates or partial writes.
- no session revocation, rate limiting, email verification, password reset, or MFA flow is present in the supplied code.
- `/api/trial/accept` accepts arbitrary plan strings and records consent without payment, verified price, terms version, or role-specific commercial authorization.
- dashboard metrics and platform revenue/cost/uptime values are hard-coded demo values.
- workflow creation records a workflow but does not implement durable execution, retries, idempotency, or a worker.
- role checks verify membership existence in several routes but do not enforce a complete permission matrix or membership status.
- validation, request abuse controls, and security headers are incomplete in the supplied server.

## 4. Positive controls observed in the primary application

- React/Hono/tRPC/Drizzle architecture is internally consistent; do not replace it with the Express prototype.
- server-managed HttpOnly session cookie is used; the reviewed frontend does not store bearer JWT in localStorage.
- several business queries and mutations scope records by authenticated `ownerId` and derive that ID from server context rather than trusting a client-supplied owner ID.
- customer portal resolution binds portal accounts to customer and owner identifiers.
- Zod validation is used across reviewed business procedures.
- Hono has liveness/readiness endpoints, request correlation/access logging, API 404 handling, and generic error responses.
- Docker Compose includes MySQL, separate Redis cache/queue, health checks, resource limits, and monitoring services; presence in Compose does not prove operational readiness.

## 5. Target US product model

- US-only commercial market; Florida-first go-to-market.
- USD billing; state/local tax handling only after nexus review.
- English and Spanish only.
- Customer portal and platform admin console remain separate.
- Internal agents, prompts, provider keys, infrastructure topology, and internal control planes remain private.
- Each business is a tenant. Every employee, location, workflow, file, automation, subscription, audit event, and usage record is scoped to that tenant.

## 6. Release gates

1. Tenant schema/migration and role model complete.
2. Negative cross-tenant tests pass for list/get/create/update/delete, bulk actions, portal, media/signed URLs, exports, webhooks, background jobs, and support operations.
3. Authentication/session/CSRF/rate-limit review passes.
4. Billing webhooks are signature-verified, idempotent, and reconciled.
5. Durable workers and scheduler pass retry, duplicate-event, outage, and recovery tests.
6. Audit trail has append-only semantics and tamper evidence for privileged/financial events.
7. Encrypted off-host backup and restore drill meet documented RPO/RTO.
8. Clean CI build, tests, container build, and browser E2E pass.
9. English/Spanish coverage and US legal/tax launch review completed.

## 7. Verification status

- Archive extraction and source inspection: completed.
- ZIP integrity: to be verified on the final deliverable.
- Runtime build, complete tests, penetration test, live DB checks, payment integration, backup restore, and production deployment: NOT performed by this audit.
- Production readiness: NOT APPROVED.
