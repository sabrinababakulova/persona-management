import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { db } from "~/server/db";

type HealthComponent = {
  status: "ok" | "error";
  message?: string;
};

async function checkDirectus() {
  const baseUrl =
    env.DIRECTUS_INTERNAL_URL ?? env.DIRECTUS_PUBLIC_URL ?? env.DIRECTUS_URL;

  if (!baseUrl) {
    return {
      status: "ok" as const,
      message: "Directus URL is not configured",
    };
  }

  try {
    const response = await fetch(baseUrl, {
      method: "GET",
      signal: AbortSignal.timeout(3_000),
    });

    if (response.status >= 500) {
      return {
        status: "error" as const,
        message: `Directus returned ${response.status}`,
      };
    }

    return { status: "ok" as const };
  } catch (error) {
    return {
      status: "error" as const,
      message: error instanceof Error ? error.message : "Directus check failed",
    };
  }
}

export async function GET() {
  const startedAt = Date.now();
  const components: Record<string, HealthComponent> = {
    app: { status: "ok" },
    db: { status: "ok" },
    directus: { status: "ok" },
  };

  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    components.db = {
      status: "error",
      message: error instanceof Error ? error.message : "Database check failed",
    };
  }

  components.directus = await checkDirectus();

  const hasFailure = Object.values(components).some(
    (component) => component.status === "error",
  );

  return NextResponse.json(
    {
      status: hasFailure ? "degraded" : "ok",
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      components,
    },
    { status: hasFailure ? 503 : 200 },
  );
}
