import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { theme as themeTable, themeRevision, themeVersion } from "@/db/schema";
import { DEFAULT_THEME_ID, getDefaultTheme, getSystemPresets, listSystemThemes, saveRevision, seedSystemThemes, type ThemeDb } from "@/lib/themes";
import { defaultPresets } from "@/utils/theme-presets";
import { getBuiltInThemeStyles } from "@/utils/theme-preset-helper";
import { defaultThemeState } from "@/config/theme";
import { createTestDb } from "./db-helper";

const SYSTEM_COUNT = Object.keys(defaultPresets).length + 1; // 42 thèmes livrés + le thème par défaut

let db: ReturnType<typeof drizzle<typeof schema>>;
let t: ThemeDb;
beforeEach(async () => {
  ({ db } = await createTestDb());
  t = db as unknown as ThemeDb;
});

describe("seed des thèmes système", () => {
  it("importe les 42 thèmes livrés et le thème par défaut : état 1 + version 1, auteur système", async () => {
    expect(await seedSystemThemes(t)).toEqual({ inserted: SYSTEM_COUNT, existing: 0 });
    const rows = await listSystemThemes(t);
    expect(rows).toHaveLength(SYSTEM_COUNT);
    expect(SYSTEM_COUNT).toBeGreaterThan(42);
    for (const row of rows) {
      expect(row).toMatchObject({ source: "BUILT_IN", userId: null, currentRevision: 1, currentVersion: 1 });
      expect(row.metadata).toMatchObject({ author: { type: "system", id: null, name: "system" }, seed: { key: row.id } });
    }
    expect(await db.select().from(themeRevision)).toHaveLength(SYSTEM_COUNT);
    const versions = await db.select().from(themeVersion);
    expect(versions).toHaveLength(SYSTEM_COUNT);
    expect(versions.every((v) => v.version === 1 && v.createdBy === null)).toBe(true);
    const revs = await db.select().from(themeRevision);
    expect(revs.every((r) => r.origin === "SEED" && r.revision === 1 && r.parentRevision === null)).toBe(true);
  });

  it("le thème par défaut est un thème comme les autres, marqué par l'attribut is_default (un seul)", async () => {
    await seedSystemThemes(t);
    const def = await getDefaultTheme(t);
    expect(def).toMatchObject({ id: DEFAULT_THEME_ID, name: "Default", source: "BUILT_IN", isDefault: true });
    expect(def!.styles).toEqual(defaultThemeState.styles);
    const flagged = (await db.select().from(themeTable)).filter((r) => r.isDefault);
    expect(flagged).toHaveLength(1);
  });

  it("stocke exactement les styles que l'ancien chargement depuis fichier produisait", async () => {
    await seedSystemThemes(t);
    for (const row of await listSystemThemes(t)) {
      if (row.id === DEFAULT_THEME_ID) continue;
      const fromFile = getBuiltInThemeStyles(row.id)!;
      expect(row.name).toBe(fromFile.name);
      expect(row.styles).toEqual(fromFile.styles);
    }
  });

  it("est idempotent : un redémarrage ne crée aucun doublon", async () => {
    await seedSystemThemes(t);
    expect(await seedSystemThemes(t)).toEqual({ inserted: 0, existing: SYSTEM_COUNT });
    expect(await db.select().from(themeTable)).toHaveLength(SYSTEM_COUNT);
    expect(await db.select().from(themeRevision)).toHaveLength(SYSTEM_COUNT);
    expect(await db.select().from(themeVersion)).toHaveLength(SYSTEM_COUNT);
  });

  it("supporte deux démarrages simultanés", async () => {
    await Promise.all([seedSystemThemes(t), seedSystemThemes(t)]);
    expect(await db.select().from(themeTable)).toHaveLength(SYSTEM_COUNT);
    expect(await db.select().from(themeVersion)).toHaveLength(SYSTEM_COUNT);
  });

  it("ne réécrit jamais un thème existant (la base fait foi)", async () => {
    await seedSystemThemes(t);
    await db.update(themeTable).set({ name: "Renommé en base" }).where(eq(themeTable.id, "modern-minimal"));
    await seedSystemThemes(t);
    const [row] = await db.select().from(themeTable).where(eq(themeTable.id, "modern-minimal"));
    expect(row.name).toBe("Renommé en base");
  });

  it("un thème système ne peut pas être modifié, même par un utilisateur connecté", async () => {
    await seedSystemThemes(t);
    await expect(saveRevision(t, "modern-minimal", "alice", { name: "Pirate" })).rejects.toMatchObject({ name: "ThemeForbiddenError" });
    expect(getSystemPresets()[DEFAULT_THEME_ID].label).toBe("Default");
  });
});
