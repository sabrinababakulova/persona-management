import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "./app-router";

export type RouterInputs = inferRouterInputs<AppRouter>;
