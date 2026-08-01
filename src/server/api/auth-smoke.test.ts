import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";

import { db } from "~/server/db";
import { appRouter } from "./root";

/**
 * Procedures that are intentionally reachable without a session.
 *
 * Anything not listed here must reject an anonymous caller. Adding a new
 * `publicProcedure` without updating this set fails the test below, which is
 * the point: opening an endpoint to the internet should be a deliberate,
 * reviewed act rather than a one-word edit.
 */
const PUBLIC_PROCEDURES = new Set([
  "profile.requestPasswordReset",
  "profile.resetPassword",
  "company.getInvitation",
]);

/** A context with no session, as an unauthenticated HTTP request would produce. */
function anonymousContext() {
  return { db, session: null, headers: new Headers() };
}

function procedurePaths() {
  return Object.keys(appRouter._def.procedures).sort();
}

/**
 * Invokes a procedure by dotted path with no input.
 *
 * The auth middleware runs before input parsing, so a protected procedure
 * rejects with UNAUTHORIZED before it ever looks at the payload or touches the
 * database — which is what lets this suite run without a live DB.
 */
async function callAnonymously(path: string) {
  const caller = appRouter.createCaller(anonymousContext());
  const procedure = path
    .split(".")
    .reduce<Record<string, unknown>>(
      (node, segment) => node[segment] as Record<string, unknown>,
      caller as unknown as Record<string, unknown>,
    );

  await (procedure as unknown as (input?: unknown) => Promise<unknown>)(
    undefined,
  );
}

function errorCode(error: unknown) {
  return error instanceof TRPCError ? error.code : null;
}

describe("tRPC authorization smoke test", () => {
  test("every procedure is reachable for enumeration", () => {
    // Guards against the reduce-based lookup silently matching nothing if the
    // router shape changes.
    expect(procedurePaths().length).toBeGreaterThan(0);
  });

  test("protected procedures reject anonymous callers with UNAUTHORIZED", async () => {
    const protectedPaths = procedurePaths().filter(
      (path) => !PUBLIC_PROCEDURES.has(path),
    );

    // Run concurrently: the timing middleware sleeps 100-500ms per call in dev,
    // which would otherwise make this suite take minutes.
    const results = await Promise.all(
      protectedPaths.map(async (path) => {
        try {
          await callAnonymously(path);
          return { path, code: null };
        } catch (error) {
          return { path, code: errorCode(error) };
        }
      }),
    );

    const leaked = results.filter((result) => result.code !== "UNAUTHORIZED");
    expect(leaked).toEqual([]);
  });

  test("public procedures do not reject on authentication", async () => {
    const results = await Promise.all(
      [...PUBLIC_PROCEDURES].map(async (path) => {
        try {
          await callAnonymously(path);
          return { path, code: null };
        } catch (error) {
          return { path, code: errorCode(error) };
        }
      }),
    );

    // Calling with no input makes these fail Zod validation, which is fine —
    // the assertion is only that they are not gated behind a session.
    const gated = results.filter((result) => result.code === "UNAUTHORIZED");
    expect(gated).toEqual([]);
  });
});
