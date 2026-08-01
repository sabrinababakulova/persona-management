/**
 * Applies pending migrations from `/drizzle`.
 *
 * Unlike `drizzle-kit migrate`, this one survives a database that is ahead of its ledger.
 * Production deploys run `bun run db:push`, which changes the schema without recording anything
 * in `drizzle.__drizzle_migrations`, so a plain migrator replays old migrations and dies on
 * "column already exists". Here every statement runs inside its own savepoint, and the errors
 * that mean "this change is already in place" are skipped instead of aborting the run. Any
 * other error still fails the migration, and each migration is recorded once it completes.
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

    await sql.begin(async (tx) => {
      for (const statement of statements) {
        try {
          // A savepoint keeps one skippable statement from aborting the whole migration.
          await tx.savepoint(async (savepoint) => {
            await savepoint.unsafe(statement);
          });
        } catch (error) {
          if (!isAlreadyApplied(error, statement)) {
            if (skipped > 0) {
              // Part of this migration was already in place, so we are replaying history over
              // a newer database. A failure here is usually an obsolete constraint that later
              // migrations remove but current data no longer satisfies.
              console.error(
                `\nStatement failed while replaying an already-applied migration (${migration.folderMillis}):\n  ${statement}\nThe database is ahead of the migration ledger. If this statement is obsolete, ` +
                  `run 'bun run db:push' to sync the schema from schema.ts instead.\n`,
              );
            }
            throw error;
          }
          skipped += 1;
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
} catch (err) {
  console.error("migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
