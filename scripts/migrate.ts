/**
 * Applique les migrations Drizzle (drizzle/*.sql) — non interactif et idempotent.
 * Utilisé au démarrage du conteneur et par `pnpm db:migrate`.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import { config } from "dotenv";
import { seedSystemThemes } from "../lib/themes/seed";

config({ path: ".env.local" });
config();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL n'est pas défini.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const folder = process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");

  // Le conteneur de base peut démarrer un peu après l'application : on réessaie.
  const maxAttempts = 30;
  for (let attempt = 1; ; attempt++) {
    try {
      const database = drizzle({ client: pool });
      await migrate(database, { migrationsFolder: folder });
      console.log("[migrate] migrations appliquées.");
      // Thèmes système (42 livrés + thème par défaut) → base, auteur : le système (idempotent).
      const seeded = await seedSystemThemes(database);
      console.log(
        `[migrate] thèmes système : ${seeded.inserted} importé(s), ${seeded.existing} déjà présent(s).`
      );
      break;
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      const retryable = ["ECONNREFUSED", "ENOTFOUND", "57P03", "ETIMEDOUT"].includes(code);
      if (!retryable || attempt >= maxAttempts) {
        console.error("[migrate] échec :", error);
        await pool.end();
        process.exit(1);
      }
      console.log(
        `[migrate] base indisponible (${code}), nouvelle tentative ${attempt}/${maxAttempts}…`
      );
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  await pool.end();
}

main();
