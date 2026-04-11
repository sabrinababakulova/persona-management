import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { env } from "~/env";

const sql = postgres(env.DATABASE_URL, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("migrations applied successfully!");
} catch (err) {
  console.error("migration failed:", err);
  process.exit(1);
} finally {
  await sql.end();
}
