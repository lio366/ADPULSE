import { z } from "zod";
import { adminQuery, createRouter, publicQuery } from "./middleware";
import { createLead, findLeads, updateLeadStatus } from "./queries/leads";

const planSchema = z.enum(["pilot", "growth", "multilocation"]);
const statusSchema = z.enum(["new", "contacted", "qualified", "customer", "closed"]);
const cleanText = (max: number) => z.string().trim().min(1).max(max);

export const leadRouter = createRouter({
  create: publicQuery
    .input(z.object({
      name: cleanText(120),
      businessName: cleanText(160),
      email: z.string().trim().toLowerCase().email().max(320),
      phone: z.string().trim().max(40).optional(),
      city: cleanText(120),
      businessType: cleanText(100),
      plan: planSchema,
      message: z.string().trim().max(2000).optional(),
      consent: z.literal("yes"),
      website: z.string().max(0).optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await createLead({
        name: input.name,
        businessName: input.businessName,
        email: input.email,
        phone: input.phone,
        city: input.city,
        businessType: input.businessType,
        plan: input.plan,
        message: input.message,
        consent: input.consent,
        source: "website",
      });
      return { ok: true, id: result?.id };
    }),

  list: adminQuery
    .input(z.object({
      status: statusSchema.optional(),
      search: z.string().trim().max(120).optional(),
    }).optional())
    .query(({ input }) => findLeads(input)),

  updateStatus: adminQuery
    .input(z.object({ id: z.number().int().positive(), status: statusSchema }))
    .mutation(async ({ input }) => {
      const [lead] = await updateLeadStatus(input.id, input.status);
      return lead;
    }),
});
