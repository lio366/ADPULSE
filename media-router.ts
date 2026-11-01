import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { MEDIA_CATEGORIES } from "@contracts/business";
import { mediaAssets } from "@db/schema";
import { StorageError } from "./lib/storage";
import { storage } from "./lib/storage";
import { adminQuery, authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { addBusinessAudit, findOwnedCustomer, getPortalAccount } from "./queries/business";

const MAX_FILE_BYTES = 40 * 1024 * 1024;

function storageMessage(error: unknown) {
  if (!(error instanceof StorageError)) return "No se pudo guardar el archivo. Inténtalo de nuevo.";
  switch (error.code) {
    case "STORAGE_NOT_PROVISIONED": return "El almacenamiento todavía no está activo. Abre o publica el sitio una vez y vuelve a intentarlo.";
    case "STORAGE_QUOTA_EXCEEDED": return "El espacio de almacenamiento está lleno. Elimina archivos antiguos o revisa tu cuota.";
    case "STORAGE_REVIEW_REJECTED": return "El archivo no superó la revisión de contenido.";
    case "STORAGE_FILE_TOO_LARGE": return "El archivo supera el tamaño permitido.";
    case "STORAGE_RATE_LIMITED": return "Hay demasiadas cargas seguidas. Espera un momento.";
    default: return "El almacenamiento no respondió correctamente. Inténtalo más tarde.";
  }
}

export const mediaRouter = createRouter({
  list: adminQuery.query(async ({ ctx }) => {
    const rows = await getDb().select().from(mediaAssets)
      .where(eq(mediaAssets.ownerId, ctx.user.id)).orderBy(desc(mediaAssets.createdAt)).limit(100);
    if (!rows.length) return [];
    const signed = await storage.getPresignedUrls({ keys: rows.map((row) => row.storageKey) });
    const urls = new Map(signed.urls.map((item) => [item.key, item.url]));
    return rows.map((row) => ({ ...row, url: urls.get(row.storageKey) ?? null }));
  }),

  upload: adminQuery.input(z.object({
    name: z.string().trim().min(1).max(180),
    contentBase64: z.string().min(1).max(56_000_000),
    contentType: z.string().trim().max(120).refine((value) => /^(image|video)\/[a-zA-Z0-9.+-]+$/.test(value), "Solo imágenes o videos"),
    category: z.enum(MEDIA_CATEGORIES).default("other"),
    customerId: z.number().int().positive().optional(),
  })).mutation(async ({ ctx, input }) => {
    if (input.customerId) {
      const customer = await findOwnedCustomer(ctx.user.id, input.customerId);
      if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado o sin permiso." });
    }
    const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo debe pesar entre 1 byte y 40 MB." });
    }
    const safeName = Array.from(input.name.replace(/[\\/]/g, "-").replace(/\.\./g, ".")).filter((character) => character.charCodeAt(0) >= 32).join("").slice(0, 160);
    try {
      const saved = await storage.uploadFile({
        fileContent: bytes,
        fileName: `u/${ctx.user.id}/${safeName}`,
        contentType: input.contentType,
      });
      const [created] = await getDb().insert(mediaAssets).values({
        ownerId: ctx.user.id,
        customerId: input.customerId,
        storageKey: saved.key,
        fileName: input.name,
        contentType: saved.contentType,
        size: saved.size,
        category: input.category,
      }).$returningId();
      await addBusinessAudit(ctx.user.id, input.category === "marketing" ? "marketing" : "operations", ctx.user.name ?? "Administrador", `Archivo guardado: ${input.name}.`);
      return { ...created, key: saved.key };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "BAD_REQUEST", message: storageMessage(error) });
    }
  }),

  uploadCustomer: authedQuery.input(z.object({
    name: z.string().trim().min(1).max(180),
    contentBase64: z.string().min(1).max(56_000_000),
    contentType: z.string().trim().max(120).refine((value) => /^(image|video)\/[a-zA-Z0-9.+-]+$/.test(value), "Solo imágenes o videos"),
  })).mutation(async ({ ctx, input }) => {
    const context = await getPortalAccount(ctx.user.id);
    if (!context) throw new TRPCError({ code: "NOT_FOUND", message: "Vincula tu cuenta de cliente antes de subir archivos." });
    const bytes = Uint8Array.from(Buffer.from(input.contentBase64, "base64"));
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo debe pesar entre 1 byte y 40 MB." });
    const safeName = Array.from(input.name.replace(/[\\/]/g, "-").replace(/\.\./g, ".")).filter((character) => character.charCodeAt(0) >= 32).join("").slice(0, 160);
    try {
      const saved = await storage.uploadFile({ fileContent: bytes, fileName: `u/${context.account.ownerId}/customer/${context.customer.id}/${safeName}`, contentType: input.contentType });
      const [created] = await getDb().insert(mediaAssets).values({
        ownerId: context.account.ownerId,
        customerId: context.customer.id,
        storageKey: saved.key,
        fileName: input.name,
        contentType: saved.contentType,
        size: saved.size,
        category: "customer",
      }).$returningId();
      await addBusinessAudit(context.account.ownerId, "support", ctx.user.name ?? context.customer.name, `El cliente compartió un archivo: ${input.name}.`);
      return created;
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: storageMessage(error) });
    }
  }),

  remove: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const [row] = await getDb().select().from(mediaAssets)
      .where(and(eq(mediaAssets.id, input.id), eq(mediaAssets.ownerId, ctx.user.id))).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Archivo no encontrado o sin permiso." });
    try {
      await storage.deleteFile({ fileKey: row.storageKey });
      await getDb().delete(mediaAssets).where(and(eq(mediaAssets.id, row.id), eq(mediaAssets.ownerId, ctx.user.id)));
      await addBusinessAudit(ctx.user.id, "security", ctx.user.name ?? "Administrador", `Archivo eliminado: ${row.fileName}.`);
      return { ok: true };
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: storageMessage(error) });
    }
  }),
});
