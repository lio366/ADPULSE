# Infraestructura — estado de integración

| Capacidad | Estado en este paquete |
|---|---|
| Hono API en Docker | Integrada en configuración |
| MySQL persistente | Integrada |
| Redis caché | Provisionado |
| Redis broker durable | Provisionado; aún sin consumidor |
| Worker/scheduler | No existe implementación en el código fuente |
| Nginx reverse proxy | Integrado |
| Health liveness/readiness | Integrado; readiness consulta MySQL |
| Prometheus | Integrado |
| Grafana | Integrado con datasource |
| Alertmanager | Integrado; falta receptor externo |
| Backups diarios MySQL | Script y servicio Compose bajo profile |
| Backup off-host cifrado | Pendiente |
| TLS público | Pendiente de certificados/proxy externo |
| Aislamiento multi-tenant probado | Pendiente |
| Stripe / ledger financiero | No incorporado en este paquete |
| Recuperación completa probada | Pendiente de ejecutar en infraestructura destino |

No interpretar "integrado" como "desplegado y probado". Este paquete contiene configuración y código fuente; la validación final requiere Docker en el servidor objetivo y credenciales reales.
