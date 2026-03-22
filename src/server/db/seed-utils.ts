import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "~/server/db/schema";

export const DEFAULT_COMPANY_ID = "00000000-0000-0000-0000-000000000001";

export type SeedDb = PostgresJsDatabase<typeof schema>;

type SeedRunner = (db: SeedDb) => Promise<void>;

function getDatabaseUrl() {
  const rawDatabaseUrl = process.env.DATABASE_URL;

  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_URL is required to run database seeds.");
  }

  const parsedUrl = new URL(rawDatabaseUrl);

  // Local Docker Postgres in this project binds to IPv4 loopback, so prefer it explicitly.
  if (parsedUrl.hostname === "localhost") {
    parsedUrl.hostname = "127.0.0.1";
  }

  return parsedUrl;
}

function formatDatabaseTarget(databaseUrl: URL) {
  const port = databaseUrl.port || "5432";
  const databaseName = databaseUrl.pathname.replace(/^\//, "") || "postgres";

  return `${databaseUrl.hostname}:${port}/${databaseName}`;
}

function toSeedConnectionError(error: unknown, databaseUrl: URL) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

  const connectionCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ENETUNREACH",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "ETIMEDOUT",
  ]);

  if (!code || !connectionCodes.has(code)) {
    return error;
  }

  return new Error(
    `Unable to connect to PostgreSQL at ${formatDatabaseTarget(databaseUrl)}. Start the local database with ./scripts/start-database.sh or update DATABASE_URL to a reachable server.`,
    { cause: error },
  );
}

export async function runSeedScript(seedName: string, seedRunner: SeedRunner) {
  const databaseUrl = getDatabaseUrl();
  const client = postgres(databaseUrl.toString());
  const db = drizzle(client, { schema });

  try {
    await client`select 1`;
    await seedRunner(db);
  } catch (error) {
    throw toSeedConnectionError(error, databaseUrl);
  } finally {
    await client.end();
  }

  console.log(`${seedName} completed successfully.`);
}
