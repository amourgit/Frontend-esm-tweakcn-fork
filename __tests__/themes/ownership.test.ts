import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  createTheme,
  createVersion,
  getRevision,
  getThemeById,
  getThemeDetails,
  listRevisions,
  listSystemThemes,
  listUserThemes,
  listVersions,
  restoreRevision,
  saveRevision,
  seedSystemThemes,
  softDeleteTheme,
  type ThemeDb,
} from "@/lib/themes";
import { createTestDb, insertUser } from "./db-helper";
import { makeUserTheme, styleVariant } from "./fixtures";

let db: ReturnType<typeof drizzle<typeof schema>>;
let t: ThemeDb;
beforeEach(async () => {
  ({ db } = await createTestDb());
  t = db as unknown as ThemeDb;
  await insertUser(db, "alice");
  await insertUser(db, "bob");
  await seedSystemThemes(t);
});

describe("chacun ne gère que ses thèmes", () => {
  it("un autre utilisateur ne peut ni modifier, ni versionner, ni restaurer, ni supprimer, ni lire", async () => {
    const theme = await makeUserTheme(t, "alice");
    const notFound = { name: "ThemeNotFoundError" };
    await expect(saveRevision(t, theme.id, "bob", { name: "Pirate" })).rejects.toMatchObject(notFound);
    await expect(createVersion(t, theme.id, "bob")).rejects.toMatchObject(notFound);
    await expect(restoreRevision(t, theme.id, "bob", 1)).rejects.toMatchObject(notFound);
    await expect(softDeleteTheme(t, theme.id, "bob")).rejects.toMatchObject(notFound);
    await expect(listRevisions(t, theme.id, "bob")).rejects.toMatchObject(notFound);
    await expect(listVersions(t, theme.id, null)).rejects.toMatchObject(notFound);
    await expect(getRevision(t, theme.id, 1, "bob")).rejects.toMatchObject(notFound);
    await expect(getThemeDetails(t, theme.id, "bob")).rejects.toMatchObject(notFound);
    // et rien n'a bougé
    expect((await getThemeById(t, theme.id))!.name).toBe("Mon thème");
    expect(await listRevisions(t, theme.id, "alice")).toHaveLength(1);
  });

  it("les thèmes système sont lisibles par tous (même sans compte) mais jamais modifiables", async () => {
    expect((await listRevisions(t, "modern-minimal", null))).toHaveLength(1);
    expect((await getThemeDetails(t, "modern-minimal", null)).author).toEqual({ type: "system", id: null, name: "system" });
    const forbidden = { name: "ThemeForbiddenError" };
    await expect(saveRevision(t, "modern-minimal", "alice", { name: "X" })).rejects.toMatchObject(forbidden);
    await expect(createVersion(t, "modern-minimal", "alice")).rejects.toMatchObject(forbidden);
    await expect(restoreRevision(t, "modern-minimal", "alice", 1)).rejects.toMatchObject(forbidden);
    await expect(softDeleteTheme(t, "modern-minimal", "alice")).rejects.toMatchObject(forbidden);
    await expect(softDeleteTheme(t, "default", "alice")).rejects.toMatchObject(forbidden);
  });

  it("dériver un thème système crée une copie qui appartient à l'utilisateur, avec sa provenance", async () => {
    const before = await getThemeById(t, "modern-minimal");
    const { theme, revision, version } = await createTheme(t, {
      actorId: "bob",
      name: "Notre Modern",
      styles: styleVariant("#abcdef"),
      derivedFromThemeId: "modern-minimal",
      metadata: { author: { type: "system", id: null, name: "system" }, tags: ["interne"] },
    });
    expect(theme).toMatchObject({ source: "USER", userId: "bob", isDefault: false, currentRevision: 1, currentVersion: 1 });
    expect(theme.metadata).toMatchObject({
      tags: ["interne"],
      author: { type: "user", id: "bob", name: "bob" }, // jamais le système, même si le client le prétend
      derivedFrom: { themeId: "modern-minimal", themeName: "Modern Minimal", revision: 1, version: 1 },
    });
    expect(revision).toMatchObject({ origin: "DERIVE", message: "Derived from “Modern Minimal”", createdBy: "bob" });
    expect(version!.version).toBe(1);
    // le thème source n'a pas bougé
    expect(await getThemeById(t, "modern-minimal")).toEqual(before);
    expect((await listUserThemes(t, "bob")).map((r) => r.id)).toEqual([theme.id]);
    expect(await listUserThemes(t, "alice")).toHaveLength(0);
  });

  it("on ne peut pas dériver du thème d'un autre utilisateur", async () => {
    const theme = await makeUserTheme(t, "alice");
    await expect(
      createTheme(t, { actorId: "bob", name: "Vol", styles: styleVariant("#000000"), derivedFromThemeId: theme.id })
    ).rejects.toMatchObject({ name: "ThemeNotFoundError" });
    const own = await createTheme(t, { actorId: "alice", name: "Copie", styles: styleVariant("#000000"), derivedFromThemeId: theme.id });
    expect(own.theme.metadata).toMatchObject({ derivedFrom: { themeId: theme.id } });
  });

  it("les modifications gardent l'auteur du thème ; chaque état porte son auteur", async () => {
    const theme = await makeUserTheme(t, "alice");
    const r = await saveRevision(t, theme.id, "alice", { name: "Renommé" });
    expect(r.theme.metadata).toMatchObject({ author: { type: "user", id: "alice" } });
    expect(r.revision.metadata).toMatchObject({ author: { type: "user", id: "alice" } });
    expect(r.revision.createdBy).toBe("alice");
  });

  it("listUserThemes ne renvoie ni les thèmes système ni ceux des autres ; la suppression est logique", async () => {
    const mine = await makeUserTheme(t, "alice");
    await makeUserTheme(t, "bob", "Autre");
    await saveRevision(t, mine.id, "alice", { name: "V2" });
    expect((await listUserThemes(t, "alice")).map((r) => r.name)).toEqual(["V2"]);
    await softDeleteTheme(t, mine.id, "alice");
    expect(await getThemeById(t, mine.id)).toBeNull();
    expect(await listUserThemes(t, "alice")).toHaveLength(0);
    await expect(saveRevision(t, mine.id, "alice", { name: "X" })).rejects.toMatchObject({ name: "ThemeNotFoundError" });
    expect((await db.select().from(schema.themeRevision)).filter((r) => r.themeId === mine.id)).toHaveLength(2); // historique conservé
    expect((await listSystemThemes(t)).length).toBeGreaterThan(42);
  });
});

describe("fiche d'identité du thème", () => {
  it("résume version, états, dates, auteur, provenance et états non publiés", async () => {
    const { theme } = await createTheme(t, { actorId: "alice", name: "Dérivé", styles: styleVariant("#123456"), derivedFromThemeId: "default" });
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222") });
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#333333"), description: "plus sombre" });

    const d = await getThemeDetails(t, theme.id, "alice");
    expect(d).toMatchObject({
      name: "Dérivé",
      source: "USER",
      isDefault: false,
      author: { type: "user", id: "alice", name: "alice" },
      derivedFrom: { themeId: "default", themeName: "Default", revision: 1, version: 1 },
      currentRevision: 3,
      revisionCount: 3,
      currentVersion: 1,
      versionCount: 1,
      latestVersionRevision: 1,
      unreleasedRevisions: 2,
      lastModifiedBy: "alice",
      description: "plus sombre",
    });
    expect(d.createdAt).toBeInstanceOf(Date);
    expect(d.updatedAt.getTime()).toBeGreaterThanOrEqual(d.createdAt.getTime());
    expect(d.metadata).not.toHaveProperty("author");

    await createVersion(t, theme.id, "alice");
    expect(await getThemeDetails(t, theme.id, "alice")).toMatchObject({ currentVersion: 2, versionCount: 2, latestVersionRevision: 3, unreleasedRevisions: 0 });

    const def = await getThemeDetails(t, "default", null);
    expect(def).toMatchObject({ isDefault: true, source: "BUILT_IN", currentVersion: 1, unreleasedRevisions: 0, derivedFrom: null });
  });
});
