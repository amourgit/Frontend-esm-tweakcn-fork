import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { defaultThemeState } from "@/config/theme";
import { applyMigrationFile, insertUser, migrationFiles } from "./db-helper";

const STYLES = JSON.stringify(defaultThemeState.styles);

describe("migrations — reprise d'une base existante", () => {
  it("0000 → 0001 → 0002 : états conservés, versions reprises, auteurs renseignés", async () => {
    const client = new PGlite();
    const files = migrationFiles();
    expect(files.length).toBeGreaterThanOrEqual(3);

    await applyMigrationFile(client, files[0]); // schéma d'origine, sans historique
    const db = drizzle(client, { schema });
    await insertUser(db, "carol");
    await client.query(
      `INSERT INTO "theme" ("id","user_id","name","styles","created_at","updated_at") VALUES ('legacy-1','carol','Ancien thème',$1,now(),now())`,
      [STYLES]
    );
    await applyMigrationFile(client, files[1]); // 0001 : « versions » (en fait des états)
    // Un thème système modifié sous 0001 (états 1 et 2, auteur inconnu) et un 2e état pour le thème de Carol.
    await client.query(
      `INSERT INTO "theme" ("id","user_id","source","name","styles","current_version","created_at","updated_at") VALUES ('sys-1',NULL,'BUILT_IN','Système',$1,2,now(),now())`,
      [STYLES]
    );
    await client.query(
      `INSERT INTO "theme_version" ("id","theme_id","version","name","styles","origin","content_hash","created_by","created_at") VALUES
        ('s1','sys-1',1,'Système',$1,'SEED','h',NULL,now()),
        ('s2','sys-1',2,'Système',$1,'UPDATE','h',NULL,now()),
        ('c2','legacy-1',2,'Ancien thème v2',$1,'UPDATE','h','carol',now())`,
      [STYLES]
    );
    await client.query(`UPDATE "theme" SET "current_version" = 2 WHERE "id" = 'legacy-1'`);

    await applyMigrationFile(client, files[2]); // 0002 : états / versions / défaut / auteurs

    const revisions = await client.query<{ theme_id: string; revision: number; parent_revision: number | null; origin: string }>(
      `SELECT theme_id, revision, parent_revision, origin FROM theme_revision ORDER BY theme_id, revision`
    );
    expect(revisions.rows).toEqual([
      { theme_id: "legacy-1", revision: 1, parent_revision: null, origin: "CREATE" },
      { theme_id: "legacy-1", revision: 2, parent_revision: 1, origin: "SAVE" },
      { theme_id: "sys-1", revision: 1, parent_revision: null, origin: "SEED" },
      { theme_id: "sys-1", revision: 2, parent_revision: 1, origin: "SAVE" },
    ]);

    // chaque état existant devient une version du même numéro : rien de ce que l'utilisateur voyait ne disparaît
    const versions = await client.query<{ theme_id: string; version: number }>(
      `SELECT theme_id, version FROM theme_version ORDER BY theme_id, version`
    );
    expect(versions.rows).toHaveLength(4);
    const themes = await client.query<{ id: string; current_revision: number; current_version: number; is_default: boolean }>(
      `SELECT id, current_revision, current_version, is_default FROM theme ORDER BY id`
    );
    expect(themes.rows).toEqual([
      { id: "legacy-1", current_revision: 2, current_version: 2, is_default: false },
      { id: "sys-1", current_revision: 2, current_version: 2, is_default: false },
    ]);

    const meta = await client.query<{ id: string; author: { type: string; id: string | null; name: string } }>(
      `SELECT id, metadata::jsonb->'author' AS author FROM theme ORDER BY id`
    );
    expect(meta.rows[0].author).toEqual({ type: "user", id: "carol", name: "carol" });
    expect(meta.rows[1].author).toEqual({ type: "system", id: null, name: "system" });
    const revMeta = await client.query<{ author: { type: string } }>(
      `SELECT metadata::jsonb->'author' AS author FROM theme_revision WHERE theme_id='legacy-1' AND revision=2`
    );
    expect(revMeta.rows[0].author.type).toBe("user");
  });

  it("un seul thème par défaut possible (index unique partiel)", async () => {
    const client = new PGlite();
    for (const f of migrationFiles()) await applyMigrationFile(client, f);
    const insert = (id: string) =>
      client.query(
        `INSERT INTO "theme" ("id","source","name","styles","is_default","created_at","updated_at") VALUES ($1,'BUILT_IN','x',$2,true,now(),now())`,
        [id, STYLES]
      );
    await insert("a");
    await expect(insert("b")).rejects.toThrow();
  });
});
