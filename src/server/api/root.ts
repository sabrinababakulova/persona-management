import { candidatesRouter } from "~/server/api/routers/candidates";
import { dashboardRouter } from "~/server/api/routers/dashboard";
import { lookupsRouter } from "~/server/api/routers/lookups";
import { postRouter } from "~/server/api/routers/post";
import { profileRouter } from "~/server/api/routers/profile";
import { vacanciesRouter } from "~/server/api/routers/vacancies";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  dashboard: dashboardRouter,
  vacancies: vacanciesRouter,
  candidates: candidatesRouter,
  lookups: lookupsRouter,
  profile: profileRouter,
});

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
