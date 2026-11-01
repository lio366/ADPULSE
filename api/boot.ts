import { Hono, type Context } from "hono";
import { serve } from "@hono/node-server";
import { parse as parseCookies, serialize as serializeCookie } from "cookie";
import { Queue, Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { authenticateCredentials, createAccessToken, isAuthConfigured, readAuthStoreHealth, verifyAccessToken } from "./auth";

const app = new Hono();
const AUTH_COOKIE_NAME = "adpulse_session";
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const tenantDirectory = {
  "Autofix Center": {
    name: "Autofix Center",
    plan: "Pro",
    region: "Florida",
    seats: 24,
    status: "Activa",
    owner: "Alex Moreno",
    spend: "$12.4k/mes",
    security: "Alta",
    retention: "94%",
    risk: "Bajo",
    permissions: ["Admin", "Operador", "Ventas", "Cliente"],
  },
  "Ruta 24": {
    name: "Ruta 24",
    plan: "Scale",
    region: "Texas",
    seats: 18,
    status: "Activa",
    owner: "Sofia Duran",
    spend: "$8.7k/mes",
    security: "Media",
    retention: "91%",
    risk: "Medio",
    permissions: ["Admin", "Operador", "Ventas"],
  },
  "Moto Verde": {
    name: "Moto Verde",
    plan: "Starter",
    region: "Georgia",
    seats: 8,
    status: "Pendiente",
    owner: "Luis Ortega",
    spend: "$4.3k/mes",
    security: "Baja",
    retention: "87%",
    risk: "Alto",
    permissions: ["Admin", "Cliente"],
  },
};

const billingDirectory = {
  "Autofix Center": {
    tenantName: "Autofix Center",
    plan: "Pro",
    status: "Pagado",
    nextInvoice: "2026-11-28",
    amount: "$12.4k",
    seatsInUse: 22,
    seatsIncluded: 24,
    renewal: "Automática",
    paymentMethod: "Visa **** 4821",
    arr: "$148.8k",
    health: "Muy buena",
  },
  "Ruta 24": {
    tenantName: "Ruta 24",
    plan: "Scale",
    status: "Pagado",
    nextInvoice: "2026-11-24",
    amount: "$8.7k",
    seatsInUse: 16,
    seatsIncluded: 18,
    renewal: "Automática",
    paymentMethod: "Mastercard **** 2041",
    arr: "$104.4k",
    health: "Buena",
  },
  "Moto Verde": {
    tenantName: "Moto Verde",
    plan: "Starter",
    status: "Pendiente",
    nextInvoice: "2026-11-18",
    amount: "$4.3k",
    seatsInUse: 7,
    seatsIncluded: 8,
    renewal: "Manual",
    paymentMethod: "PayPal",
    arr: "$51.6k",
    health: "Atención",
  },
};

const rbacDirectory = {
  "Autofix Center": {
    tenantName: "Autofix Center",
    policy: "RBAC_CORE_V3",
    roles: [
      { name: "Owner", permissions: ["tenant.manage", "billing.write", "security.audit"] },
      { name: "Admin", permissions: ["dashboard.read", "automation.execute", "customer.manage"] },
      { name: "Operador", permissions: ["campaign.run", "task.assign", "alerts.read"] },
      { name: "Cliente", permissions: ["portal.read", "report.view"] },
    ],
    members: [
      { name: "Alex Moreno", role: "Owner", status: "Activo" },
      { name: "Sofía Cruz", role: "Admin", status: "Activo" },
      { name: "Mateo Ruiz", role: "Operador", status: "Activo" },
      { name: "Cliente Portal", role: "Cliente", status: "Activo" },
    ],
    scope: ["dashboard", "lead-flow", "billing", "audit"],
  },
  "Ruta 24": {
    tenantName: "Ruta 24",
    policy: "RBAC_STANDARD_V2",
    roles: [
      { name: "Owner", permissions: ["tenant.manage", "billing.write"] },
      { name: "Admin", permissions: ["dashboard.read", "customer.manage"] },
      { name: "Ventas", permissions: ["crm.read", "campaign.run"] },
    ],
    members: [
      { name: "Sofia Duran", role: "Owner", status: "Activo" },
      { name: "Lucía Rojas", role: "Admin", status: "Activo" },
      { name: "Pedro Mena", role: "Ventas", status: "Activo" },
    ],
    scope: ["dashboard", "crm", "campaigns"],
  },
  "Moto Verde": {
    tenantName: "Moto Verde",
    policy: "RBAC_GUARD_V1",
    roles: [
      { name: "Owner", permissions: ["tenant.manage"] },
      { name: "Admin", permissions: ["dashboard.read"] },
      { name: "Cliente", permissions: ["portal.read"] },
    ],
    members: [
      { name: "Luis Ortega", role: "Owner", status: "Pendiente" },
      { name: "Andrea López", role: "Admin", status: "Pendiente" },
      { name: "Cliente Moto", role: "Cliente", status: "Activo" },
    ],
    scope: ["portal", "dashboard"],
  },
};

const onboardingDirectory = {
  "Autofix Center": {
    tenantName: "Autofix Center",
    status: "Activación 72%",
    owner: "Alex Moreno",
    nextMilestone: "Integración del CRM y automatizaciones",
    checklist: [
      { task: "Conectar CRM y fuentes de leads", done: true },
      { task: "Configurar campañas automáticas", done: true },
      { task: "Definir flujos de aprobación", done: true },
      { task: "Invitar usuarios y roles", done: true },
      { task: "Probar renovación y alertas", done: false },
      { task: "Launch final con KPI dashboard", done: false },
    ],
    owners: [
      { name: "Alex Moreno", role: "Owner" },
      { name: "Sofía Cruz", role: "Admin" },
      { name: "Mateo Ruiz", role: "Operador" },
    ],
    eta: "3 días hábiles",
  },
  "Ruta 24": {
    tenantName: "Ruta 24",
    status: "Activación 58%",
    owner: "Sofia Duran",
    nextMilestone: "Validar campañas locales y lead routing",
    checklist: [
      { task: "Conectar CRM y fuentes de leads", done: true },
      { task: "Configurar campañas automáticas", done: true },
      { task: "Definir flujos de aprobación", done: false },
      { task: "Invitar usuarios y roles", done: false },
      { task: "Probar renovación y alertas", done: false },
      { task: "Launch final con KPI dashboard", done: false },
    ],
    owners: [
      { name: "Sofia Duran", role: "Owner" },
      { name: "Lucía Rojas", role: "Admin" },
    ],
    eta: "5 días hábiles",
  },
  "Moto Verde": {
    tenantName: "Moto Verde",
    status: "Activación 34%",
    owner: "Luis Ortega",
    nextMilestone: "Completar primer onboarding de portal y permisos",
    checklist: [
      { task: "Conectar CRM y fuentes de leads", done: false },
      { task: "Configurar campañas automáticas", done: false },
      { task: "Definir flujos de aprobación", done: false },
      { task: "Invitar usuarios y roles", done: true },
      { task: "Probar renovación y alertas", done: false },
      { task: "Launch final con KPI dashboard", done: false },
    ],
    owners: [
      { name: "Luis Ortega", role: "Owner" },
      { name: "Andrea López", role: "Admin" },
    ],
    eta: "6 días hábiles",
  },
};

function loadDotEnvFile() {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile();

const ECO_IA_SERVICE_URL = process.env.ECO_IA_SERVICE_URL ?? "http://127.0.0.1:8001";

function normalizeAgentName(rawName: string) {
  const value = String(rawName ?? "").trim();
  if (!value) {
    return "EXPLORADOR";
  }

  const canonical = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const match = agentNetwork.agents.find((agent) => {
    const alias = agent.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
    return alias === canonical || agent.name.toUpperCase() === value.toUpperCase();
  });

  return match ? match.name : value.toUpperCase();
}

function readAccessToken(c: { req: { header: (name: string) => string | undefined } }) {
  const authorization = c.req.header("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) return authorization.slice(7).trim();
  const cookies = parseCookies(c.req.header("cookie") ?? "");
  return cookies[AUTH_COOKIE_NAME] ?? "";
}

async function resolveQueueWriteContext(c: { req: { header: (name: string) => string | undefined } }) {
  if (process.env.NODE_ENV === "production" || process.env.REQUIRE_AGENT_QUEUE_AUTH === "true") {
    const principal = await verifyAccessToken(readAccessToken(c));
    if (!principal) return { tenantId: "unknown", role: "anonymous", isAuthorized: false };

    return {
      tenantId: principal.tenantId,
      role: principal.role.toLowerCase(),
      isAuthorized: Boolean(principal.tenantId) && ["admin", "owner", "operator", "agent", "platform_admin"].includes(principal.role.toLowerCase()),
    };
  }

  const tenantId = c.req.header("x-tenant-id") ?? c.req.header("x-tenant") ?? "";
  const role = (c.req.header("x-user-role") ?? c.req.header("x-role") ?? "").toLowerCase();

  return {
    tenantId: tenantId || "unknown",
    role: role || "anonymous",
    isAuthorized: Boolean(tenantId) && ["admin", "owner", "operator", "agent"].includes(role),
  };
}

function isAuthorizedForTenant(access: { tenantId: string; role: string; isAuthorized: boolean }, tenantName: string) {
  if (!access.isAuthorized || process.env.NODE_ENV !== "production") return access.isAuthorized;
  if (access.role === "platform_admin") return true;

  const tenantIds: Record<string, string> = {
    "Autofix Center": "tenant-autofix",
    "Ruta 24": "tenant-ruta-24",
    "Moto Verde": "tenant-moto-verde",
  };
  return tenantIds[tenantName] === access.tenantId || tenantName === access.tenantId;
}

async function requireTenantAccess(c: Context, tenantName: string) {
  const required = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  if (!required) return null;

  const access = await resolveQueueWriteContext(c);
  if (!access.isAuthorized) {
    return c.json({ error: "Tenant access requires a valid signed token.", code: "AUTH_REQUIRED" }, 401);
  }
  if (!isAuthorizedForTenant(access, tenantName)) {
    return c.json({ error: "The authenticated user cannot access this tenant.", code: "TENANT_ACCESS_DENIED" }, 403);
  }
  return null;
}

async function requirePlatformAccess(c: Context) {
  const required = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  if (!required) return null;

  const access = await resolveQueueWriteContext(c);
  const isPlatformAdmin = access.isAuthorized && (process.env.NODE_ENV !== "production" || access.role === "platform_admin");
  if (!isPlatformAdmin) {
    return c.json({ error: "A platform administrator token is required.", code: "PLATFORM_AUTH_REQUIRED" }, 403);
  }
  return null;
}

async function executeEcoIaTask(jobId: string, task: string, recipient: string, sender: string) {
  const resolvedRecipient = normalizeAgentName(recipient);
  const response = await fetch(`${ECO_IA_SERVICE_URL}/agents/${encodeURIComponent(resolvedRecipient)}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job_id: jobId, task, source: sender }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`ECO-IA task dispatch failed (${response.status}): ${detail}`);
  }

  const result = await response.json() as { status?: string; agent?: string };
  if (result.status !== "processed") {
    throw new Error(`ECO-IA did not process job ${jobId}`);
  }

  return result;
}

async function readEcoIaRuntime() {
  try {
    const response = await fetch(`${ECO_IA_SERVICE_URL}/health`);
    if (!response.ok) {
      throw new Error("eco-ia unavailable");
    }
    const payload = await response.json() as { status?: string; service?: string; agents?: number };
    return {
      service: payload.service ?? "eco-ia",
      status: payload.status ?? "ok",
      agents: payload.agents ?? 0,
      source: ECO_IA_SERVICE_URL,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return {
      service: "eco-ia",
      status: "offline",
      agents: 0,
      source: ECO_IA_SERVICE_URL,
      lastUpdated: new Date().toISOString(),
    };
  }
}

const agentNetwork = {
  core: "ECO-IA",
  health: "Operativo 24/7",
  uptime: "99.98%",
  agents: [
    { name: "ECO-IA", role: "Núcleo privado", status: "online", load: "100%", focus: "orquestación" },
    { name: "EXPLORADOR", role: "Investigación", status: "online", load: "82%", focus: "signal tracking" },
    { name: "ESTRATEGA", role: "Planificación", status: "online", load: "74%", focus: "prioridad y hipótesis" },
    { name: "CREADOR", role: "Contenido", status: "online", load: "69%", focus: "variantes y mensajes" },
    { name: "DISTRIBUIDOR", role: "Ejecución", status: "online", load: "63%", focus: "canales y timing" },
    { name: "OPTIMIZADOR", role: "Rendimiento", status: "online", load: "71%", focus: "ROAS y ajustes" },
    { name: "GUARDIÁN", role: "Control y recuperación", status: "online", load: "58%", focus: "reglas y seguridad" },
  ],
  flows: [
    { from: "ECO-IA", to: "EXPLORADOR", message: "Recoge señales del mercado y competencia" },
    { from: "EXPLORADOR", to: "ESTRATEGA", message: "Entrega oportunidades priorizadas" },
    { from: "ESTRATEGA", to: "CREADOR", message: "Genera variaciones y mensajes" },
    { from: "CREADOR", to: "DISTRIBUIDOR", message: "Publica en canales y programaciones" },
    { from: "DISTRIBUIDOR", to: "OPTIMIZADOR", message: "Mide rendimiento y ajusta presupuesto" },
    { from: "OPTIMIZADOR", to: "GUARDIÁN", message: "Valida límites, riesgos y seguridad" },
    { from: "GUARDIÁN", to: "ECO-IA", message: "Sincroniza decisiones y recuperaciones" },
  ],
};

const queueStatePath = join(process.cwd(), ".data", "eco-ia-queue.json");
const auditLogPath = join(process.cwd(), ".data", "tenant-audit.jsonl");

const defaultQueueState = {
  core: "ECO-IA",
  queueName: "eco-ia-live-queue",
  cycle: 0,
  lastUpdated: new Date().toISOString(),
  jobs: [
    { id: "job-1041", from: "ECO-IA", to: "EXPLORADOR", task: "Detectar oportunidades de mercado", status: "running", lastMessage: "Signals collected from 8 sources." },
    { id: "job-1042", from: "EXPLORADOR", to: "ESTRATEGA", task: "Priorizar campaña local", status: "queued", lastMessage: "Hypothesis scored and budget ready." },
    { id: "job-1043", from: "ESTRATEGA", to: "CREADOR", task: "Generar variants A/B", status: "running", lastMessage: "Creative set approved with 3 variants." },
    { id: "job-1044", from: "CREADOR", to: "DISTRIBUIDOR", task: "Programar distribución", status: "queued", lastMessage: "Channels synchronized for next slot." },
    { id: "job-1045", from: "DISTRIBUIDOR", to: "OPTIMIZADOR", task: "Ajustar CPA y ROAS", status: "running", lastMessage: "Optimizing budget by channel." },
    { id: "job-1046", from: "OPTIMIZADOR", to: "GUARDIÁN", task: "Verificar compliance", status: "queued", lastMessage: "Reviewing guardrails and approvals." },
  ],
  handoffs: [
    { step: 1, from: "EXPLORADOR", to: "ESTRATEGA", summary: "Oportunidades priorizadas y presupuestadas" },
    { step: 2, from: "ESTRATEGA", to: "CREADOR", summary: "Mensaje, tono y runtime listos" },
    { step: 3, from: "CREADOR", to: "DISTRIBUIDOR", summary: "Activación de canales con timing" },
    { step: 4, from: "DISTRIBUIDOR", to: "OPTIMIZADOR", summary: "Métricas de rendimiento y ROAS" },
    { step: 5, from: "OPTIMIZADOR", to: "GUARDIÁN", summary: "Validación de reglas y riesgo" },
  ],
};

const agentQueueName = "adpulse-eco-ia";
const redisQueueUrl = process.env.REDIS_QUEUE_URL;

function parseRedisConnection(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_QUEUE_URL must use redis:// or rediss://");
  }

  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "rediss:" ? 6380 : 6379)),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    maxRetriesPerRequest: null,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

const redisQueueConnection = redisQueueUrl ? parseRedisConnection(redisQueueUrl) : null;
const durableAgentQueue = redisQueueConnection
  ? new Queue(agentQueueName, {
      connection: redisQueueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    })
  : null;
const agentQueueWorker = redisQueueConnection
  ? new Worker(
      agentQueueName,
      async (job) => {
        const result = await executeEcoIaTask(String(job.id), job.data.task, job.data.to, job.data.from);
        await job.updateData({
          ...job.data,
          lastMessage: `${result.agent} processed the task through ECO-IA.`,
          result,
        });
        return result;
      },
      { connection: redisQueueConnection, concurrency: 1 },
    )
  : null;

agentQueueWorker?.on("error", (error) => {
  console.error("ECO-IA durable queue worker error", error);
});

let durableQueueReady: Promise<void> | undefined;

async function ensureDurableQueueReady() {
  if (!durableAgentQueue) return;

  durableQueueReady ??= (async () => {
    await durableAgentQueue.waitUntilReady();
    const counts = await durableAgentQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    const jobCount = Object.values(counts).reduce((total, count) => total + count, 0);
    const existingState = readQueueState();

    if (jobCount === 0) {
      await Promise.all(existingState.jobs.map(({ status, ...job }) =>
        durableAgentQueue.add(job.task, job, { jobId: job.id }),
      ));
    }

  })();

  await durableQueueReady;
}

async function readDurableQueueState() {
  if (!durableAgentQueue) return readQueueState();
  await ensureDurableQueueReady();

  const jobs = await durableAgentQueue.getJobs(["waiting", "active", "completed", "failed", "delayed"], 0, 99, true);
  const mappedJobs = await Promise.all(jobs.map(async (job) => {
    const state = await job.getState();
    const status = state === "active" ? "running" : state === "completed" ? "completed" : state === "failed" ? "failed" : "queued";
    return { ...job.data, id: job.id ?? job.name, status };
  }));
  const counts = await durableAgentQueue.getJobCounts("completed");

  return {
    ...defaultQueueState,
    queueName: agentQueueName,
    cycle: counts.completed ?? 0,
    lastUpdated: new Date().toISOString(),
    jobs: mappedJobs,
  };
}

function ensureQueueStateFile() {
  const queueDir = join(process.cwd(), ".data");

  if (!existsSync(queueDir)) {
    mkdirSync(queueDir, { recursive: true });
  }

  if (!existsSync(queueStatePath)) {
    writeFileSync(queueStatePath, JSON.stringify(defaultQueueState, null, 2));
  }
}

function purgeResidualQueueJobs(state: typeof defaultQueueState) {
  const cleanedJobs = state.jobs.filter((job) => {
    if (job.status !== "failed") {
      return true;
    }

    return Boolean(job.result) || Boolean((job as { lastMessage?: string }).lastMessage && /processed the task through ECO-IA/i.test(String((job as { lastMessage?: string }).lastMessage)));
  });

  if (cleanedJobs.length === 0) {
    return {
      ...defaultQueueState,
      lastUpdated: new Date().toISOString(),
    };
  }

  return {
    ...state,
    jobs: cleanedJobs,
    lastUpdated: new Date().toISOString(),
  };
}

function readQueueState() {
  ensureQueueStateFile();

  try {
    const json = readFileSync(queueStatePath, "utf8");
    const parsed = JSON.parse(json) as typeof defaultQueueState;
    return purgeResidualQueueJobs(parsed);
  } catch {
    return purgeResidualQueueJobs(defaultQueueState);
  }
}

function persistQueueState(state: typeof defaultQueueState) {
  ensureQueueStateFile();
  const cleanedState = purgeResidualQueueJobs(state);
  writeFileSync(queueStatePath, JSON.stringify(cleanedState, null, 2));
  return cleanedState;
}

function ensureAuditLogFile() {
  const queueDir = join(process.cwd(), ".data");

  if (!existsSync(queueDir)) {
    mkdirSync(queueDir, { recursive: true });
  }

  if (!existsSync(auditLogPath)) {
    writeFileSync(auditLogPath, "", "utf8");
  }
}

function appendAuditEvent(event: Record<string, unknown>) {
  ensureAuditLogFile();
  const entry = {
    id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  return entry;
}

function readAuditEventsForTenant(tenantId: string) {
  ensureAuditLogFile();

  try {
    const lines = readFileSync(auditLogPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const events = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((event) => String(event.tenantId ?? "") === tenantId)
      .sort((a, b) => String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? "")));

    return events;
  } catch {
    return [] as Record<string, unknown>[];
  }
}

async function processLocalQueue(currentState: typeof defaultQueueState) {
  const queuedJob = currentState.jobs.find((job) => job.status === "queued");
  if (!queuedJob) return currentState;

  const runningState = persistQueueState({
    ...currentState,
    lastUpdated: new Date().toISOString(),
    jobs: currentState.jobs.map((job) => job.id === queuedJob.id ? { ...job, status: "running" } : job),
  });

  try {
    const result = await executeEcoIaTask(queuedJob.id, queuedJob.task, queuedJob.to, queuedJob.from);
    return persistQueueState({
      ...runningState,
      cycle: runningState.cycle + 1,
      lastUpdated: new Date().toISOString(),
      jobs: runningState.jobs.map((job) => job.id === queuedJob.id
        ? { ...job, status: "completed", lastMessage: `${result.agent} processed the task through ECO-IA.`, result }
        : job),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return persistQueueState({
      ...runningState,
      lastUpdated: new Date().toISOString(),
      jobs: runningState.jobs.map((job) => job.id === queuedJob.id
        ? { ...job, status: "failed", lastMessage: message }
        : job),
    });
  }
}

let agentQueue = readQueueState();

if (!durableAgentQueue) {
  const localQueueWorker = setInterval(() => {
    void processLocalQueue(readQueueState()).then((next) => {
      agentQueue = next;
    });
  }, 6000);
  localQueueWorker.unref();
}

const saasSnapshot = {
  summary: {
    leadsQualified: 1240,
    activeOpportunities: 184,
    automatedTasks: 96,
    roiEstimated: "3.8x",
  },
  modules: [
    {
      name: "Captación",
      status: "Autónoma",
      detail: "Campañas, anuncios y leads en curso",
      metric: "+38% demanda",
      tone: "cyan",
    },
    {
      name: "Comercial",
      status: "Sincronizada",
      detail: "CRM, seguimiento y cierre automatizado",
      metric: "42 oportunidades",
      tone: "blue",
    },
    {
      name: "Operación",
      status: "Ejecutando",
      detail: "Servicios, inventario y logística coordinados",
      metric: "96% SLA",
      tone: "green",
    },
    {
      name: "Gobernanza",
      status: "Protegida",
      detail: "Auditoría, seguridad y reglas de control",
      metric: "0 incidentes",
      tone: "amber",
    },
  ],
  pipeline: [
    { name: "AutoService Premium", stage: "Calificación", score: "92%", owner: "IA scout" },
    { name: "Mantenimiento flota", stage: "Negociación", score: "81%", owner: "CRM IA" },
    { name: "Campaña local", stage: "Ejecución", score: "74%", owner: "Operación" },
  ],
  actionQueue: [
    "Reactivar 18 leads con baja respuesta",
    "Ajustar presupuesto de Meta Ads por ROAS",
    "Reprogramar cita de cliente premium",
    "Validar inventario crítico antes del cierre",
  ],
  governance: [
    { label: "Revisión automática", value: "Cumplida" },
    { label: "Riesgos detectados", value: "2" },
    { label: "Aprobaciones", value: "5 pendientes" },
  ],
  customers: [
    { name: "Autofix Center", plan: "Pro", revenue: "$12.4k", health: "Muy buena" },
    { name: "Ruta 24", plan: "Scale", revenue: "$8.7k", health: "Buena" },
    { name: "Moto Verde", plan: "Starter", revenue: "$4.3k", health: "Atención" },
  ],
  automations: [
    { label: "Lead scoring", value: "Activa" },
    { label: "CRM follow-up", value: "Activa" },
    { label: "Asignación de tareas", value: "Activa" },
    { label: "Aprobaciones automáticas", value: "Supervisada" },
  ],
  tenants: [
    { name: "Autofix Center", plan: "Pro", region: "Florida", seats: 24, status: "Activa" },
    { name: "Ruta 24", plan: "Scale", region: "Texas", seats: 18, status: "Activa" },
    { name: "Moto Verde", plan: "Starter", region: "Georgia", seats: 8, status: "Pendiente" },
  ],
  roles: [
    { name: "Admin", description: "Control total del tenant" },
    { name: "Operador", description: "Gestión de flujo" },
    { name: "Ventas", description: "CRM y oportunidades" },
    { name: "Cliente", description: "Portal y seguimiento" },
  ],
};

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    status: "healthy",
    timestamp: Date.now(),
  }),
);

app.post("/api/auth/login", async (c) => {
  if (!isAuthConfigured()) {
    return c.json({ error: "Authentication storage is not configured.", code: "AUTH_UNAVAILABLE" }, 503);
  }

  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const tenantKey = typeof body.tenantId === "string" ? body.tenantId : "";
  if (email.length > 320 || password.length > 1024 || !email || !password || !tenantKey) {
    return c.json({ error: "Invalid email, password, or tenant." }, 400);
  }

  const now = Date.now();
  const attempts = loginAttempts.get(email);
  if (attempts && attempts.resetAt > now && attempts.count >= 10) {
    return c.json({ error: "Too many login attempts. Try again later." }, 429, { "retry-after": String(Math.ceil((attempts.resetAt - now) / 1000)) });
  }

  try {
    const account = await authenticateCredentials(email, password, tenantKey);
    if (!account) {
      const current = attempts && attempts.resetAt > now ? attempts : { count: 0, resetAt: now + 15 * 60 * 1000 };
      loginAttempts.set(email, { ...current, count: current.count + 1 });
      return c.json({ error: "Invalid email, password, or tenant." }, 401);
    }

    loginAttempts.delete(email);
    const token = await createAccessToken(account);
    c.header("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60,
    }));
    return c.json({
      user: { id: String(account.id), email: account.email, displayName: account.displayName },
      tenantId: account.role === "platform_admin" ? "platform" : account.tenantKey,
      role: account.role,
    });
  } catch {
    return c.json({ error: "Authentication service is temporarily unavailable.", code: "AUTH_UNAVAILABLE" }, 503);
  }
});

app.get("/api/auth/session", async (c) => {
  const principal = await verifyAccessToken(readAccessToken(c));
  if (!principal) return c.json({ error: "Authentication required.", code: "AUTH_REQUIRED" }, 401);
  return c.json({ user: { id: principal.id, email: principal.email, displayName: principal.displayName }, tenantId: principal.tenantId, role: principal.role });
});

app.post("/api/auth/logout", (c) => {
  c.header("Set-Cookie", serializeCookie(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  }));
  return c.json({ ok: true });
});

async function readPlatformHealth() {
  const ecoIaRuntime = await readEcoIaRuntime();
  const authStore = await readAuthStoreHealth();
  const queueState = durableAgentQueue ? await readDurableQueueState() : readQueueState();
  const queueMode = durableAgentQueue ? "redis" : "local-json";
  const failedJobs = queueState.jobs.filter((job) => job.status === "failed").length;
  const authRequired = process.env.NODE_ENV === "production" || process.env.REQUIRE_AGENT_QUEUE_AUTH === "true";
  const ready = ecoIaRuntime.status === "ok" && failedJobs === 0 && (!authRequired || authStore.reachable);

  return {
    ready,
    status: ready ? "healthy" : "degraded",
    timestamp: Date.now(),
    services: {
      app: {
        name: "adpulse",
        status: "healthy",
        healthy: true,
        nodeEnv: process.env.NODE_ENV ?? "development",
      },
      ecoIa: ecoIaRuntime,
      authStore: { ...authStore, required: authRequired },
      queue: {
        mode: queueMode,
        status: failedJobs > 0 ? "degraded" : "ready",
        healthy: failedJobs === 0,
        queueName: queueState.queueName,
        cycle: queueState.cycle,
        totalJobs: queueState.jobs.length,
        failedJobs,
      },
    },
  };
}

app.get("/api/saas/platform/health", async (c) => c.json(await readPlatformHealth()));

app.get("/api/saas/summary", async (c) => {
  const accessError = await requirePlatformAccess(c);
  if (accessError) return accessError;
  return c.json(saasSnapshot);
});

app.get("/api/saas/audit/tenant/:tenantId", async (c) => {
  const tenantId = decodeURIComponent(c.req.param("tenantId"));
  const accessError = await requireTenantAccess(c, tenantId);
  if (accessError) return accessError;
  const events = readAuditEventsForTenant(tenantId);

  return c.json({
    tenantId,
    count: events.length,
    events,
  });
});

app.get("/api/saas/tenant/:tenantName", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const accessError = await requireTenantAccess(c, tenantName);
  if (accessError) return accessError;
  const tenant = tenantDirectory[tenantName as keyof typeof tenantDirectory] ?? tenantDirectory["Autofix Center"];

  return c.json({
    tenant,
    access: {
      scope: tenant.plan,
      policies: ["tenant.isolation", "rbac.enforced", "audit.log.enabled"],
      lastSync: Date.now(),
    },
  });
});

app.get("/api/saas/billing/:tenantName", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const accessError = await requireTenantAccess(c, tenantName);
  if (accessError) return accessError;
  const billing = billingDirectory[tenantName as keyof typeof billingDirectory] ?? billingDirectory["Autofix Center"];

  return c.json({
    billing,
    invoice: {
      dueDate: billing.nextInvoice,
      total: billing.amount,
      method: billing.paymentMethod,
      autoRenew: billing.renewal,
    },
  });
});

app.get("/api/saas/rbac/:tenantName", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const accessError = await requireTenantAccess(c, tenantName);
  if (accessError) return accessError;
  const rbac = rbacDirectory[tenantName as keyof typeof rbacDirectory] ?? rbacDirectory["Autofix Center"];

  return c.json({
    rbac,
    policy: {
      tenantName: rbac.tenantName,
      mode: rbac.policy,
      sessionToken: "tenant-rbac-session",
      enforced: true,
    },
  });
});

app.get("/api/saas/onboarding/:tenantName", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const accessError = await requireTenantAccess(c, tenantName);
  if (accessError) return accessError;
  const onboarding = onboardingDirectory[tenantName as keyof typeof onboardingDirectory] ?? onboardingDirectory["Autofix Center"];

  return c.json({
    onboarding,
    progress: {
      complete: onboarding.checklist.filter((item) => item.done).length,
      total: onboarding.checklist.length,
      nextAction: onboarding.nextMilestone,
    },
  });
});

const businessWorkflowCatalog = {
  lead_follow_up: {
    id: "lead_follow_up",
    name: "Lead follow-up",
    owner: "EXPLORADOR",
    steps: ["qualify lead", "score intent", "assign owner", "send touchpoint"],
    sla: "2h",
  },
  renewal_management: {
    id: "renewal_management",
    name: "Renewal management",
    owner: "ESTRATEGA",
    steps: ["review usage", "evaluate risk", "prepare offer", "trigger renewal"],
    sla: "24h",
  },
  ops_rebalance: {
    id: "ops_rebalance",
    name: "Operations rebalance",
    owner: "DISTRIBUIDOR",
    steps: ["check backlog", "rebalance staff", "adjust timeline", "notify operations"],
    sla: "4h",
  },
};

const automationCatalog = [
  { id: "lead_follow_up", name: "Seguimiento de leads", description: "Clasificación, asignación y recordatorios de seguimiento.", connector: "CRM", monthlyPriceCents: 4900 },
  { id: "campaign_optimizer", name: "Optimización de campañas", description: "Revisión de rendimiento y propuestas de ajuste de campañas.", connector: "Ads", monthlyPriceCents: 12900 },
  { id: "renewal_alerts", name: "Alertas de renovación", description: "Detección de renovaciones próximas y avisos al equipo.", connector: "Billing", monthlyPriceCents: 3900 },
  { id: "operations_scheduling", name: "Programación operativa", description: "Priorización y programación de tareas operativas.", connector: "ERP", monthlyPriceCents: 8900 },
  { id: "notifications", name: "Notificaciones de clientes", description: "Avisos de eventos por los canales configurados.", connector: "Notifications", monthlyPriceCents: 2900 },
] as const;

type AutomationQuote = {
  id: string;
  tenantName: string;
  tenantId: string;
  status: "proposed" | "accepted" | "rejected";
  currency: "USD";
  monthlyTotalCents: number;
  items: Array<{
    id: string;
    name: string;
    description: string;
    connector: string;
    monthlyPriceCents: number;
  }>;
  activations: Array<{ automationId: string; status: "waiting_for_integration"; connector: string }>;
  createdAt: string;
  decidedAt: string | null;
};

function automationQuotesFilePath() {
  return process.env.AUTOMATION_QUOTES_PATH ?? join(process.cwd(), ".data", "automation-quotes.json");
}

function readAutomationQuotes(): AutomationQuote[] {
  const filePath = automationQuotesFilePath();
  const directory = join(filePath, "..");
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  if (!existsSync(filePath)) writeFileSync(filePath, "[]\n", "utf8");
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    return Array.isArray(parsed) ? parsed as AutomationQuote[] : [];
  } catch {
    return [];
  }
}

function writeAutomationQuotes(quotes: AutomationQuote[]) {
  const filePath = automationQuotesFilePath();
  const directory = join(filePath, "..");
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(quotes, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporaryPath, filePath);
}

app.get("/api/saas/automation/catalog", (c) => c.json({
  currency: "USD",
  billingPeriod: "monthly",
  automations: automationCatalog.map((item) => ({ ...item, monthlyPrice: item.monthlyPriceCents / 100 })),
}));

app.get("/api/saas/quotes/:tenantName", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const accessError = await requireTenantAccess(c, tenantName);
  if (accessError) return accessError;
  const quotes = readAutomationQuotes().filter((quote) => quote.tenantName === tenantName);
  return c.json({ tenantName, quotes });
});

app.post("/api/saas/quotes/:tenantName", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const tenant = tenantDirectory[tenantName as keyof typeof tenantDirectory];
  if (!tenant) return c.json({ error: "Unknown tenant." }, 404);
  const access = await resolveQueueWriteContext(c);
  const required = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  if (required && !access.isAuthorized) return c.json({ error: "Authentication required.", code: "AUTH_REQUIRED" }, 401);
  if (required && !isAuthorizedForTenant(access, tenantName)) return c.json({ error: "Tenant access denied.", code: "TENANT_ACCESS_DENIED" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const automationIds = body.automationIds;
  if (!Array.isArray(automationIds) || automationIds.length < 1 || automationIds.length > automationCatalog.length
    || automationIds.some((id: unknown) => typeof id !== "string")
    || new Set(automationIds).size !== automationIds.length) {
    return c.json({ error: "Select between one and five unique automations." }, 400);
  }

  const selectedItems = automationCatalog.filter((item) => automationIds.includes(item.id));
  if (selectedItems.length !== automationIds.length) return c.json({ error: "Unknown automation selected." }, 400);

  const quote: AutomationQuote = {
    id: randomUUID(),
    tenantName,
    tenantId: access.tenantId,
    status: "proposed",
    currency: "USD",
    monthlyTotalCents: selectedItems.reduce((total, item) => total + item.monthlyPriceCents, 0),
    items: selectedItems.map(({ id, name, description, connector, monthlyPriceCents }) => ({ id, name, description, connector, monthlyPriceCents })),
    activations: [],
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  writeAutomationQuotes([quote, ...readAutomationQuotes()]);
  appendAuditEvent({
    action: "automation_quote_created",
    tenantId: access.tenantId,
    role: access.role,
    resource: "automation-quote",
    resourceId: quote.id,
    summary: `Created automation proposal for ${tenantName}`,
    details: { automationIds: selectedItems.map((item) => item.id), monthlyTotalCents: quote.monthlyTotalCents },
  });
  return c.json({ quote }, 201);
});

app.post("/api/saas/quotes/:tenantName/:quoteId/decision", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const access = await resolveQueueWriteContext(c);
  const required = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  if (required && !access.isAuthorized) return c.json({ error: "Authentication required.", code: "AUTH_REQUIRED" }, 401);
  if (required && !isAuthorizedForTenant(access, tenantName)) return c.json({ error: "Tenant access denied.", code: "TENANT_ACCESS_DENIED" }, 403);

  const body = await c.req.json().catch(() => ({}));
  if (body.decision !== "accepted" && body.decision !== "rejected") {
    return c.json({ error: "Decision must be accepted or rejected." }, 400);
  }

  const quotes = readAutomationQuotes();
  const quoteIndex = quotes.findIndex((quote) => quote.id === c.req.param("quoteId") && quote.tenantName === tenantName);
  if (quoteIndex < 0) return c.json({ error: "Quote not found." }, 404);
  if (quotes[quoteIndex].status !== "proposed") return c.json({ error: "This quote already has a decision.", code: "QUOTE_ALREADY_DECIDED" }, 409);

  const decision = body.decision as "accepted" | "rejected";
  const quote: AutomationQuote = {
    ...quotes[quoteIndex],
    status: decision,
    decidedAt: new Date().toISOString(),
    activations: decision === "accepted"
      ? quotes[quoteIndex].items.map((item) => ({ automationId: item.id, connector: item.connector, status: "waiting_for_integration" }))
      : [],
  };
  quotes[quoteIndex] = quote;
  writeAutomationQuotes(quotes);
  appendAuditEvent({
    action: `automation_quote_${decision}`,
    tenantId: access.tenantId,
    role: access.role,
    resource: "automation-quote",
    resourceId: quote.id,
    summary: `${decision} automation proposal for ${tenantName}`,
    details: { automationIds: quote.items.map((item) => item.id), monthlyTotalCents: quote.monthlyTotalCents },
  });
  return c.json({ quote, message: decision === "accepted"
    ? "Consent recorded. Activations wait for verified provider integrations."
    : "Proposal declined; no automation was activated." });
});

const connectorRegistry = [
  { name: "CRM", owner: "Sales automation", envKeys: ["CRM_API_KEY", "CRM_BASE_URL", "CRM_WEBHOOK_URL"] },
  { name: "Ads", owner: "Marketing automation", envKeys: ["ADS_API_KEY", "META_ADS_TOKEN", "ADS_ACCOUNT_ID"] },
  { name: "ERP", owner: "Operations", envKeys: ["ERP_API_URL", "ERP_API_KEY", "ERP_CLIENT_ID"] },
  { name: "Billing", owner: "Finance", envKeys: ["BILLING_API_KEY", "STRIPE_SECRET_KEY", "BILLING_API_URL"] },
  { name: "Notifications", owner: "Lifecycle", envKeys: ["NOTIFY_API_KEY", "SLACK_WEBHOOK_URL", "RESEND_API_KEY"] },
] as const;

function isConfiguredProviderValue(value: string | undefined) {
  return Boolean(value?.trim()) && !/(replace-with|your[-_.]|example\.com|REPLACE\/THIS)/i.test(value ?? "");
}

function readConnectorState() {
  return connectorRegistry.map((connector) => {
    const configured = connector.envKeys.every((key) => isConfiguredProviderValue(process.env[key]));

    return {
      name: connector.name,
      status: configured ? "configured" : "pending",
      owner: connector.owner,
      lastSync: null,
      latency: "n/a",
      configured,
      ready: false,
      detail: configured
        ? "Configuration detected; live adapter and connectivity check are not implemented."
        : "Waiting for provider credentials or endpoint configuration.",
    };
  });
}

const tenantModeOverrides = new Map<string, "safe-mode" | "autonomous">();

function readGovernanceState(tenantName: string) {
  const tenant = tenantDirectory[tenantName as keyof typeof tenantDirectory] ?? tenantDirectory["Autofix Center"];
  const connectors = readConnectorState();
  const unavailableConnectors = connectors.filter((connector) => !connector.ready).length;
  const derivedMode = unavailableConnectors > 0 ? "safe-mode" : "autonomous";
  const override = tenantModeOverrides.get(tenant.name) ?? derivedMode;
  const mode = override === "autonomous" && unavailableConnectors > 0 ? "safe-mode" : override;

  return {
    governance: {
      tenantName: tenant.name,
      status: mode === "safe-mode" ? "protected" : "autonomous",
      mode,
      risk: mode === "safe-mode" ? "controlled" : "low",
      controls: [
        { name: "RBAC", status: "enforced", detail: "Tenant roles and access boundaries remain policy-controlled." },
        { name: "Audit", status: "enabled", detail: "Each orchestration event is persisted to the tenant audit log." },
        { name: "Connector Guardrails", status: mode === "safe-mode" ? "paused" : "active", detail: mode === "safe-mode" ? "External execution remains paused until provider adapters pass connectivity checks." : "All verified provider adapters are live and monitored." },
        { name: "Escalation", status: "available", detail: "High-risk automation requests require operator review before execution." },
      ],
      connectors,
      nextAction: mode === "safe-mode"
        ? "Implement and verify provider adapters; credentials alone do not enable external execution."
        : "Governance checks are complete and autonomous execution is enabled.",
    },
  };
}

app.get("/api/saas/governance/:tenantName", (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  return c.json(readGovernanceState(tenantName));
});

app.post("/api/saas/governance/:tenantName/activate", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const access = await resolveQueueWriteContext(c);
  const requireQueueAuth = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  if (requireQueueAuth && !access.isAuthorized) {
    return c.json({
      error: "Tenant control changes require tenant access.",
      code: "BUSINESS_AUTH_REQUIRED",
      requiredHeaders: ["authorization: Bearer <signed JWT>"],
    }, 401);
  }
  if (requireQueueAuth && !isAuthorizedForTenant(access, tenantName)) {
    return c.json({ error: "The authenticated user cannot access this tenant.", code: "TENANT_ACCESS_DENIED" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const requestedMode = typeof body.mode === "string" ? body.mode : "safe-mode";
  const governance = readGovernanceState(tenantName);
  const requestedState = requestedMode === "autonomous" ? "autonomous" : "safe-mode";

  if (requestedState === "autonomous" && governance.governance.mode === "safe-mode") {
    return c.json({
      error: "Autonomous activation is blocked while the tenant remains in safe-mode.",
      code: "SAFE_MODE_BLOCKED",
      mode: governance.governance.mode,
      tenantName,
      governance: governance.governance,
    }, 409);
  }

  tenantModeOverrides.set(tenantName, requestedState);
  const next = readGovernanceState(tenantName);

  return c.json({
    ok: true,
    tenantName,
    mode: next.governance.mode,
    governance: next.governance,
  });
});

app.get("/api/saas/business/tenant/:tenantName", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const accessError = await requireTenantAccess(c, tenantName);
  if (accessError) return accessError;
  const tenant = tenantDirectory[tenantName as keyof typeof tenantDirectory] ?? tenantDirectory["Autofix Center"];
  const governance = readGovernanceState(tenant.name).governance;
  const connectors = governance.connectors;

  const workflows = Object.values(businessWorkflowCatalog).map((workflow) => ({
    ...workflow,
    tenantName: tenant.name,
    status: governance.mode === "autonomous" ? "ready" : "blocked",
    automation: governance.mode === "autonomous" ? "autonomous" : "manual-review",
  }));

  return c.json({
    business: {
      tenantName: tenant.name,
      status: governance.mode,
      mode: governance.mode === "autonomous" ? "ai-powered" : "safe-mode",
      health: governance.mode === "autonomous" ? "operational" : "protected",
      automationCoverage: governance.mode === "autonomous" ? 86 : 0,
      nextPriority: "lead_follow_up",
    },
    connectors,
    workflows,
    metrics: {
      qualifiedLeads: 184,
      activeOpportunities: 42,
      renewalRisk: "low",
      roiEstimated: "3.8x",
    },
    tenant,
  });
});

app.post("/api/saas/business/tenant/:tenantName/execute", async (c) => {
  const tenantName = decodeURIComponent(c.req.param("tenantName"));
  const access = await resolveQueueWriteContext(c);
  const requireQueueAuth = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  if (requireQueueAuth && !access.isAuthorized) {
    return c.json({
      error: "Tenant business execution requires tenant access.",
      code: "BUSINESS_AUTH_REQUIRED",
      requiredHeaders: ["authorization: Bearer <signed JWT>"],
    }, 401);
  }
  if (requireQueueAuth && !isAuthorizedForTenant(access, tenantName)) {
    return c.json({ error: "The authenticated user cannot access this tenant.", code: "TENANT_ACCESS_DENIED" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const workflow = typeof body.workflow === "string" ? body.workflow : "lead_follow_up";
  const mode = typeof body.mode === "string" ? body.mode : "autonomous";
  const governance = readGovernanceState(tenantName);

  if (mode === "autonomous" && governance.governance.mode === "safe-mode") {
    return c.json({
      error: "Autonomous business execution is blocked while the tenant is in safe-mode.",
      code: "SAFE_MODE_BLOCKED",
      mode: governance.governance.mode,
      tenantName,
      required: "Configure connector credentials or switch the tenant to a manual workflow.",
      controls: governance.governance.controls,
    }, 409);
  }

  const selectedWorkflow = businessWorkflowCatalog[workflow as keyof typeof businessWorkflowCatalog] ?? businessWorkflowCatalog.lead_follow_up;
  const audit = appendAuditEvent({
    action: "business_execute",
    tenantId: access.tenantId,
    role: access.role,
    resource: "business-automation",
    summary: `Executed ${selectedWorkflow.name} for ${tenantName}`,
    details: { tenantName, workflow: selectedWorkflow.id, mode },
  });

  const queueTask = `Execute ${selectedWorkflow.name} for ${tenantName}`;
  if (durableAgentQueue) {
    await durableAgentQueue.add(`business:${tenantName}:${selectedWorkflow.id}`, {
      from: "ECO-IA",
      to: selectedWorkflow.owner,
      task: queueTask,
      lastMessage: "Business workflow accepted by autonomous operations.",
    });
  } else {
    const current = readQueueState();
    const newJob = {
      id: `job-business-${Date.now()}`,
      from: "ECO-IA",
      to: selectedWorkflow.owner,
      task: queueTask,
      status: "queued",
      lastMessage: "Business workflow accepted by autonomous operations.",
    };
    persistQueueState({
      ...current,
      lastUpdated: new Date().toISOString(),
      jobs: [newJob, ...current.jobs],
    });
  }

  return c.json({
    accepted: true,
    tenantName,
    workflow: selectedWorkflow.id,
    mode,
    audit,
    recommendation: {
      priority: "execute_immediately",
      owner: selectedWorkflow.owner,
      nextStep: `Dispatch ${selectedWorkflow.name} workflow in ${selectedWorkflow.sla}`,
    },
  });
});

app.get("/api/saas/agents/network", async (c) => {
  const agentRuntime = await readEcoIaRuntime();
  return c.json({ network: { ...agentNetwork, agentRuntime } });
});
app.get("/api/saas/agents/queue", async (c) => {
  const accessError = await requirePlatformAccess(c);
  if (accessError) return accessError;
  const queue = await readDurableQueueState();
  return c.json({ queue: { ...queue, agentRuntime: await readEcoIaRuntime() } });
});
app.post("/api/saas/agents/queue/advance", async (c) => {
  const access = await resolveQueueWriteContext(c);
  const requireQueueAuth = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  const isPlatformAdmin = access.isAuthorized && (process.env.NODE_ENV !== "production" || access.role === "platform_admin");
  if (requireQueueAuth && !isPlatformAdmin) {
    return c.json({
      error: "Queue write requires tenant access.",
      code: "QUEUE_AUTH_REQUIRED",
      requiredHeaders: ["authorization: Bearer <signed JWT>"],
    }, 401);
  }

  const audit = appendAuditEvent({
    action: "advance",
    tenantId: access.tenantId,
    role: access.role,
    resource: "agent-queue",
    summary: "Advanced the ECO-IA queue cycle",
  });

  if (durableAgentQueue) {
    await ensureDurableQueueReady();
    await durableAgentQueue.add("agent-cycle", {
      from: "ECO-IA",
      to: "EXPLORADOR",
      task: "Advance the ECO-IA worker cycle",
      lastMessage: "Cycle accepted by the durable worker.",
    });
    const next = await readDurableQueueState();
    return c.json({
      queue: { ...next, agentRuntime: await readEcoIaRuntime() },
      executed: true,
      audit,
    });
  }

  const current = readQueueState();
  const selectedJob = current.jobs.find((job) => job.status === "queued");
  const next = await processLocalQueue(current);
  agentQueue = next;
  const executed = selectedJob !== undefined && next.jobs.some((job) => job.id === selectedJob.id && job.status === "completed");
  return c.json({
    queue: { ...next, agentRuntime: await readEcoIaRuntime() },
    executed,
    audit,
  });
});
app.post("/api/saas/agents/queue/enqueue", async (c) => {
  const access = await resolveQueueWriteContext(c);
  const requireQueueAuth = process.env.REQUIRE_AGENT_QUEUE_AUTH === "true" || process.env.NODE_ENV === "production";
  const isPlatformAdmin = access.isAuthorized && (process.env.NODE_ENV !== "production" || access.role === "platform_admin");
  if (requireQueueAuth && !isPlatformAdmin) {
    return c.json({
      error: "Queue write requires tenant access.",
      code: "QUEUE_AUTH_REQUIRED",
      requiredHeaders: ["authorization: Bearer <signed JWT>"],
    }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const task = typeof body.task === "string" ? body.task : "New ECO-IA task";
  const recipient = normalizeAgentName(typeof body.to === "string" ? body.to : "EXPLORADOR");
  const sender = typeof body.from === "string" ? body.from : "ECO-IA";

  if (!task.trim() || task.length > 4000) {
    return c.json({ error: "task must contain 1 to 4000 characters" }, 400);
  }
  if (!agentNetwork.agents.some((agent) => agent.name === recipient)) {
    return c.json({ error: `Unknown ECO-IA agent: ${recipient}` }, 400);
  }

  const audit = appendAuditEvent({
    action: "enqueue",
    tenantId: access.tenantId,
    role: access.role,
    resource: "agent-queue",
    summary: `Queued task for ${recipient}`,
    details: { task, recipient, sender },
  });

  if (durableAgentQueue) {
    await ensureDurableQueueReady();
    const queuedJob = await durableAgentQueue.add(task, {
      from: sender,
      to: recipient,
      task,
      lastMessage: "Queued by orchestrator.",
    });
    const newJob = { ...queuedJob.data, id: queuedJob.id, status: "queued" };
    const next = await readDurableQueueState();
    return c.json({
      queue: { ...next, agentRuntime: await readEcoIaRuntime() },
      accepted: true,
      job: newJob,
      audit,
    });
  }

  const current = readQueueState();

  const newJob = {
    id: `job-${Date.now()}`,
    from: sender,
    to: recipient,
    task,
    status: "queued",
    lastMessage: "Queued by orchestrator.",
  };

  const next = persistQueueState({
    ...current,
    lastUpdated: new Date().toISOString(),
    jobs: [newJob, ...current.jobs],
  });

  agentQueue = next;
  return c.json({
    queue: { ...next, agentRuntime: await readEcoIaRuntime() },
    accepted: true,
    job: newJob,
    audit,
  });
});

app.get("/", (c) => {
  const publicDir = resolve(process.cwd(), "dist/public");
  const indexPath = join(publicDir, "index.html");

  if (existsSync(indexPath)) {
    return c.html(readFileSync(indexPath, "utf8"));
  }

  return c.html(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AdPulse</title>
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="/src/main.tsx"></script>
      </body>
    </html>
  `);
});

if (process.env.NODE_ENV === "production") {
  serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) }, (info) => {
    console.log(`AdPulse server running on http://localhost:${info.port}/`);
  });
}

export default app;
