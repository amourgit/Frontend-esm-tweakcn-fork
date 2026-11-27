import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import fs from "fs";
import path from "path";
import * as schema from "@/db/schema";

const DRIZZLE_DIR = path.join(process.cwd(), "drizzle");

/** Exécute un fichier de migration drizzle (instructions séparées par `--> statement-breakpoint`). */
export async function applyMigrationFile(client: PGlite, file: string) {
  const sql = fs.readFileSync(path.join(DRIZZLE_DIR, file), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    if (statement.trim()) await client.exec(statement);
  }
}

export function migrationFiles(): string[] {
  return fs
    .readdirSync(DRIZZLE_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
}

/** Base PostgreSQL en mémoire (PGlite) avec TOUTES les migrations du dépôt appliquées. */
export async function createTestDb() {
  const client = new PGlite();
  for (const file of migrationFiles()) await applyMigrationFile(client, file);
  return { client, db: drizzle(client, { schema }) };
}

export async function insertUser(db: ReturnType<typeof drizzle>, id: string) {
  const at = new Date();
  await db.insert(schema.user).values({
    id,
    name: id,
    email: `${id}@example.org`,
    emailVerified: true,
    createdAt: at,
    updatedAt: at,
  });
}
