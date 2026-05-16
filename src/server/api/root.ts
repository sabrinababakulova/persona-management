import { candidatesRouter } from "~/server/api/routers/candidates";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { integrationsRouter } from "~/server/api/routers/integrations";
import { lookupsRouter } from "~/server/api/routers/lookups";
import { profileRouter } from "~/server/api/routers/profile";
import { storageRouter } from "~/server/api/routers/storage";
import { vacanciesRouter } from "~/server/api/routers/vacancies";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  dashboard: dashboardRouter,
  vacancies: vacanciesRouter,
  candidates: candidatesRouter,
  lookups: lookupsRouter,
  profile: profileRouter,
  integrations: integrationsRouter,
  storage: storageRouter,
});

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
