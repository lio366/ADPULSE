export const AREA_IDS = [
  "marketing", "sales", "support", "commerce", "finance",
  "treasury", "inventory", "operations", "people", "legal",
  "technology", "ai", "management", "loyalty", "expansion",
  "product", "quality", "risk", "continuity", "security",
] as const;

export type AreaId = (typeof AREA_IDS)[number];
export type AreaGroup = "Ingresos" | "Operación" | "Control" | "Crecimiento";

export interface BusinessArea {
  id: AreaId;
  number: string;
  name: string;
  shortName: string;
  agent: string;
  group: AreaGroup;
  mission: string;
  capabilities: [string, string, string];
  action: string;
}

export const BUSINESS_AREAS: BusinessArea[] = [
  { id: "marketing", number: "01", name: "Marketing y publicidad", shortName: "Marketing", agent: "PUBLICISTA", group: "Ingresos", mission: "Campañas, posicionamiento y captación medible de clientes.", capabilities: ["Plan de campañas y contenidos", "Control de inversión y solicitudes", "Preparación de variantes para aprobar"], action: "Preparar campaña" },
  { id: "sales", number: "02", name: "Ventas y CRM", shortName: "Ventas", agent: "VENDEDOR", group: "Ingresos", mission: "Prospectos, cotizaciones, seguimiento y cierres sin olvidos.", capabilities: ["Historial comercial de cada cliente", "Próxima acción y seguimiento", "Estimados vinculados al cliente"], action: "Registrar cliente" },
  { id: "support", number: "03", name: "Atención al cliente", shortName: "Atención", agent: "SECRETARÍA", group: "Ingresos", mission: "Recepción, consultas, soporte y reclamaciones organizadas.", capabilities: ["Bandeja de solicitudes internas", "Respuestas preparadas para revisión", "Escalado de casos sensibles"], action: "Crear seguimiento" },
  { id: "commerce", number: "04", name: "Comercio y contratación", shortName: "Contratación", agent: "GESTOR COMERCIAL", group: "Ingresos", mission: "Pedidos, contratos y acuerdos con condiciones visibles.", capabilities: ["Registro de acuerdos", "Estado de contratación", "Aprobación de condiciones"], action: "Registrar acuerdo" },
  { id: "finance", number: "05", name: "Finanzas y contabilidad", shortName: "Finanzas", agent: "ECONOMISTA", group: "Control", mission: "Ingresos, gastos, presupuestos e impuestos bajo control.", capabilities: ["Libro de ingresos y gastos", "Balance y margen operativo", "Categorías para revisión contable"], action: "Registrar movimiento" },
  { id: "treasury", number: "06", name: "Pagos y tesorería", shortName: "Tesorería", agent: "TESORERO", group: "Control", mission: "Cobros, facturación, suscripciones y flujo de caja.", capabilities: ["Previsión de efectivo disponible", "Seguimiento de saldos", "Solicitudes de cobro con aprobación"], action: "Revisar efectivo" },
  { id: "inventory", number: "07", name: "Inventario y compras", shortName: "Inventario", agent: "ALMACENISTA", group: "Operación", mission: "Existencias, proveedores y reposición antes de quedarse sin productos o materiales.", capabilities: ["Stock y mínimos por artículo", "Costo y proveedor", "Alertas y solicitudes de reposición"], action: "Añadir artículo" },
  { id: "operations", number: "08", name: "Operaciones y logística", shortName: "Operaciones", agent: "COORDINADOR", group: "Operación", mission: "Servicios, tareas, prioridades y entregas en una sola cola.", capabilities: ["Órdenes y estados de trabajo", "Asignación de responsables", "Fechas y prioridades"], action: "Crear trabajo" },
  { id: "people", number: "09", name: "Recursos humanos", shortName: "Equipo", agent: "GESTOR DE EQUIPO", group: "Operación", mission: "Selección, contratación, nóminas y desempeño del equipo.", capabilities: ["Plan de funciones y responsabilidades", "Seguimiento de desempeño", "Tareas de incorporación"], action: "Planificar equipo" },
  { id: "legal", number: "10", name: "Legal y cumplimiento", shortName: "Legal", agent: "COMPLIANCE", group: "Control", mission: "Licencias, permisos, contratos y obligaciones con revisión profesional.", capabilities: ["Calendario de obligaciones", "Control documental", "Escalado a profesional humano"], action: "Crear revisión" },
  { id: "technology", number: "11", name: "Tecnología e infraestructura", shortName: "Tecnología", agent: "INGENIERO", group: "Control", mission: "Sistemas, aplicaciones y mantenimiento de la operación digital.", capabilities: ["Estado de módulos internos", "Registro de incidencias", "Mantenimiento planificado"], action: "Reportar incidencia" },
  { id: "ai", number: "12", name: "Inteligencia artificial", shortName: "IA", agent: "ANALISTA IA", group: "Crecimiento", mission: "Análisis y recomendaciones; las decisiones sensibles siguen supervisadas.", capabilities: ["Lectura de indicadores reales", "Detección de patrones", "Planes convertidos en tareas"], action: "Analizar negocio" },
  { id: "management", number: "13", name: "Dirección y gestión empresarial", shortName: "Dirección", agent: "DIRECTOR GENERAL", group: "Control", mission: "Objetivos, indicadores, prioridades y control de todo el negocio.", capabilities: ["Panel diario del propietario", "Coordinación de los 20 agentes", "Aprobaciones y auditoría"], action: "Dar una orden" },
  { id: "loyalty", number: "14", name: "Fidelización y crecimiento", shortName: "Fidelización", agent: "RELACIONES", group: "Crecimiento", mission: "Satisfacción, retención, recomendaciones y reactivación.", capabilities: ["Seguimiento posterior al servicio", "Listas de reactivación", "Preparación de solicitudes de reseña"], action: "Programar seguimiento" },
  { id: "expansion", number: "15", name: "Expansión y nuevas oportunidades", shortName: "Expansión", agent: "DESARROLLO", group: "Crecimiento", mission: "Nuevos mercados, sucursales y alianzas con análisis previo.", capabilities: ["Evaluación de oportunidades", "Tareas de validación", "Control de hipótesis y costos"], action: "Evaluar oportunidad" },
  { id: "product", number: "16", name: "Desarrollo de productos y servicios", shortName: "Innovación", agent: "INNOVADOR", group: "Crecimiento", mission: "Innovación, diseño y mejora continua de la oferta.", capabilities: ["Registro de ideas", "Pruebas y versiones", "Mejoras priorizadas por impacto"], action: "Registrar iniciativa" },
  { id: "quality", number: "17", name: "Calidad", shortName: "Calidad", agent: "INSPECTOR", group: "Operación", mission: "Inspecciones, controles, estándares y corrección de errores.", capabilities: ["Listas de inspección", "Incidencias y correcciones", "Evidencia vinculada al trabajo"], action: "Crear inspección" },
  { id: "risk", number: "18", name: "Gestión de riesgos", shortName: "Riesgos", agent: "GUARDIÁN", group: "Control", mission: "Prevención de fraudes, pérdidas y contingencias operativas.", capabilities: ["Alertas por límites y anomalías", "Controles antes de ejecutar", "Registro de decisiones"], action: "Revisar riesgos" },
  { id: "continuity", number: "19", name: "Continuidad del negocio", shortName: "Continuidad", agent: "RESILIENCIA", group: "Control", mission: "Recuperación ante fallos y operaciones de emergencia.", capabilities: ["Planes de contingencia", "Responsables y pasos de recuperación", "Pruebas programadas"], action: "Preparar contingencia" },
  { id: "security", number: "20", name: "Datos y ciberseguridad", shortName: "Seguridad", agent: "CUSTODIO", group: "Control", mission: "Privacidad, permisos, protección y trazabilidad de la información.", capabilities: ["Acceso administrativo protegido", "Archivos con propietario", "Historial de actividad del sistema"], action: "Revisar accesos" },
];

export const areaById = (id: AreaId) => BUSINESS_AREAS.find((area) => area.id === id)!;

export const AREA_FUNCTIONS: Record<AreaId, string[]> = {
  marketing: ["Publicidad y campañas", "Redes sociales y contenido", "SEO y posicionamiento", "Captación y segmentación", "CAC y conversión"],
  sales: ["Clasificación de prospectos", "Seguimiento automático", "Presentación de servicios", "Cotizaciones y negociación asistida", "Cierre y recuperación"],
  support: ["Recepción de solicitudes 24/7", "Chat, correo, WhatsApp y voz por integrar", "Preguntas frecuentes", "Citas, reclamaciones y tickets", "Escalamiento humano"],
  commerce: ["Catálogo de productos y servicios", "Pedidos y contratos", "Carrito y checkout por integrar", "Descuentos autorizados", "Renovaciones y cancelaciones"],
  finance: ["Facturación y cuentas por cobrar", "Cuentas por pagar", "Conciliación bancaria por integrar", "Flujo de caja y presupuestos", "Gastos, rentabilidad e información fiscal"],
  treasury: ["Cobros recurrentes", "Pagos a proveedores", "Reembolsos e impagos", "Liquidez y alertas de fraude", "Autorización humana de pagos"],
  inventory: ["Existencias en tiempo real", "Predicción de demanda", "Reposición y órdenes de compra", "Comparación de proveedores", "Pérdidas y caducidad"],
  operations: ["Pedidos y tareas", "Entregas y rutas", "Programación de servicios", "Control de calidad", "Incidencias y resolución"],
  people: ["Reclutamiento e incorporación", "Horarios y asistencia", "Nómina con proveedor autorizado", "Formación y desempeño", "Permisos del equipo"],
  legal: ["Contratos y consentimientos", "Protección de datos", "Retención documental", "Licencias y vencimientos", "Auditorías y revisión jurídica"],
  technology: ["Aplicaciones e integraciones", "Monitoreo de servicios", "Copias de seguridad", "Recuperación y mantenimiento", "Incidencias técnicas"],
  ai: ["Análisis y predicción", "Detección de anomalías", "Recomendaciones comerciales", "Optimización de costos", "Planificación y ejecución controlada"],
  management: ["Indicadores KPI", "Rentabilidad por producto y cliente", "Objetivos y resultados", "Control de departamentos", "Informes y desviaciones"],
  loyalty: ["Fidelidad y recompra", "Encuestas de satisfacción", "Recuperación de clientes", "Referidos", "Venta cruzada y ampliación"],
  expansion: ["Investigación de mercados", "Nichos y competencia", "Nuevos productos", "Sucursales", "Alianzas comerciales"],
  product: ["Ideas y priorización", "Diseño de servicios", "Pruebas controladas", "Versiones y mejoras", "Validación con clientes"],
  quality: ["Listas de inspección", "Estándares de servicio", "No conformidades", "Acciones correctivas", "Evidencia de calidad"],
  risk: ["Mapa de riesgos", "Alertas y anomalías", "Controles preventivos", "Fraude y pérdidas", "Decisiones documentadas"],
  continuity: ["Planes de contingencia", "Responsables de recuperación", "Copias y restauración", "Pruebas programadas", "Operación de emergencia"],
  security: ["Cuentas y permisos", "Aislamiento de datos", "Archivos privados", "Auditoría de actividad", "Revisión de accesos"],
};

export const RECORD_KINDS = [
  "campaign", "content", "lead", "ticket", "appointment", "service_request",
  "catalog_item", "order", "contract", "invoice", "payment", "purchase",
  "supplier", "delivery", "employee", "legal_document", "license", "incident",
  "backup", "forecast", "kpi", "survey", "referral", "opportunity", "product",
  "inspection", "risk", "continuity", "access_review",
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
export const RECORD_KIND_LABELS: Record<RecordKind, string> = {
  campaign: "Campaña", content: "Contenido", lead: "Prospecto", ticket: "Ticket",
  appointment: "Cita", service_request: "Solicitud de servicio", catalog_item: "Servicio del catálogo",
  order: "Pedido", contract: "Contrato", invoice: "Factura", payment: "Pago o cobro",
  purchase: "Orden de compra", supplier: "Proveedor", delivery: "Entrega o ruta",
  employee: "Equipo", legal_document: "Documento legal", license: "Licencia",
  incident: "Incidencia", backup: "Copia o recuperación", forecast: "Análisis o predicción",
  kpi: "Objetivo o KPI", survey: "Encuesta", referral: "Referido", opportunity: "Oportunidad",
  product: "Producto o servicio", inspection: "Inspección", risk: "Riesgo",
  continuity: "Continuidad", access_review: "Revisión de acceso",
};
export const AREA_RECORD_KINDS: Record<AreaId, RecordKind[]> = {
  marketing: ["campaign", "content", "lead"], sales: ["lead", "order"],
  support: ["ticket", "appointment", "service_request"], commerce: ["catalog_item", "order", "contract"],
  finance: ["invoice", "kpi"], treasury: ["payment", "invoice"],
  inventory: ["purchase", "supplier"], operations: ["order", "delivery", "incident"],
  people: ["employee"], legal: ["legal_document", "license"],
  technology: ["incident", "backup"], ai: ["forecast"], management: ["kpi"],
  loyalty: ["survey", "referral"], expansion: ["opportunity"], product: ["product"],
  quality: ["inspection", "incident"], risk: ["risk"], continuity: ["continuity", "backup"],
  security: ["access_review", "incident"],
};
export const RECORD_STATUSES = ["pending", "requested", "confirmed", "progress", "sent", "approved", "done", "cancelled", "rejected"] as const;
export const RECORD_STATUS_LABELS: Record<(typeof RECORD_STATUSES)[number], string> = {
  pending: "Pendiente", requested: "Por revisar", confirmed: "Confirmado", progress: "En curso",
  sent: "Enviado", approved: "Autorizado", done: "Completado", cancelled: "Cancelado", rejected: "Rechazado",
};
export const AUTONOMY_LEVELS = ["manual", "assisted", "autonomous"] as const;
export const AUTOMATION_MODES = ["off", "assisted", "autonomous"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];
export const AUTOMATION_MODE_LABELS: Record<AutomationMode, string> = {
  off: "Apagada",
  assisted: "Supervisada",
  autonomous: "Autónoma",
};

export const TASK_STATUSES = ["pending", "progress", "approval", "done", "rejected"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const MEDIA_CATEGORIES = ["job", "customer", "marketing", "document", "other"] as const;
