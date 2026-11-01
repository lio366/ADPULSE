# Validation baseline — 2026-10-31

| Check | Result | Evidence |
|---|---|---|
| Archive inventory | PASS | Integrated source archive has 147 files; original fragment has 8 |
| Locale core tests | PASS | `npm run test:i18n` — 5/5 passing using Node 22.16.0 |
| npm clean install | BLOCKED | `npm ci --ignore-scripts --no-audit --no-fund` timed out twice |
| TypeScript check | BLOCKED | `npm run check -- --pretty false` cannot find `@types/node` and `vite/client` because dependency install incomplete |
| Full Vitest suite | NOT RUN | Vitest not installed in available node_modules |
| Vite production build | NOT RUN | Vite not installed in available node_modules |
| Docker Compose build | NOT RUN | Docker daemon/CLI unavailable in this environment |
| Tenant isolation | NOT VALIDATED | Requires tests against real MySQL and full API paths |
| Worker recovery | NOT VALIDATED | Queue consumer/scheduler not implemented in source baseline |
| Billing and trial | NOT IMPLEMENTED/NOT VALIDATED | Stripe and persistent trial state absent from integrated package |
| Public TLS and off-host backup | BLOCKED | Destination, certificates and external credentials absent |

No result above should be reinterpreted as a production release approval.
