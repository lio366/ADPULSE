# ADPULSE — Source of Truth

## Base de código vigente para esta iteración
`AUTOMATICA_BUSINESS_INTEGRATED.zip` — 147 archivos, 305,526 bytes al recuperarse de Library el 31-oct-2026.

## Archivos comparados
- `adpulse-acumulado.zip`: 8 archivos, fragmento incompleto; no es repositorio compilable autónomo.
- `AUTOMATICA_BUSINESS_INTEGRATED.zip`: 147 archivos; elegido como base por incluir frontend, API, DB, auth, Docker y monitoring.
- `ADPULSE_AUTOMATICA_BUSINESS_15_DAY_TRIAL.zip`: 13 archivos; patch previo, no integrado automáticamente porque debe conciliarse con contratos, esquema y backend completo.
- `OKComputer_AdPulse_Autonomous_Marketing_OS.zip`: 133 archivos; rama/variante de producto, no reemplaza el paquete de 147 archivos en esta iteración.

## Stack confirmado por package.json
React 19, Vite 7, TypeScript 5.9, Hono 4, tRPC 11, Drizzle ORM, MySQL2, AI SDK, JOSE, S3 SDK, Node 22.

## Hechos que no se deben sobredeclarar
- Esquema con `ownerId` no equivale a aislamiento multi-tenant probado.
- El panel de marketing tiene estado local y temporizador de simulación; no equivale a worker autónomo 24/7.
- Docker Compose provisiona Redis queue, pero el paquete declara que falta consumidor/worker.
- TLS público, backups cifrados off-host, alert receiver, Stripe/ledger, aislamiento tenant probado y recovery drill están pendientes según INFRASTRUCTURE_STATUS.md.
- La compilación no se pudo verificar porque `npm ci` agotó el tiempo disponible y el entorno quedó sin tipos Vite/Node; no declarar build PASS.

## Cambios en esta versión
- Base de localización limitada a inglés y español, selector global, detección del idioma del navegador, persistencia local, `lang`, `dir`, fallback inglés e interpolación. Cualquier idioma no admitido se resuelve a inglés.
- Traducciones iniciales de shell para navegación, acciones y estados.
- Pruebas Node integradas para registro de idiomas, fallback, RTL e interpolación.
- Documentación de cobertura y límites de traducción.

## Current release gate

The tenant isolation review is documented in `docs/security/TENANT_ISOLATION_AUDIT_v1.1.2.md`. Current ownership is user-based and the role model is global; production-grade multi-tenant certification is blocked until tenant entities, membership roles, and enforced tenant boundaries are implemented and negatively tested.
