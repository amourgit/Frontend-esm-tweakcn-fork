import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Un seul pool par processus (évite les connexions multiples au rechargement à chaud en dev).
const globalForDb = globalThis as unknown as { __studioPool?: Pool };

let _db: NodePgDatabase | null = null;

function getDb(): NodePgDatabase {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  // SSL : piloté par l'URL (?sslmode=require) — compatible PostgreSQL local, conteneur ou Neon.
  globalForDb.__studioPool ??= new Pool({ connectionString: url, max: 10 });
  _db = drizzle({ client: globalForDb.__studioPool });
  return _db;
}

export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
