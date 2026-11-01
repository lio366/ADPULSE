import { createHash, randomBytes } from "node:crypto";
import { generateObject } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  AREA_FUNCTIONS,
  AREA_IDS,
  AREA_RECORD_KINDS,
  AUTOMATION_MODES,
  RECORD_KINDS,
  RECORD_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  areaById,
} from "@contracts/business";
import {
  agentRuns,
  businessAutomationRules,
  businessRecords,
  businessSettings,
  businessTasks,
  customerPortalAccounts,
  customers,
  estimates,
  financeEntries,
  inventoryItems,
} from "@db/schema";
import {
  AiInvalidRequest,
  AiMisconfigured,
  AiTransient,
  AiUnavailable,
  ContentRejected,
  classifyAiError,
  listModels,
} from "./ai/ai-client";
import { kimiGw } from "./ai/provider";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import {
  addBusinessAudit,
  findOwnedCustomer,
  findOwnedEstimate,
  findOwnedInventoryItem,
  findOwnedRecord,
  findOwnedTask,
  getBusinessWorkspace,
} from "./queries/business";

const areaSchema = z.enum(AREA_IDS);
const cleanText = (max: number) => z.string().trim().min(1).max(max);
const optionalDate = z.string().trim().max(60).optional()
  .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Fecha inválida");
const moneyInput = z.number().finite().positive().max(100_000_000);

function notFound(label = "Registro") {
  return new TRPCError({ code: "NOT_FOUND", message: `${label} no encontrado o sin permiso.` });
}

function aiMessage(error: unknown) {
  const classified = classifyAiError(error);
  if (classified instanceof AiUnavailable) return "La IA no tiene cupo disponible. Revisa el saldo de la plataforma antes de reintentar.";
  if (classified instanceof ContentRejected) return "La instrucción no pudo procesarse. Reformúlala con un objetivo comercial concreto.";
  if (classified instanceof AiMisconfigured) return "La IA necesita una nueva activación del sitio. Abre o publica la aplicación y vuelve a intentarlo.";
  if (classified instanceof AiTransient) return "La IA está temporalmente ocupada. Espera un momento y decide si quieres reintentar.";
  if (classified instanceof AiInvalidRequest) return "La solicitud de IA no es válida. Reduce o simplifica la instrucción.";
  return "El Director General no pudo completar el análisis.";
}

export const businessRouter = createRouter({
  workspace: adminQuery.query(({ ctx }) => getBusinessWorkspace(ctx.user.id)),

  saveSettings: adminQuery.input(z.object({
    businessName: cleanText(160),
    autopilot: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const [existing] = await db.select().from(businessSettings)
      .where(eq(businessSettings.ownerId, ctx.user.id)).orderBy(desc(businessSettings.updatedAt)).limit(1);
    if (existing) {
      await db.update(businessSettings).set(input)
        .where(and(eq(businessSettings.id, existing.id), eq(businessSettings.ownerId, ctx.user.id)));
    } else {
      await db.insert(businessSettings).values({ ownerId: ctx.user.id, ...input });
    }
    await addBusinessAudit(ctx.user.id, "management", ctx.user.name ?? "Administrador", input.autopilot ? "Motor de automatización activado." : "Motor de automatización pausado.");
    return { ok: true };
  }),

  saveAutomationRule: adminQuery.input(z.object({
    areaId: areaSchema,
    functionIndex: z.number().int().min(0).max(4),
    mode: z.enum(AUTOMATION_MODES),
  }).refine((input) => input.functionIndex < AREA_FUNCTIONS[input.areaId].length, {
    message: "La función elegida no pertenece al área.",
  })).mutation(async ({ ctx, input }) => {
    await getDb().insert(businessAutomationRules).values({ ownerId: ctx.user.id, ...input })
      .onDuplicateKeyUpdate({ set: { mode: input.mode } });
    await addBusinessAudit(ctx.user.id, input.areaId, ctx.user.name ?? "Administrador", `${AREA_FUNCTIONS[input.areaId][input.functionIndex]}: modo ${input.mode}.`);
    return { ok: true };
  }),

  saveAreaAutomation: adminQuery.input(z.object({
    areaId: areaSchema,
    mode: z.enum(AUTOMATION_MODES),
  })).mutation(async ({ ctx, input }) => {
    await getDb().insert(businessAutomationRules).values(AREA_FUNCTIONS[input.areaId].map((_, functionIndex) => ({
      ownerId: ctx.user.id,
      areaId: input.areaId,
      functionIndex,
      mode: input.mode,
    }))).onDuplicateKeyUpdate({ set: { mode: input.mode } });
    await addBusinessAudit(ctx.user.id, input.areaId, ctx.user.name ?? "Administrador", `Todas las funciones del área cambiaron a modo ${input.mode}.`);
    return { ok: true };
  }),

  createTask: adminQuery.input(z.object({
    areaId: areaSchema,
    title: cleanText(180),
    description: z.string().trim().max(2000).optional(),
    priority: z.enum(TASK_PRIORITIES).default("normal"),
    dueAt: optionalDate,
    requiresApproval: z.boolean().default(false),
  })).mutation(async ({ ctx, input }) => {
    const area = areaById(input.areaId);
    const [created] = await getDb().insert(businessTasks).values({
      ownerId: ctx.user.id,
      areaId: input.areaId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
      assignedAgent: area.agent,
      status: input.requiresApproval ? "approval" : "pending",
      source: "manual",
    }).$returningId();
    await addBusinessAudit(ctx.user.id, input.areaId, ctx.user.name ?? "Administrador", `Trabajo creado: ${input.title}.`);
    return created;
  }),

  updateTask: adminQuery.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(TASK_STATUSES),
  })).mutation(async ({ ctx, input }) => {
    const task = await findOwnedTask(ctx.user.id, input.id);
    if (!task) throw notFound("Trabajo");
    await getDb().update(businessTasks).set({ status: input.status })
      .where(and(eq(businessTasks.id, input.id), eq(businessTasks.ownerId, ctx.user.id)));
    await addBusinessAudit(ctx.user.id, task.areaId, ctx.user.name ?? "Administrador", `${task.title}: estado cambiado a ${input.status}.`);
    return { ok: true };
  }),

  createFinance: adminQuery.input(z.object({
    type: z.enum(["income", "expense"]),
    category: cleanText(80),
    description: cleanText(200),
    amount: moneyInput,
  })).mutation(async ({ ctx, input }) => {
    const [created] = await getDb().insert(financeEntries).values({
      ownerId: ctx.user.id,
      type: input.type,
      category: input.category,
      description: input.description,
      amount: input.amount.toFixed(2),
    }).$returningId();
    await addBusinessAudit(ctx.user.id, "finance", ctx.user.name ?? "Administrador", `${input.type === "income" ? "Ingreso" : "Gasto"} registrado: ${input.description}.`);
    return created;
  }),

  createInventory: adminQuery.input(z.object({
    sku: cleanText(60),
    name: cleanText(140),
    category: cleanText(80),
    quantity: z.number().int().min(0).max(1_000_000),
    minQuantity: z.number().int().min(0).max(1_000_000),
    unitCost: z.number().finite().min(0).max(100_000_000),
    supplier: z.string().trim().max(140).optional(),
  })).mutation(async ({ ctx, input }) => {
    const [created] = await getDb().insert(inventoryItems).values({
      ownerId: ctx.user.id,
      sku: input.sku,
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      minQuantity: input.minQuantity,
      unitCost: input.unitCost.toFixed(2),
      supplier: input.supplier,
    }).$returningId();
    await addBusinessAudit(ctx.user.id, "inventory", ctx.user.name ?? "Administrador", `Artículo creado: ${input.name}.`);
    return created;
  }),

  adjustInventory: adminQuery.input(z.object({
    id: z.number().int().positive(),
    delta: z.number().int().min(-100_000).max(100_000).refine((value) => value !== 0),
  })).mutation(async ({ ctx, input }) => {
    const item = await findOwnedInventoryItem(ctx.user.id, input.id);
    if (!item) throw notFound("Artículo");
    const quantity = item.quantity + input.delta;
    if (quantity < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "La salida supera las existencias disponibles." });
    await getDb().update(inventoryItems).set({ quantity })
      .where(and(eq(inventoryItems.id, item.id), eq(inventoryItems.ownerId, ctx.user.id)));
    await addBusinessAudit(ctx.user.id, "inventory", ctx.user.name ?? "Administrador", `${item.name}: ajuste de ${input.delta} unidades.`);
    return { quantity };
  }),

  createCustomer: adminQuery.input(z.object({
    name: cleanText(140),
    phone: z.string().trim().max(40).optional(),
    email: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(320)]).optional(),
    vehicle: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(2000).optional(),
    nextActionAt: optionalDate,
  })).mutation(async ({ ctx, input }) => {
    const [created] = await getDb().insert(customers).values({
      ownerId: ctx.user.id,
      name: input.name,
      phone: input.phone || undefined,
      email: input.email || undefined,
      vehicle: input.vehicle,
      notes: input.notes,
      nextActionAt: input.nextActionAt ? new Date(input.nextActionAt) : undefined,
    }).$returningId();
    await addBusinessAudit(ctx.user.id, "sales", ctx.user.name ?? "Administrador", `Cliente registrado: ${input.name}.`);
    return created;
  }),

  createEstimate: adminQuery.input(z.object({
    customerId: z.number().int().positive(),
    title: cleanText(180),
    amount: moneyInput,
    validUntil: optionalDate,
  })).mutation(async ({ ctx, input }) => {
    const customer = await findOwnedCustomer(ctx.user.id, input.customerId);
    if (!customer) throw notFound("Cliente");
    const [created] = await getDb().insert(estimates).values({
      ownerId: ctx.user.id,
      customerId: input.customerId,
      title: input.title,
      amount: input.amount.toFixed(2),
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
    }).$returningId();
    await getDb().update(customers).set({ status: "estimate" })
      .where(and(eq(customers.id, customer.id), eq(customers.ownerId, ctx.user.id)));
    await addBusinessAudit(ctx.user.id, "sales", ctx.user.name ?? "Administrador", `Estimado creado para ${customer.name}: ${input.title}.`);
    return created;
  }),

  updateEstimate: adminQuery.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(["draft", "sent", "approved", "declined"]),
  })).mutation(async ({ ctx, input }) => {
    const estimate = await findOwnedEstimate(ctx.user.id, input.id);
    if (!estimate) throw notFound("Estimado");
    await getDb().update(estimates).set({ status: input.status })
      .where(and(eq(estimates.id, input.id), eq(estimates.ownerId, ctx.user.id)));
    await addBusinessAudit(ctx.user.id, "sales", ctx.user.name ?? "Administrador", `Estimado ${estimate.id}: ${input.status}.`);
    return { ok: true };
  }),

  createRecord: adminQuery.input(z.object({
    areaId: areaSchema,
    kind: z.enum(RECORD_KINDS),
    title: cleanText(180),
    details: z.string().trim().max(3000).optional(),
    status: z.enum(RECORD_STATUSES).default("pending"),
    customerId: z.number().int().positive().optional(),
    amount: z.number().finite().positive().max(100_000_000).optional(),
    scheduledAt: optionalDate,
  })).mutation(async ({ ctx, input }) => {
    if (!AREA_RECORD_KINDS[input.areaId].includes(input.kind)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Ese tipo de registro no pertenece al área elegida." });
    }
    if (input.customerId && !await findOwnedCustomer(ctx.user.id, input.customerId)) throw notFound("Cliente");
    const [created] = await getDb().insert(businessRecords).values({
      ownerId: ctx.user.id,
      customerId: input.customerId,
      areaId: input.areaId,
      kind: input.kind,
      title: input.title,
      details: input.details,
      status: input.status,
      amount: input.amount?.toFixed(2),
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      source: "admin",
    }).$returningId();
    await addBusinessAudit(ctx.user.id, input.areaId, ctx.user.name ?? "Administrador", `${input.kind}: ${input.title} registrado.`);
    return created;
  }),

  updateRecord: adminQuery.input(z.object({
    id: z.number().int().positive(),
    status: z.enum(RECORD_STATUSES),
  })).mutation(async ({ ctx, input }) => {
    const record = await findOwnedRecord(ctx.user.id, input.id);
    if (!record) throw notFound("Registro operativo");
    await getDb().update(businessRecords).set({ status: input.status })
      .where(and(eq(businessRecords.id, record.id), eq(businessRecords.ownerId, ctx.user.id)));
    await addBusinessAudit(ctx.user.id, record.areaId, ctx.user.name ?? "Administrador", `${record.title}: estado cambiado a ${input.status}.`);
    return { ok: true };
  }),

  createPortalInvite: adminQuery.input(z.object({ customerId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const customer = await findOwnedCustomer(ctx.user.id, input.customerId);
    if (!customer) throw notFound("Cliente");
    const [existing] = await getDb().select().from(customerPortalAccounts)
      .where(and(eq(customerPortalAccounts.ownerId, ctx.user.id), eq(customerPortalAccounts.customerId, customer.id))).limit(1);
    if (existing?.userId) throw new TRPCError({ code: "CONFLICT", message: "Este cliente ya tiene una cuenta vinculada. Revoca el acceso antes de crear otra invitación." });
    const code = `AP-${randomBytes(24).toString("base64url")}`;
    const inviteHash = createHash("sha256").update(code).digest("hex");
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await getDb().insert(customerPortalAccounts).values({
      ownerId: ctx.user.id,
      customerId: customer.id,
      inviteHash,
      inviteExpiresAt,
    }).onDuplicateKeyUpdate({ set: { inviteHash, inviteExpiresAt } });
    await addBusinessAudit(ctx.user.id, "security", ctx.user.name ?? "Administrador", `Invitación de portal creada para ${customer.name}; válida por 7 días.`);
    return { code, expiresAt: inviteExpiresAt };
  }),

  revokePortalAccess: adminQuery.input(z.object({ customerId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const customer = await findOwnedCustomer(ctx.user.id, input.customerId);
    if (!customer) throw notFound("Cliente");
    await getDb().update(customerPortalAccounts).set({
      userId: null,
      inviteHash: null,
      inviteExpiresAt: null,
      autonomyLevel: "manual",
      autoBook: false,
      autoReminders: false,
      marketingConsent: false,
    }).where(and(eq(customerPortalAccounts.ownerId, ctx.user.id), eq(customerPortalAccounts.customerId, customer.id)));
    await addBusinessAudit(ctx.user.id, "security", ctx.user.name ?? "Administrador", `Acceso al portal revocado para ${customer.name}.`);
    return { ok: true };
  }),

  runCycle: adminQuery.mutation(async ({ ctx }) => {
    const data = await getBusinessWorkspace(ctx.user.id);
    if (data.settings && !data.settings.autopilot) return { created: 0, result: "El motor de automatización está pausado." };
    const openTitles = new Set(data.tasks.filter((task) => task.status !== "done" && task.status !== "rejected").map((task) => task.title));
    const rules = new Map(data.automationRules.map((rule) => [`${rule.areaId}:${rule.functionIndex}`, rule.mode]));
    const proposals: Array<{
      areaId: (typeof AREA_IDS)[number];
      title: string;
      description: string;
      priority: (typeof TASK_PRIORITIES)[number];
      status: "pending" | "approval";
    }> = [];
    let skipped = 0;
    const propose = (proposal: {
      areaId: (typeof AREA_IDS)[number];
      functionIndex: number;
      title: string;
      description: string;
      priority: (typeof TASK_PRIORITIES)[number];
      sensitive?: boolean;
    }) => {
      if (openTitles.has(proposal.title)) return;
      const mode = rules.get(`${proposal.areaId}:${proposal.functionIndex}`) ?? "assisted";
      if (mode === "off") { skipped += 1; return; }
      proposals.push({
        areaId: proposal.areaId,
        title: proposal.title,
        description: proposal.description,
        priority: proposal.priority,
        status: proposal.sensitive || mode === "assisted" ? "approval" : "pending",
      });
      openTitles.add(proposal.title);
    };

    for (const item of data.inventory.filter((row) => row.quantity <= row.minQuantity)) {
      propose({ areaId: "inventory", functionIndex: 2, title: `Reponer ${item.name}`, description: `Existencias: ${item.quantity}; mínimo: ${item.minQuantity}. Revisar proveedor y autorizar la compra.`, priority: item.quantity === 0 ? "urgent" : "high", sensitive: true });
    }
    for (const estimate of data.estimates.filter((row) => row.status === "sent").slice(0, 10)) {
      propose({ areaId: "sales", functionIndex: 1, title: `Dar seguimiento al estimado #${estimate.id}`, description: `Importe: $${estimate.amount}. Confirmar recepción, resolver dudas y registrar la decisión del cliente. No se contacta externamente sin un canal autorizado.`, priority: "normal" });
    }
    const now = Date.now();
    for (const customer of data.customers.filter((row) => row.nextActionAt && new Date(row.nextActionAt).getTime() <= now).slice(0, 10)) {
      propose({ areaId: "sales", functionIndex: 1, title: `Contactar a ${customer.name}`, description: "La próxima acción ya venció. Revisar el historial antes de contactar.", priority: "high" });
    }
    for (const record of data.records.filter((row) => row.status === "requested" && ["service_request", "appointment", "ticket"].includes(row.kind)).slice(0, 10)) {
      propose({ areaId: record.areaId as (typeof AREA_IDS)[number], functionIndex: 3, title: `Atender solicitud #${record.id}: ${record.title}`, description: "Solicitud recibida desde el portal. Revisar, responder y confirmar el siguiente paso.", priority: "high" });
    }
    for (const record of data.records.filter((row) => row.kind === "invoice" && row.status === "sent" && row.scheduledAt && new Date(row.scheduledAt).getTime() < now).slice(0, 10)) {
      propose({ areaId: "treasury", functionIndex: 2, title: `Revisar factura vencida #${record.id}`, description: `${record.title}. Verificar el saldo y preparar el seguimiento; no se realizan cobros automáticos.`, priority: "high" });
    }

    if (proposals.length) {
      await getDb().insert(businessTasks).values(proposals.map((proposal) => ({
        ...proposal,
        ownerId: ctx.user.id,
        assignedAgent: areaById(proposal.areaId).agent,
        source: "agent" as const,
      })));
    }
    const autonomous = proposals.filter((proposal) => proposal.status === "pending").length;
    const approvals = proposals.length - autonomous;
    const result = proposals.length
      ? `${proposals.length} acciones nuevas: ${autonomous} iniciadas por permisos autónomos y ${approvals} esperan autorización.${skipped ? ` ${skipped} señales quedaron fuera por funciones apagadas.` : ""}`
      : `Análisis completado: no hay acciones nuevas.${skipped ? ` ${skipped} señales quedaron fuera por funciones apagadas.` : ""}`;
    await getDb().insert(agentRuns).values({ ownerId: ctx.user.id, agentId: "director", areaId: "management", objective: "Revisar datos operativos y permisos por función", result });
    await addBusinessAudit(ctx.user.id, "management", "DIRECTOR GENERAL", result);
    return { created: proposals.length, autonomous, approvals, skipped, result };
  }),

  directorPlan: adminQuery.input(z.object({ objective: cleanText(600) })).mutation(async ({ ctx, input }) => {
    try {
      const { defaultModelId } = await listModels();
      const { object } = await generateObject({
        model: kimiGw(defaultModelId),
        schema: z.object({
          summary: z.string().min(10).max(1200),
          actions: z.array(z.object({
            areaId: areaSchema,
            title: z.string().min(3).max(180),
            description: z.string().max(1000),
            priority: z.enum(TASK_PRIORITIES),
            requiresApproval: z.boolean(),
          })).min(1).max(6),
        }),
        system: `Eres el Director General de AdPulse Business. Coordina 20 áreas de un negocio real. Responde en español sencillo. Convierte el objetivo en un plan de 1 a 6 acciones internas concretas. No afirmes que llamaste, cobraste, publicaste, compraste o contrataste. Marca requiresApproval=true para gastos, pagos, publicidad externa, contratos, decisiones legales, contratación o compromisos con clientes. Usa solamente areaId permitidos.`,
        prompt: input.objective,
      });
      const db = getDb();
      await db.insert(businessTasks).values(object.actions.map((action) => ({
        ownerId: ctx.user.id,
        areaId: action.areaId,
        title: action.title,
        description: action.description,
        priority: action.priority,
        status: action.requiresApproval ? "approval" as const : "pending" as const,
        assignedAgent: areaById(action.areaId).agent,
        source: "agent" as const,
      })));
      await db.insert(agentRuns).values({ ownerId: ctx.user.id, agentId: "director", areaId: "management", objective: input.objective, result: object.summary });
      await addBusinessAudit(ctx.user.id, "management", "DIRECTOR GENERAL", `Plan creado con ${object.actions.length} acciones.`);
      return object;
    } catch (error) {
      const classified = classifyAiError(error);
      await getDb().insert(agentRuns).values({ ownerId: ctx.user.id, agentId: "director", areaId: "management", objective: input.objective, result: classified.message, status: "failed" });
      throw new TRPCError({ code: "BAD_REQUEST", message: aiMessage(classified) });
    }
  }),
});
