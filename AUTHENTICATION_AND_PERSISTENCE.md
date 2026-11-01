# Autenticación y persistencia local

La autenticación local usa MySQL, contraseñas derivadas con scrypt y JWT HS256 de 15 minutos en una cookie `HttpOnly`, `SameSite=Strict`. No hay registro público. El primer usuario se crea desde una terminal de confianza.

## Preparación

1. Configura `DATABASE_URL` para una instancia MySQL 8 y genera un secreto independiente para `ADPULSE_AUTH_JWT_SECRET`. Puedes producir uno localmente con `openssl rand -base64 48`; no compartas ni confirmes su valor en Git.
2. Ejecuta `npm run db:migrate:local-auth` contra la base prevista. La migración sólo crea las tablas de autenticación; no elimina datos.
3. Crea la primera cuenta. Escribe la contraseña en el prompt oculto, no en la línea de comandos:

```bash
read -rsp 'Contraseña inicial: ' AUTH_PASSWORD; printf '\n'
export AUTH_PASSWORD AUTH_EMAIL='admin@example.com' AUTH_NAME='Administrador' AUTH_TENANT_KEY='*' AUTH_ROLE='platform_admin'
npm run auth:create-user
unset AUTH_PASSWORD AUTH_EMAIL AUTH_NAME AUTH_TENANT_KEY AUTH_ROLE
```

Para un usuario de tenant utiliza `AUTH_TENANT_KEY=tenant-autofix`, `tenant-ruta-24` o `tenant-moto-verde` y un rol `owner`, `admin`, `operator` o `viewer`. El rol `platform_admin` requiere `AUTH_TENANT_KEY=*`.

4. Inicia el servidor con `DATABASE_URL`, `ADPULSE_AUTH_JWT_SECRET` y `NODE_ENV=production`. La UI solicitará sesión y enviará automáticamente una cookie HttpOnly/Secure de hasta 8 horas; cerrar sesión elimina la cookie.

Sin base o secreto válido, login falla cerrado con HTTP 503. No se debe compartir una URL de base que contenga contraseña ni copiar la cookie/JWT a logs.

## Datos de negocio

La autenticación y memberships quedan en MySQL. La cola local y la auditoría JSONL actuales sobreviven reinicios del mismo volumen, pero aún no son almacenamiento multi-instancia. Los datos del dashboard y varios tenants siguen siendo fixtures en memoria; conectarlos a `crm_leads`, `deals`, `tenant_subscriptions`, `tenant_invoices` y `audit_logs` requiere `DATABASE_URL`, migración verificada y reemplazar las rutas estáticas antes de considerarlos datos de producción.