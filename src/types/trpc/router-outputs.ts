import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./app-router";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
