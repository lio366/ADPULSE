# Automática Business — aplicación

Frontend React 19 + Vite + Tailwind; backend Hono + tRPC; Drizzle ORM con MySQL2.

## Requisitos

- Node.js 22
- npm compatible con el `package-lock.json`
- MySQL 8.4 para desarrollo local
- Docker y Docker Compose para despliegue integrado

## Desarrollo local

```bash
npm ci
cp ../.env.example .env
# Ajustar DATABASE_URL y credenciales de la plataforma en .env
npm run dev
```

La aplicación Vite sirve el frontend y el backend Hono en modo desarrollo.

## Verificación y build

```bash
npm run check
npm run lint
npm test
npm run build
```

## Producción con Docker

La configuración de despliegue se encuentra en la raíz del repositorio:

- `docker-compose.yml`
- `app/Dockerfile`
- `.env.example`
- `infra/`

Consulta `../DEPLOYMENT.md` para configuración de secretos, backups, monitorización y límites conocidos.

## Notas de arquitectura

- La persistencia actual es MySQL; no se cambió a PostgreSQL.
- `ownerId` existe en las tablas de negocio, pero debe verificarse la autorización tenant-by-tenant en cada procedimiento.
- Redis cache y Redis queue se provisionan por Compose. El código actual aún no implementa consumidores de cola ni usa esos endpoints.
- El almacenamiento de archivos existente utiliza el SDK de plataforma en `api/lib/storage.ts`; no sustituirlo por un bucket alternativo sin migración explícita.

## Production release gate

Go-Live is fail-closed and requires verified evidence for all ten release checks. Run `npm run release:gate -- --version <release> --commit <full-commit-sha>`. Missing or invalid evidence blocks release. See `release-evidence/README.md` for the manifest format. A GO result is necessary but does not authorize deployment; explicit human approval remains required.
