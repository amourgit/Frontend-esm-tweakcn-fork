import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { theme as themeTable, themeVersion } from "@/db/schema";
import {
  createTheme,
  getThemeVersion,
  listBuiltInThemes,
  listThemeVersions,
  listUserThemes,
  restoreThemeVersion,
  saveThemeVersion,
  softDeleteTheme,
  getThemeById,
  type ThemeDb,
} from "@/lib/themes/service";
import { seedBuiltInThemes } from "@/lib/themes/seed";
import { defaultPresets } from "@/utils/theme-presets";
import { getBuiltInThemeStyles } from "@/utils/theme-preset-helper";
import { defaultThemeState } from "@/config/theme";
import { applyMigrationFile, createTestDb, insertUser, migrationFiles } from "./db-helper";

const PRESET_COUNT = Object.keys(defaultPresets).length;

function styleVariant(primary: string) {
  const s = structuredClone(defaultThemeState.styles);
  s.light.primary = primary;
  return s;
}

let db: ReturnType<typeof drizzle<typeof schema>>;
let t: ThemeDb;

beforeEach(async () => {
  ({ db } = await createTestDb());
  t = db as unknown as ThemeDb;
  await insertUser(db, "alice");
  await insertUser(db, "bob");
});

describe("migration 0001 — reprise de l'existant", () => {
  it("donne une version 1 à chaque thème déjà enregistré", async () => {
    const client = new PGlite();
    const files = migrationFiles();
    await applyMigrationFile(client, files[0]); // schéma d'origine, sans versions
    const legacy = drizzle(client, { schema });
    await insertUser(legacy, "carol");
    await client.query(
      `INSERT INTO "theme" ("id","user_id","name","styles","created_at","updated_at") VALUES ('legacy-1','carol','Ancien thème',$1,now(),now())`,
      [JSON.stringify(defaultThemeState.styles)]
    );
    for (const f of files.slice(1)) await applyMigrationFile(client, f);

    const versions = await legacy.select().from(themeVersion);
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ themeId: "legacy-1", version: 1, name: "Ancien thème", origin: "CREATE", createdBy: "carol" });
    const [row] = await legacy.select().from(themeTable);
    expect(row).toMatchObject({ source: "USER", currentVersion: 1, deletedAt: null });
  });
});

describe("seed des thèmes livrés", () => {
  it("importe chaque preset en version 1, avec métadonnées", async () => {
    const result = await seedBuiltInThemes(t, defaultPresets);
    expect(result).toEqual({ inserted: PRESET_COUNT, existing: 0 });

    const builtIns = await listBuiltInThemes(t);
    expect(builtIns).toHaveLength(PRESET_COUNT);
    expect(PRESET_COUNT).toBeGreaterThan(40);
    for (const row of builtIns) {
      expect(row).toMatchObject({ source: "BUILT_IN", userId: null, currentVersion: 1 });
      expect(row.metadata).toMatchObject({ origin: "tweakcn-official", seed: { key: row.id } });
    }
    const versions = await db.select().from(themeVersion);
    expect(versions).toHaveLength(PRESET_COUNT);
    expect(versions.every((v) => v.version === 1 && v.origin === "SEED")).toBe(true);
  });

  it("stocke exactement les styles que l'ancien chargement depuis fichier produisait", async () => {
    await seedBuiltInThemes(t, defaultPresets);
    for (const row of await listBuiltInThemes(t)) {
      const fromFile = getBuiltInThemeStyles(row.id)!;
      expect(row.name).toBe(fromFile.name);
      expect(row.styles).toEqual(fromFile.styles);
    }
  });

  it("est idempotent : un redémarrage ne crée aucun doublon", async () => {
    await seedBuiltInThemes(t, defaultPresets);
    const second = await seedBuiltInThemes(t, defaultPresets);
    expect(second).toEqual({ inserted: 0, existing: PRESET_COUNT });
    expect(await db.select().from(themeTable)).toHaveLength(PRESET_COUNT);
    expect(await db.select().from(themeVersion)).toHaveLength(PRESET_COUNT);
  });

  it("supporte deux démarrages simultanés", async () => {
    await Promise.all([seedBuiltInThemes(t, defaultPresets), seedBuiltInThemes(t, defaultPresets)]);
    expect(await db.select().from(themeTable)).toHaveLength(PRESET_COUNT);
    expect(await db.select().from(themeVersion)).toHaveLength(PRESET_COUNT);
  });

  it("ne réécrit jamais un thème déjà modifié (la base fait foi)", async () => {
    await seedBuiltInThemes(t, defaultPresets);
    await saveThemeVersion(t, "modern-minimal", "alice", { styles: styleVariant("#123456"), changeNote: "ajustement" });
    await seedBuiltInThemes(t, defaultPresets);

    const [row] = await db.select().from(themeTable).where(eq(themeTable.id, "modern-minimal"));
    expect(row.currentVersion).toBe(2);
    expect(row.styles.light.primary).toBe("#123456");
    expect(await listThemeVersions(t, "modern-minimal")).toHaveLength(2);
  });
});

describe("versionnement", () => {
  const base = () => ({ userId: "alice", name: "Mon thème", styles: styleVariant("#111111") });

  it("crée la version 1 avec le thème", async () => {
    const { theme, version } = await createTheme(t, { ...base(), description: "  desc  ", metadata: { tags: ["a"] }, changeNote: "première" });
    expect(theme).toMatchObject({ source: "USER", currentVersion: 1, description: "desc" });
    expect(version).toMatchObject({ version: 1, origin: "CREATE", changeNote: "première", createdBy: "alice", metadata: { tags: ["a"] } });
  });

  it("ajoute une version par modification, numérotée sans trou, et met à jour l'instantané", async () => {
    const { theme } = await createTheme(t, base());
    const r2 = await saveThemeVersion(t, theme.id, "alice", { styles: styleVariant("#222222"), changeNote: "couleur" });
    const r3 = await saveThemeVersion(t, theme.id, "alice", { name: "Renommé", description: "nouvelle description" });
    expect(r2.versionCreated && r3.versionCreated).toBe(true);
    expect(r3.theme).toMatchObject({ currentVersion: 3, name: "Renommé", description: "nouvelle description" });
    expect(r3.theme.styles.light.primary).toBe("#222222");

    const history = await listThemeVersions(t, theme.id);
    expect(history.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(history.map((v) => v.name)).toEqual(["Renommé", "Mon thème", "Mon thème"]);
    // les anciennes versions restent intactes
    expect((await getThemeVersion(t, theme.id, 1))!.styles.light.primary).toBe("#111111");
  });

  it("n'enregistre pas de version identique à la courante", async () => {
    const { theme } = await createTheme(t, base());
    const same = await saveThemeVersion(t, theme.id, "alice", { styles: styleVariant("#111111"), name: "Mon thème" });
    expect(same.versionCreated).toBe(false);
    expect(same.theme.currentVersion).toBe(1);
    expect(await listThemeVersions(t, theme.id)).toHaveLength(1);
  });

  it("une modification de métadonnées seule crée une version", async () => {
    const { theme } = await createTheme(t, base());
    const r = await saveThemeVersion(t, theme.id, "alice", { metadata: { tags: ["brand"] } });
    expect(r.versionCreated).toBe(true);
    expect(r.version.metadata).toEqual({ tags: ["brand"] });
  });

  it("refuse une sauvegarde basée sur une version dépassée", async () => {
    const { theme } = await createTheme(t, base());
    await saveThemeVersion(t, theme.id, "alice", { styles: styleVariant("#222222") });
    await expect(
      saveThemeVersion(t, theme.id, "alice", { styles: styleVariant("#333333"), baseVersion: 1 })
    ).rejects.toMatchObject({ name: "ThemeVersionConflictError", currentVersion: 2 });
    expect(await listThemeVersions(t, theme.id)).toHaveLength(2);
  });

  it("deux sauvegardes simultanées ne produisent ni trou ni doublon de numéro", async () => {
    const { theme } = await createTheme(t, base());
    await Promise.all([
      saveThemeVersion(t, theme.id, "alice", { styles: styleVariant("#aaaaaa") }),
      saveThemeVersion(t, theme.id, "alice", { styles: styleVariant("#bbbbbb") }),
    ]);
    const history = await listThemeVersions(t, theme.id);
    expect(history.map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it("cloisonne les thèmes utilisateur, mais pas les thèmes système", async () => {
    const { theme } = await createTheme(t, base());
    await expect(saveThemeVersion(t, theme.id, "bob", { name: "Pirate" })).rejects.toMatchObject({ name: "ThemeNotFoundError" });
    await expect(softDeleteTheme(t, theme.id, "bob")).rejects.toMatchObject({ name: "ThemeNotFoundError" });

    await seedBuiltInThemes(t, defaultPresets);
    const r = await saveThemeVersion(t, "modern-minimal", "bob", { description: "Adapté à l'organisation" });
    expect(r.version).toMatchObject({ version: 2, createdBy: "bob", origin: "UPDATE" });
  });

  it("restaure une ancienne version en créant une nouvelle version", async () => {
    const { theme } = await createTheme(t, base());
    await saveThemeVersion(t, theme.id, "alice", { styles: styleVariant("#222222"), name: "V2" });
    const restored = await restoreThemeVersion(t, theme.id, "alice", 1);
    expect(restored.version).toMatchObject({ version: 3, origin: "RESTORE", name: "Mon thème", changeNote: "Restauration de la version 1" });
    expect(restored.version.metadata).toMatchObject({ restoredFromVersion: 1 });
    expect(restored.theme.styles.light.primary).toBe("#111111");
    expect((await listThemeVersions(t, theme.id))).toHaveLength(3);
    // restaurer le contenu déjà courant ne crée rien
    const again = await restoreThemeVersion(t, theme.id, "alice", 3);
    expect(again.versionCreated).toBe(false);
  });

  it("supprime logiquement un thème utilisateur et conserve son historique", async () => {
    const { theme } = await createTheme(t, base());
    await saveThemeVersion(t, theme.id, "alice", { name: "V2" });
    await softDeleteTheme(t, theme.id, "alice");
    expect(await getThemeById(t, theme.id)).toBeNull();
    expect(await listUserThemes(t, "alice")).toHaveLength(0);
    await expect(saveThemeVersion(t, theme.id, "alice", { name: "X" })).rejects.toMatchObject({ name: "ThemeNotFoundError" });
    expect(await listThemeVersions(t, theme.id)).toHaveLength(2);
  });

  it("interdit la suppression d'un thème système", async () => {
    await seedBuiltInThemes(t, defaultPresets);
    await expect(softDeleteTheme(t, "modern-minimal", "alice")).rejects.toMatchObject({ name: "ThemeForbiddenError" });
    expect(await getThemeById(t, "modern-minimal")).not.toBeNull();
  });

  it("listUserThemes ne renvoie ni les thèmes système ni ceux des autres", async () => {
    await seedBuiltInThemes(t, defaultPresets);
    await createTheme(t, base());
    await createTheme(t, { ...base(), userId: "bob", name: "Autre" });
    const mine = await listUserThemes(t, "alice");
    expect(mine.map((r) => r.name)).toEqual(["Mon thème"]);
  });
});
