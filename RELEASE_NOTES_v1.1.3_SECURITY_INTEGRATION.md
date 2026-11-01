# ADPULSE v1.1.3 — Frontend security integration

- Integrated account-scoped persistence for the browser-local marketing console.
- Added validation of persisted simulation state before hydration.
- Preserved the existing React/tRPC/cookie authentication architecture; the standalone REST/localStorage-JWT script was not injected because it is incompatible with this codebase.
- Added a security integration report documenting confirmed controls, limitations, and production blockers.
- Validation: `npm run check` attempted but blocked by missing archived type packages (`@types/node`, `vite/client`). Build and tests remain unverified.
