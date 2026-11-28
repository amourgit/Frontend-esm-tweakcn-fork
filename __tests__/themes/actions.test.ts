import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { defaultThemeState } from "@/config/theme";
import { seedSystemThemes, type ThemeDb } from "@/lib/themes";
import { createTestDb, insertUser } from "./db-helper";
import { styleVariant } from "./fixtures";

// Les server actions lisent la base et la session : on les branche sur PGlite et sur une identité contrôlée.
const h = vi.hoisted(() => ({ db: null as unknown, userId: null as string | null }));
vi.mock("@/db", () => ({ get db() { return h.db; } }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => (h.userId ? { user: { id: h.userId } } : null) } },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import {
  createTheme,
  createThemeVersion,
  deleteTheme,
  getSystemThemes,
  getThemeDetails,
  getThemeForEditor,
  getThemeRevisions,
  getThemes,
  restoreThemeRevision,
  saveThemeState,
} from "@/actions/themes";

const styles = defaultThemeState.styles;
let db: ReturnType<typeof drizzle<typeof schema>>;

async function expectRejects(p: Promise<unknown>, name: string) {
  await expect(p).rejects.toMatchObject({ name });
}

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  ({ db } = await createTestDb());
  h.db = db;
  await insertUser(db, "alice");
  await insertUser(db, "bob");
  h.userId = "alice";
});

describe("server actions — contrat et propriété", () => {
  it("exigent une session pour écrire, mais pas pour lire les thèmes système", async () => {
    h.userId = null;
    await expectRejects(createTheme({ name: "X", styles }), "UnauthorizedError");
    await expectRejects(saveThemeState({ id: "x", name: "Y" }), "UnauthorizedError");
    await expectRejects(getThemes(), "UnauthorizedError");
    expect((await getSystemThemes()).length).toBeGreaterThan(42); // seed de garde-fou : base vide → importée
    expect((await getThemeDetails("modern-minimal")).author.type).toBe("system");
    expect(await getThemeRevisions("modern-minimal")).toHaveLength(1);
    expect((await getThemeForEditor("default")).isDefault).toBe(true);
  });

  it("valide les entrées", async () => {
    await expectRejects(createTheme({ name: "   ", styles }), "ValidationError");
    await expectRejects(createTheme({ name: "x".repeat(51), styles }), "ValidationError");
    await expectRejects(saveThemeState({ id: "t" }), "ValidationError"); // rien à enregistrer
  });

  it("crée un thème (état 1 + version 1), l'auteur vient de la session, jamais du client", async () => {
    const res = await createTheme({
      name: "Mon thème",
      styles,
      metadata: { author: { type: "system", id: null, name: "system" }, tags: ["a"] },
    });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data).toMatchObject({ userId: "alice", source: "USER", currentRevision: 1, currentVersion: 1 });
    expect(res.data.metadata).toMatchObject({ tags: ["a"], author: { type: "user", id: "alice", name: "alice" } });
    expect((await getThemes()).map((t) => t.name)).toEqual(["Mon thème"]);
  });

  it("dérive d'un thème système avec provenance relevée par le serveur", async () => {
    await seedSystemThemes(db as unknown as ThemeDb);
    const res = await createTheme({ name: "Copie", styles: styleVariant("#abcdef"), derivedFromThemeId: "modern-minimal" });
    expect(res.success && res.data.metadata).toMatchObject({
      derivedFrom: { themeId: "modern-minimal", themeName: "Modern Minimal", revision: 1, version: 1 },
    });
  });

  it("enregistre un état, puis une version sur un état précis ; conflits et doublons en erreurs typées", async () => {
    const created = await createTheme({ name: "T", styles });
    if (!created.success) throw new Error("create failed");
    const id = created.data.id;

    const s2 = await saveThemeState({ id, styles: styleVariant("#222222"), message: "deux" });
    expect(s2).toMatchObject({ success: true, data: { currentRevision: 2, currentVersion: 1, revisionCreated: true, versionCreated: false } });

    const same = await saveThemeState({ id, styles: styleVariant("#222222") });
    expect(same).toMatchObject({ success: true, data: { revisionCreated: false } });

    const conflict = await saveThemeState({ id, styles: styleVariant("#333333"), baseRevision: 1 });
    expect(conflict).toMatchObject({ success: false, error: { code: "THEME_REVISION_CONFLICT" } });

    const v2 = await createThemeVersion({ themeId: id, revision: 2, notes: "stable" });
    expect(v2).toMatchObject({ success: true, data: { createdVersion: 2, currentVersion: 2 } });
    const dup = await createThemeVersion({ themeId: id, revision: 2 });
    expect(dup).toMatchObject({ success: false, error: { code: "THEME_ALREADY_VERSIONED" } });

    const withRelease = await saveThemeState({ id, styles: styleVariant("#444444"), release: { notes: "v3" } });
    expect(withRelease).toMatchObject({ success: true, data: { currentRevision: 3, currentVersion: 3, versionCreated: true } });

    const restored = await restoreThemeRevision(id, 1);
    expect(restored).toMatchObject({ success: true, data: { currentRevision: 4, revisionCreated: true } });
    expect((await getThemeRevisions(id)).map((r) => r.revision)).toEqual([4, 3, 2, 1]);
  });

  it("thème système : lecture seule, erreur typée, suppression interdite", async () => {
    await seedSystemThemes(db as unknown as ThemeDb);
    expect(await saveThemeState({ id: "modern-minimal", name: "Pirate" })).toMatchObject({ success: false, error: { code: "THEME_FORBIDDEN" } });
    expect(await createThemeVersion({ themeId: "modern-minimal" })).toMatchObject({ success: false, error: { code: "THEME_FORBIDDEN" } });
    expect(await restoreThemeRevision("modern-minimal", 1)).toMatchObject({ success: false, error: { code: "THEME_FORBIDDEN" } });
    await expectRejects(deleteTheme("modern-minimal"), "ThemeForbiddenError");
    await expectRejects(deleteTheme("default"), "ThemeForbiddenError");
  });

  it("un autre utilisateur ne voit ni ne touche le thème d'autrui", async () => {
    const created = await createTheme({ name: "Privé", styles });
    if (!created.success) throw new Error("create failed");
    const id = created.data.id;

    h.userId = "bob";
    await expectRejects(saveThemeState({ id, name: "Vol" }), "ThemeNotFoundError");
    await expectRejects(createThemeVersion({ themeId: id }), "ThemeNotFoundError");
    await expectRejects(restoreThemeRevision(id, 1), "ThemeNotFoundError");
    await expectRejects(deleteTheme(id), "ThemeNotFoundError");
    await expectRejects(getThemeForEditor(id), "ThemeNotFoundError");
    await expectRejects(getThemeDetails(id), "ThemeNotFoundError");
    await expectRejects(getThemeRevisions(id), "ThemeNotFoundError");
    await expectRejects(createTheme({ name: "Vol", styles, derivedFromThemeId: id }), "ThemeNotFoundError");
    expect(await getThemes()).toHaveLength(0);

    h.userId = null; // même sans compte
    await expectRejects(getThemeDetails(id), "ThemeNotFoundError");

    h.userId = "alice";
    expect((await getThemeDetails(id)).name).toBe("Privé");
    expect(await deleteTheme(id)).toMatchObject({ name: "Privé" });
  });
});
