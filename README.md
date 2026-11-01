# ADPULSE — US BUSINESS OS

United States B2B SaaS — Florida-first launch scope; architecture intended for expansion across the United States.

## Source baseline
This package is based on `AUTOMATICA_BUSINESS_INTEGRATED.zip` (147 files), the most complete source package found in the project Library. The 8-file `adpulse-acumulado.zip` is only a fragment. See `docs/product/SOURCE_OF_TRUTH.md` before replacing or merging source archives.

## Stack
- Node.js 22
- React 19 + Vite 7 + TypeScript
- Hono + tRPC
- Drizzle ORM + MySQL 8.4
- AI SDK / JOSE / S3 SDK
- Docker Compose, Nginx, Redis cache + Redis queue, Prometheus, Grafana, Alertmanager, Node Exporter

## Localization foundation
Only English and Spanish are supported. The selector, locale detection, local preference persistence, document `lang`/`dir`, English fallback and initial shell translations are implemented. The full application is **not yet fully translated**. See `app/src/i18n/README.md` and `docs/product/LOCALIZATION_COVERAGE.md`.

## Development
```bash
cd app
npm ci
npm run dev
npm run test:i18n
npm run check
npm run lint
npm test
npm run build
```

## Critical limitations
- This package is not certified or approved for production.
- The marketing console includes a browser-local simulation; that is not a persistent 24/7 agent runtime.
- Queue consumer/worker and scheduler are not implemented in the source baseline.
- Tenant isolation is not yet validated across API, DB, cache, jobs, files, exports and webhooks.
- Stripe billing, financial ledger and persistent 15-day trial conversion are not implemented in the integrated source baseline.
- Public TLS, encrypted off-host backup and recovery drill remain pending.
- The clean dependency install timed out in the available environment. Typecheck and Vite build are therefore not verified. Only `npm run test:i18n` passed (5/5).

## Commercial guardrails
- 15-day no-card trial is the approved product requirement, not yet a validated live billing flow.
- No paid conversion or charge without explicit acceptance of the displayed price and terms.
- Sensitive, financial, external, legal, employment or irreversible actions require policy approval.
- Prices in planning models are assumptions until validated with paying customers and actual provider costs.

## Documentation
- `docs/superpowers/specs/` — product/architecture design.
- `docs/superpowers/plans/` — implementation plan.
- `docs/product/` — source of truth and product decisions.
- `docs/finance/` — expected value and unit economics.
- `docs/security/` — security and tenancy requirements.
- `docs/operations/` — validation and runbooks.
- `RELEASE_NOTES_v1.1.md` — this iteration's changes.

## Current release gate (v1.1.2)

The product language scope is English and Spanish only. The focused localization suite passes 7/7 tests. The tenant isolation static review identifies P1 architecture blockers; this codebase is not certified for multi-tenant production. See `docs/security/TENANT_ISOLATION_AUDIT_v1.1.2.md` and `RELEASE_NOTES_v1.1.2.md`. A passing localization test does not imply a passing application build or production readiness.


## Release note
Public landing integration details: `RELEASE_NOTES_v1.1.4_PUBLIC_LANDING_INTEGRATION.md`.


## US market scope (v1.1.5)
- Product market: United States only; initial commercial launch focus: Florida.
- Billing currency: USD. Tax configuration must be based on nexus and applicable state/local rules; no tax-compliance certification is implied.
- Product languages: English and Spanish only. Translation coverage remains partial; see `docs/product/LOCALIZATION_COVERAGE.md`.
- Do not market this release as production-ready, SOC 2 certified, HIPAA compliant, PCI DSS compliant, or fully multi-tenant. Those statuses have not been established.
- US legal/privacy/communications requirements must be assessed for the actual data, channels, customer states, and service features.

## v1.1.5 audit baseline
See `docs/security/ADPULSE_USA_FULL_GAP_AUDIT_v1.1.5.md` and `docs/product/US_MARKET_SCOPE_v1.1.5.md`. This release packages the existing source with an updated US-market decision and audit findings; it does not claim that the identified engineering gaps have been fixed.


## v1.2 tenancy rollout

See `RELEASE_NOTES_v1.2.0_TENANCY_EXPAND.md`. The migration is staged as EXPAND/BACKFILL only; do not run enforcement or remove legacy ownerId fields until API route conversion and cross-tenant tests are complete.

## v1.2 tenancy rollout

See `RELEASE_NOTES_v1.2.0_TENANCY_EXPAND.md` and `docs/tenancy/TENANCY_INTEGRATION_AUDIT_v1.2.0.md`. The migration is staged as EXPAND/BACKFILL only; do not run enforcement or remove legacy ownerId fields until API route conversion and cross-tenant tests are complete.

