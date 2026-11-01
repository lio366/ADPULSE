import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AUTONOMY_LEVELS, areaById } from "@contracts/business";
import {
  businessRecords,
  businessSettings,
  businessTasks,
  customerPortalAccounts,
  customers,
  estimates,
  mediaAssets,
} from "@db/schema";
import { storage } from "./lib/storage";
import { authedQuery, createRouter } from "./middleware";
import { addBusinessAudit, getAutomationMode } from "./queries/business";
import { getDb } from "./queries/connection";
import { getPortalContext } from "./queries/portal";

const cleanText = (max: number) => z.string().trim().min(1).max(max);
const optionalFutureDate = z.string().trim().max(60).optional()
  .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), "Fecha inválida")
  .refine((value) => !value || new Date(value).getTime() > Date.now() - 300_000, "Elige una fecha futura");
const hashInvite = (code: string) => createHash("sha256").update(code).digest("hex");

export const portalRouter = createRouter({
  workspace: authedQuery.query(async ({ ctx }) => {
    const context = await getPortalContext(ctx.user.id);
    if (!context) return null;
    const { account, customer } = context;
    const db = getDb();
    const [settings, estimateRows, records, media] = await Promise.all([
      db.select({ businessName: businessSettings.businessName }).from(businessSettings).where(eq(businessSettings.ownerId, account.ownerId)).limit(1),
      db.select().from(estimates).where(and(eq(estimates.ownerId, account.ownerId), eq(estimates.customerId, customer.id))).orderBy(desc(estimates.createdAt)).limit(100),
      db.select().from(businessRecords).where(and(eq(businessRecords.ownerId, account.ownerId), eq(businessRecords.customerId, customer.id))).orderBy(desc(businessRecords.updatedAt)).limit(150),
      db.select().from(mediaAssets).where(and(eq(mediaAssets.ownerId, account.ownerId), eq(mediaAssets.customerId, customer.id))).orderBy(desc(mediaAssets.createdAt)).limit(60),
    ]);
    const signed = media.length ? await storage.getPresignedUrls({ keys: media.map((item) => item.storageKey) }) : { urls: [] };
    const urls = new Map(signed.urls.map((item) => [item.key, item.url]));
    return {
      businessName: settings[0]?.businessName ?? "Tu negocio",
      customer: { id: customer.id, name: customer.name, vehicle: customer.vehicle, status: customer.status },
      preferences: {
        autonomyLevel: account.autonomyLevel,
        autoBook: account.autoBook,
        autoReminders: account.autoReminders,
        marketingConsent: account.marketingConsent,
      },
      estimates: estimateRows,
      records,
      media: media.map((item) => ({ ...item, storageKey: undefined, url: urls.get(item.storageKey) ?? null })),
    };
  }),

  claim: authedQuery.input(z.object({ code: cleanText(90) })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "La cuenta de administrador no puede reclamar una cuenta de cliente." });
    const db = getDb();
    const existing = await getPortalContext(ctx.user.id);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Esta cuenta ya está vinculada a un cliente." });
    const [account] = await db.select().from(customerPortalAccounts)
      .where(eq(customerPortalAccounts.inviteHash, hashInvite(input.code))).limit(1);
    if (!account || !account.inviteExpiresAt || account.inviteExpiresAt.getTime() < Date.now()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "La invitación no es válida o ya venció. Pide una nueva al negocio." });
    }
    if (account.userId) throw new TRPCError({ code: "CONFLICT", message: "Esta invitación ya fue utilizada." });
    await db.update(customerPortalAccounts).set({ userId: ctx.user.id, inviteHash: null, inviteExpiresAt: null })
      .where(and(eq(customerPortalAccounts.id, account.id), eq(customerPortalAccounts.ownerId, account.ownerId), eq(customerPortalAccounts.inviteHash, hashInvite(input.code)), isNull(customerPortalAccounts.userId)));
    const [claimed] = await db.select().from(customerPortalAccounts).where(eq(customerPortalAccounts.id, account.id)).limit(1);
    if (claimed?.userId !== ctx.user.id) throw new TRPCError({ code: "CONFLICT", message: "Esta invitación acaba de ser utilizada por otra cuenta." });
    await addBusinessAudit(account.ownerId, "security", ctx.user.name ?? "Cliente", "Cuenta de cliente vinculada mediante invitación.");
    return { ok: true };
  }),

  updatePreferences: authedQuery.input(z.object({
    autonomyLevel: z.enum(AUTONOMY_LEVELS),
    autoBook: z.boolean(),
    autoReminders: z.boolean(),
    marketingConsent: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    const context = await getPortalContext(ctx.user.id);
    if (!context) throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta de cliente no encontrada." });
    await getDb().update(customerPortalAccounts).set(input)
      .where(and(eq(customerPortalAccounts.id, context.account.id), eq(customerPortalAccounts.userId, ctx.user.id)));
    await addBusinessAudit(context.account.ownerId, "security", ctx.user.name ?? context.customer.name, `Autonomía actualizada: ${input.autonomyLevel}; citas automáticas ${input.autoBook ? "sí" : "no"}.`);
    return { ok: true };
  }),

  createServiceRequest: authedQuery.input(z.object({
    title: cleanText(180),
    details: z.string().trim().max(2500).optional(),
    preferredAt: optionalFutureDate,
  })).mutation(async ({ ctx, input }) => {
    const context = await getPortalContext(ctx.user.id);
    if (!context) throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta de cliente no encontrada." });
    const { account, customer } = context;
    const db = getDb();
    const supportMode = await getAutomationMode(account.ownerId, "support", 3);
    const booked = Boolean(account.autoBook && supportMode === "autonomous" && input.preferredAt);
    const taskArea = booked ? "operations" : "support";
    const taskMode = booked ? await getAutomationMode(account.ownerId, "operations", 2) : supportMode;
    const [request] = await db.insert(businessRecords).values({
      ownerId: account.ownerId,
      customerId: customer.id,
      areaId: "support",
      kind: "service_request",
      title: input.title,
      details: input.details,
      status: "requested",
      scheduledAt: input.preferredAt ? new Date(input.preferredAt) : undefined,
      source: "client",
    }).$returningId();
    await db.insert(businessRecords).values({
      ownerId: account.ownerId,
      customerId: customer.id,
      areaId: "support",
      kind: "appointment",
      title: `Cita: ${input.title}`,
      details: input.details,
      status: booked ? "confirmed" : "requested",
      scheduledAt: input.preferredAt ? new Date(input.preferredAt) : undefined,
      source: booked ? "system" : "client",
    });
    if (taskMode !== "off") {
      await db.insert(businessTasks).values({
        ownerId: account.ownerId,
        areaId: taskArea,
        title: booked ? `Preparar servicio confirmado para ${customer.name}` : `Revisar solicitud de ${customer.name}`,
        description: `${input.title}. Solicitud #${request.id}. ${booked ? "La cita fue confirmada según el permiso del cliente y la regla del negocio." : "Requiere revisión y confirmación humana."}`,
        priority: "normal",
        status: taskMode === "assisted" ? "approval" : "pending",
        assignedAgent: areaById(taskArea).agent,
        source: "system",
      });
    }
    await db.update(customers).set({ status: "active" }).where(and(eq(customers.id, customer.id), eq(customers.ownerId, account.ownerId)));
    await addBusinessAudit(account.ownerId, "support", ctx.user.name ?? customer.name, booked ? "Solicitud recibida y cita confirmada por el permiso del cliente." : "Solicitud de servicio recibida; cita pendiente de confirmación.");
    return { id: request.id, booked };
  }),

  decideEstimate: authedQuery.input(z.object({
    id: z.number().int().positive(),
    decision: z.enum(["approved", "declined"]),
  })).mutation(async ({ ctx, input }) => {
    const context = await getPortalContext(ctx.user.id);
    if (!context) throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta de cliente no encontrada." });
    const { account, customer } = context;
    const db = getDb();
    const [estimate] = await db.select().from(estimates).where(and(
      eq(estimates.id, input.id), eq(estimates.ownerId, account.ownerId), eq(estimates.customerId, customer.id),
    )).limit(1);
    if (!estimate) throw new TRPCError({ code: "NOT_FOUND", message: "Estimado no encontrado o sin permiso." });
    if (estimate.status !== "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "Este estimado ya no está esperando una decisión." });
    if (estimate.validUntil && estimate.validUntil.getTime() < Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "Este estimado venció. Solicita una actualización al negocio." });
    await db.update(estimates).set({ status: input.decision }).where(and(eq(estimates.id, estimate.id), eq(estimates.ownerId, account.ownerId), eq(estimates.customerId, customer.id)));
    await db.update(customers).set({ status: input.decision === "approved" ? "work" : "active" }).where(and(eq(customers.id, customer.id), eq(customers.ownerId, account.ownerId)));
    if (input.decision === "approved") {
      const [operationsMode, loyaltyMode] = await Promise.all([
        getAutomationMode(account.ownerId, "operations", 0),
        getAutomationMode(account.ownerId, "loyalty", 0),
      ]);
      if (operationsMode !== "off") {
        await db.insert(businessTasks).values({
          ownerId: account.ownerId,
          areaId: "operations",
          title: `Organizar servicio aprobado: ${estimate.title}`,
          description: `Estimado #${estimate.id} aceptado expresamente por ${customer.name}. Coordinar el trabajo; no se ha realizado ningún cobro.`,
          priority: "high",
          status: operationsMode === "assisted" ? "approval" : "pending",
          assignedAgent: areaById("operations").agent,
          source: "system",
        });
      }
      if (account.autoReminders && loyaltyMode !== "off") {
        await db.insert(businessTasks).values({
          ownerId: account.ownerId,
          areaId: "loyalty",
          title: `Preparar seguimiento posterior para ${customer.name}`,
          description: "El cliente permite recordatorios. Preparar el seguimiento después de completar el servicio; cualquier contacto externo requiere un canal conectado.",
          priority: "low",
          status: loyaltyMode === "assisted" ? "approval" : "pending",
          assignedAgent: areaById("loyalty").agent,
          source: "system",
        });
      }
    }
    await addBusinessAudit(account.ownerId, "sales", ctx.user.name ?? customer.name, `Estimado #${estimate.id} ${input.decision === "approved" ? "aprobado" : "rechazado"} expresamente por el cliente.`);
    return { ok: true };
  }),

  cancelRecord: authedQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const context = await getPortalContext(ctx.user.id);
    if (!context) throw new TRPCError({ code: "NOT_FOUND", message: "Cuenta de cliente no encontrada." });
    const { account, customer } = context;
    const [record] = await getDb().select().from(businessRecords).where(and(
      eq(businessRecords.id, input.id), eq(businessRecords.ownerId, account.ownerId), eq(businessRecords.customerId, customer.id),
    )).limit(1);
    if (!record || !["appointment", "service_request", "order"].includes(record.kind)) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitud no encontrada o no cancelable desde el portal." });
    if (["done", "cancelled", "rejected"].includes(record.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta solicitud ya está cerrada." });
    await getDb().update(businessRecords).set({ status: "cancelled" }).where(and(eq(businessRecords.id, record.id), eq(businessRecords.ownerId, account.ownerId), eq(businessRecords.customerId, customer.id)));
    await addBusinessAudit(account.ownerId, record.areaId, ctx.user.name ?? customer.name, `${record.title}: cancelación solicitada desde el portal.`);
    return { ok: true };
  }),
});
