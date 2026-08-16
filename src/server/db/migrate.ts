/**
 * Applies pending migrations from `/drizzle`.
 *
 * Unlike `drizzle-kit migrate`, this one survives a database that is ahead of its ledger because
 * it was historically maintained with `db:push`. Every statement runs inside its own savepoint,
 * and errors meaning "this change is already in place" are skipped instead of aborting the run.
 * Any other error fails the deployment, and a migration is recorded only after all of its
 * statements have completed or been safely identified as already applied.
 */
import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

import { env } from "~/env";

/** Postgres error codes for "the object this statement creates already exists". */
const ALREADY_EXISTS_CODES = new Set([
  "42701", // duplicate_column
  "42P07", // duplicate_table (also indexes)
  "42710", // duplicate_object (constraints, types)
  "42P06", // duplicate_schema
  "42723", // duplicate_function
]);

/** Postgres error codes for "the object this statement removes is not there". */
const NOT_FOUND_CODES = new Set([
  "42703", // undefined_column
  "42704", // undefined_object (constraints, indexes)
  "42P01", // undefined_table
]);

function getErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

function getErrorField(error: unknown, field: string) {
  if (typeof error !== "object" || error === null || !(field in error)) {
    return "";
  }

  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" ? value.trim() : "";
}

function formatDatabaseError(error: unknown) {
  const fields = [
    ["code", getErrorCode(error)],
    ["message", error instanceof Error ? error.message : String(error)],
    ["detail", getErrorField(error, "detail")],
    ["hint", getErrorField(error, "hint")],
    ["table", getErrorField(error, "table_name")],
    ["column", getErrorField(error, "column_name")],
    ["constraint", getErrorField(error, "constraint_name")],
  ].filter((entry) => entry[1]);

  return fields.map(([label, value]) => `  ${label}: ${value}`).join("\n");
}

/**
 * True when the statement's effect is already reflected in the database.
 *
 * "Already exists" is safe to skip for any statement. "Does not exist" is only skipped for
 * statements that remove something — anywhere else a missing object is a real failure.
 */
function isAlreadyApplied(error: unknown, statement: string) {
  const code = getErrorCode(error);

  if (ALREADY_EXISTS_CODES.has(code)) {
    return true;
  }

  return NOT_FOUND_CODES.has(code) && /\bDROP\b/i.test(statement);
}

const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => undefined });

try {
  const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });

  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const ledger = await sql<
    { hash: string }[]
  >`SELECT hash FROM "drizzle"."__drizzle_migrations"`;
  const applied = new Set(ledger.map((row) => row.hash));

  const pending = migrations.filter(
    (migration) => !applied.has(migration.hash),
  );

  if (pending.length === 0) {
    console.log("No pending migrations — the database is up to date.");
  }

  for (const migration of pending) {
    const statements = migration.sql
      .map((statement) => statement.trim())
      .filter(Boolean);
    let skipped = 0;

    console.log(
      `Applying migration ${migration.folderMillis} (${statements.length} statement(s))...`,
    );

    await sql.begin(async (tx) => {
      for (const [statementIndex, statement] of statements.entries()) {
        try {
          // A savepoint keeps one skippable statement from aborting the whole migration.
          await tx.savepoint(async (savepoint) => {
            await savepoint.unsafe(statement);
          });
        } catch (error) {
          if (!isAlreadyApplied(error, statement)) {
            console.error(
              `\nMigration ${migration.folderMillis} failed at statement ${statementIndex + 1}/${statements.length}:\n${statement}\n${formatDatabaseError(error)}\n`,
            );
            if (skipped > 0) {
              console.error(
                `${skipped} earlier statement(s) in this migration were already present. Add a corrective SQL migration if this statement is obsolete; do not use db:push in production.\n`,
              );
            }
            throw error;
          }
          skipped += 1;
          console.log(
            `  Skipped statement ${statementIndex + 1}/${statements.length}: already in place (PostgreSQL ${getErrorCode(error)}).`,
          );
        }
      }

      await tx`
        INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
        VALUES (${migration.hash}, ${migration.folderMillis})
      `;
    });

    const detail =
      skipped === 0
        ? `${statements.length} statement(s)`
        : `${statements.length - skipped} statement(s), ${skipped} already in place`;
    console.log(`Applied ${migration.folderMillis} — ${detail}`);
  }

  if (pending.length > 0) {
    console.log(`\n${pending.length} migration(s) applied successfully!`);
  }
} catch (error) {
  console.error(`Database migration failed.\n${formatDatabaseError(error)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
