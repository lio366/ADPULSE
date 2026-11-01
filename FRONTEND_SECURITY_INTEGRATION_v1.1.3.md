# ADPULSE frontend security integration — v1.1.3

## Integration decision
The supplied standalone JavaScript client was not copied into this release. The actual v1.1.2 application is React 19 + TypeScript + tRPC + Hono and authenticates through server-managed cookies. The supplied script expects a different DOM, localStorage JWT, and REST endpoints (`/api/register`, `/api/dashboard`, etc.); direct inclusion would create a parallel, incompatible client and bypass the existing application flow.

## Applied change
- The autonomous marketing demonstration's browser-persisted state is now namespaced by the authenticated platform account (`adpulse-autonomous-v3:user:<userId>`), preventing one signed-in platform account from loading another account's demo state in the same browser profile.
- Persisted state is parsed and shape-checked before use. Corrupt or incompatible data falls back to a clean demo state.
- The marketing console receives the authenticated user ID from the protected route. The existing platform-admin gate remains in place.

## Existing controls confirmed by static inspection
- `useAuth` obtains the current user through `trpc.auth.me`; the client does not store a bearer JWT in localStorage.
- The API context authenticates the request from request headers/cookies.
- `adminQuery` enforces authentication and the global `admin` role on the server.
- React text interpolation is used for the reviewed dashboard views; no `dangerouslySetInnerHTML` usage was found in the reviewed application source.
- Business data queries generally scope records by `ownerId` and derive that owner from the authenticated server context.

## Blocking architecture limitations
- `ownerId` is currently the authenticated user ID, not an independent tenant/business ID.
- The global user role enum (`user`, `admin`) does not provide tenant-specific membership roles.
- Isolation relies on application query predicates; the schema does not establish a complete database-enforced tenant boundary.
- The marketing console still contains a browser-local simulation. Its data is not a live execution ledger and must not be represented as production agent activity.

## Required before multi-tenant production
1. Introduce `tenants` and `tenant_memberships` with roles such as `tenant_owner`, `tenant_admin`, `tenant_member`, and a separately governed `platform_admin`.
2. Migrate every business table from `ownerId` to `tenantId` with a reviewed migration and rollback plan.
3. Centralize tenant-scoped repository access and enforce membership checks on every read, write, export, media operation, webhook, and background job.
4. Add composite tenant-consistency constraints/foreign keys and database-level isolation where supported.
5. Add negative integration tests for cross-tenant list/get/update/delete, IDOR, bulk actions, signed media URLs, portal access, membership revocation, and concurrent writes.
6. Use secure HttpOnly, Secure, SameSite cookies with CSRF protections appropriate to deployment; verify session rotation/revocation and rate limits.
7. Keep platform administration in a separate authorization domain; tenant owners must never receive cross-tenant statistics or support privileges by default.

## Validation status
- Source archive inspected and patch applied.
- `npm run check` attempted; it is BLOCKED because the archived `app/node_modules` is incomplete and TypeScript cannot resolve `@types/node` and `vite/client`.
- No claim of successful build, test suite, runtime security test, or production multi-tenant certification is made.
