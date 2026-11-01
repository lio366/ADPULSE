import { authRouter } from "./auth-router";
import { leadRouter } from "./lead-router";
import { businessRouter } from "./business-router";
import { mediaRouter } from "./media-router";
import { portalRouter } from "./portal-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  leads: leadRouter,
  business: businessRouter,
  media: mediaRouter,
  portal: portalRouter,
});

export type AppRouter = typeof appRouter;
