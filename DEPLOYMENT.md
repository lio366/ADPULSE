# Automática Business — infraestructura integrada

## Qué se integró

- Docker multi-stage para Node.js 22; producción sin `.env` dentro de la imagen y ejecución como usuario no-root.
- Docker Compose con Hono API, MySQL 8.4, Redis de caché, Redis de cola, Nginx, Prometheus, Grafana, Alertmanager, Blackbox Exporter y Node Exporter.
- Health endpoints `/health/live` y `/health/ready`; readiness ejecuta `SELECT 1` contra MySQL.
- Persistencia en volúmenes Docker.
- Redis de caché con política de expulsión `allkeys-lru`; Redis de cola con AOF y `noeviction`.
- Backups lógicos diarios de MySQL, retención local de 14 días.
- Monitorización de disponibilidad y memoria del host.
- Puertos de monitorización enlazados a `127.0.0.1`; MySQL y Redis no publican puertos al host.
- Secretos externos mediante `.env`; `.env` excluido del contexto Docker y Git.

## Límites detectados en el código fuente

Esta entrega integra infraestructura, no inventa módulos de negocio que no existen en el ZIP:

1. El backend actual usa Drizzle + MySQL2. Se conserva MySQL; no se migra a PostgreSQL.
2. El repositorio no contiene un worker/consumer de colas ni un scheduler ejecutable. Redis de cola queda provisionado, pero no procesa tareas hasta que se implemente y pruebe un consumidor real. No se declara un worker ficticio.
3. La aplicación no consume todavía `REDIS_CACHE_URL` ni `REDIS_QUEUE_URL`; son variables de infraestructura reservadas para la integración posterior.
4. Las tablas de negocio contienen `ownerId`, pero esto por sí solo no demuestra aislamiento multi-tenant completo. Cada query, mutation, recurso y ruta administrativa requiere auditoría de autorización por tenant.
5. Alertmanager tiene un receptor local vacío. Para notificaciones reales se debe configurar un canal (email, Slack, PagerDuty, etc.).
6. El backup se conserva en el mismo host. Para recuperación ante pérdida del servidor, copiar backups cifrados a almacenamiento externo y probar restauraciones periódicas.
7. Nginx sirve HTTP en el puerto 80. En producción, terminar TLS en un proxy/CDN de confianza o añadir certificados y configuración HTTPS antes de exponer tráfico público.

## Puesta en marcha

1. Copiar `.env.example` a `.env`.
2. Reemplazar todos los valores `REPLACE...` y configurar `APP_ID`, `APP_SECRET`, `KIMI_AUTH_URL`, `KIMI_OPEN_URL`.
3. Utilizar contraseñas URL-safe para `MYSQL_PASSWORD`, porque `DATABASE_URL` se construye desde esas variables en Compose.
4. Ejecutar:

```bash
docker compose config
docker compose build app
docker compose up -d
docker compose ps
```

5. Verificar:

```bash
curl -fsS http://localhost/health/live
curl -fsS http://localhost/health/ready
```

6. Activar backups:

```bash
docker compose --profile backup up -d db-backup
```

## Acceso a monitorización

- Grafana: `http://127.0.0.1:3001`
- Prometheus: `http://127.0.0.1:9090`
- Alertmanager: `http://127.0.0.1:9093`

Los tres quedan limitados a loopback. Para administrarlos remotamente, utilizar un túnel SSH o un VPN; no publicar estos puertos directamente.

## Comandos operativos

```bash
docker compose logs -f app
docker compose logs -f mysql
docker compose exec mysql sh
docker compose down
```

`docker compose down` conserva los volúmenes. No utilizar `docker compose down -v` en producción porque elimina los volúmenes persistentes.

## Criterios de aceptación pendientes

- Ejecutar `docker compose config` en el host destino.
- Construir la imagen y ejecutar pruebas de arranque.
- Verificar `health/live` y `health/ready`.
- Ejecutar backup y restaurar en una base aislada.
- Validar TLS, firewall, rotación de secretos y copias off-host.
- Implementar y probar worker real, idempotencia y recuperación de jobs.
- Auditar aislamiento multi-tenant por endpoint y prueba cruzada entre dos tenants.
- Configurar un receptor real de Alertmanager.
