# Release — Automática Business Infrastructure Integration

Se integró una capa de despliegue endurecida alrededor del código existente, manteniendo React/Vite, Hono, Drizzle y MySQL. Se corrigió el Dockerfile para no copiar `.env`, incluir dependencias de producción y ejecutar como usuario no-root. Se añadieron health checks, redes segmentadas, volúmenes persistentes, Redis separado para caché y colas, Nginx, monitorización y backups locales automatizados.

No se han añadido workers ficticios ni se afirma que la cola esté conectada al flujo de negocio. El siguiente hito es implementar el consumer idempotente y validar el aislamiento multi-tenant, backups/restauración, TLS y alertas externas.
