import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { createVersion, getRevision, listRevisions, listVersions, restoreRevision, saveRevision, type ThemeDb } from "@/lib/themes";
import { createTestDb, insertUser } from "./db-helper";
import { makeUserTheme, styleVariant } from "./fixtures";

let db: ReturnType<typeof drizzle<typeof schema>>;
let t: ThemeDb;
beforeEach(async () => {
  ({ db } = await createTestDb());
  t = db as unknown as ThemeDb;
  await insertUser(db, "alice");
  await insertUser(db, "bob");
});

describe("états (révisions)", () => {
  it("la création produit l'état 1 et la version 1", async () => {
    const theme = await makeUserTheme(t, "alice");
    expect(theme).toMatchObject({ source: "USER", userId: "alice", currentRevision: 1, currentVersion: 1 });
    const [rev] = await listRevisions(t, theme.id, "alice");
    expect(rev).toMatchObject({ revision: 1, parentRevision: null, origin: "CREATE", version: 1, createdByName: "alice" });
  });

  it("chaque enregistrement ajoute un état, SANS créer de version", async () => {
    const theme = await makeUserTheme(t, "alice");
    const r2 = await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222"), message: "couleur" });
    const r3 = await saveRevision(t, theme.id, "alice", { name: "Renommé", description: "desc" });
    expect(r2.revisionCreated && r3.revisionCreated).toBe(true);
    expect(r2.version).toBeNull();
    expect(r3.theme).toMatchObject({ currentRevision: 3, currentVersion: 1, name: "Renommé", description: "desc" });
    expect(r3.theme.styles.light.primary).toBe("#222222");

    const states = await listRevisions(t, theme.id, "alice");
    expect(states.map((s) => s.revision)).toEqual([3, 2, 1]);
    expect(states.map((s) => s.parentRevision)).toEqual([2, 1, null]);
    expect(states.map((s) => s.version)).toEqual([null, null, 1]);
    expect(states[1].message).toBe("couleur");
    expect((await getRevision(t, theme.id, 1, "alice")).styles.light.primary).toBe("#111111"); // l'ancien état est intact
  });

  it("n'enregistre pas d'état identique à l'état courant", async () => {
    const theme = await makeUserTheme(t, "alice");
    const same = await saveRevision(t, theme.id, "alice", { styles: styleVariant("#111111"), name: "Mon thème" });
    expect(same.revisionCreated).toBe(false);
    expect(same.theme.currentRevision).toBe(1);
    expect(await listRevisions(t, theme.id, "alice")).toHaveLength(1);
  });

  it("une modification de métadonnées seule crée un état ; les clés système ne sont pas modifiables", async () => {
    const theme = await makeUserTheme(t, "alice");
    const r = await saveRevision(t, theme.id, "alice", {
      metadata: { tags: ["brand"], author: { type: "system", id: null, name: "system" }, derivedFrom: { themeId: "x" } },
    });
    expect(r.revisionCreated).toBe(true);
    expect(r.revision.metadata).toMatchObject({ tags: ["brand"], author: { type: "user", id: "alice", name: "alice" } });
    expect(r.revision.metadata).not.toHaveProperty("derivedFrom");
    expect(r.theme.metadata).toMatchObject({ tags: ["brand"], author: { type: "user", id: "alice" } });
  });

  it("refuse un enregistrement basé sur un état dépassé", async () => {
    const theme = await makeUserTheme(t, "alice");
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222") });
    await expect(saveRevision(t, theme.id, "alice", { styles: styleVariant("#333333"), baseRevision: 1 })).rejects.toMatchObject({
      name: "ThemeRevisionConflictError",
      currentRevision: 2,
    });
    expect(await listRevisions(t, theme.id, "alice")).toHaveLength(2);
  });

  it("deux enregistrements simultanés ne produisent ni trou ni doublon de numéro", async () => {
    const theme = await makeUserTheme(t, "alice");
    await Promise.all([
      saveRevision(t, theme.id, "alice", { styles: styleVariant("#aaaaaa") }),
      saveRevision(t, theme.id, "alice", { styles: styleVariant("#bbbbbb") }),
    ]);
    expect((await listRevisions(t, theme.id, "alice")).map((s) => s.revision)).toEqual([3, 2, 1]);
  });

  it("restaure un ancien état en créant un NOUVEL état, sans toucher à l'historique", async () => {
    const theme = await makeUserTheme(t, "alice");
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222"), name: "V2" });
    const restored = await restoreRevision(t, theme.id, "alice", 1);
    expect(restored.revision).toMatchObject({ revision: 3, parentRevision: 2, origin: "RESTORE", name: "Mon thème", message: "Restored state 1" });
    expect(restored.revision.metadata).toMatchObject({ restoredFromRevision: 1 });
    expect(restored.theme.styles.light.primary).toBe("#111111");
    expect(await listRevisions(t, theme.id, "alice")).toHaveLength(3);
    expect((await restoreRevision(t, theme.id, "alice", 3)).revisionCreated).toBe(false); // déjà l'état courant
  });

  it("enregistrer avec `release` pose une version sur le nouvel état, dans la même opération", async () => {
    const theme = await makeUserTheme(t, "alice");
    const r = await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222") }, { release: { notes: "v2 stable" } });
    expect(r.version).toMatchObject({ version: 2, notes: "v2 stable" });
    expect(r.theme).toMatchObject({ currentRevision: 2, currentVersion: 2 });
    // état identique + `release` : on étiquette l'état courant s'il n'a pas de version, sinon rien
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#333333") });
    const tagged = await saveRevision(t, theme.id, "alice", { styles: styleVariant("#333333") }, { release: {} });
    expect(tagged).toMatchObject({ revisionCreated: false, version: { version: 3 } });
    const again = await saveRevision(t, theme.id, "alice", { styles: styleVariant("#333333") }, { release: {} });
    expect(again).toMatchObject({ revisionCreated: false, version: null });
  });
});

describe("versions (étiquettes sur un état précis)", () => {
  it("pose une version sur un état précis, pas forcément le dernier", async () => {
    const theme = await makeUserTheme(t, "alice");
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222"), message: "deuxième" });
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#333333"), message: "troisième" });

    const { version, theme: after } = await createVersion(t, theme.id, "alice", { revision: 2, notes: "Version intermédiaire" });
    expect(version).toMatchObject({ version: 2, notes: "Version intermédiaire" });
    expect(after.currentVersion).toBe(2);
    expect(after.currentRevision).toBe(3); // l'état courant n'a pas bougé

    const versions = await listVersions(t, theme.id, "alice");
    expect(versions.map((v) => [v.version, v.revision, v.revisionMessage])).toEqual([
      [2, 2, "deuxième"],
      [1, 1, "Initial state"],
    ]);
    expect((await listRevisions(t, theme.id, "alice")).map((s) => s.version)).toEqual([null, 2, 1]);
  });

  it("par défaut, étiquette l'état courant", async () => {
    const theme = await makeUserTheme(t, "alice");
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222") });
    expect((await createVersion(t, theme.id, "alice")).version).toMatchObject({ version: 2 });
  });

  it("refuse une deuxième version sur le même état, et un état inexistant", async () => {
    const theme = await makeUserTheme(t, "alice");
    await expect(createVersion(t, theme.id, "alice", { revision: 1 })).rejects.toMatchObject({ name: "ThemeRevisionAlreadyVersionedError", version: 1 });
    await expect(createVersion(t, theme.id, "alice", { revision: 9 })).rejects.toMatchObject({ name: "ThemeNotFoundError" });
    expect(await listVersions(t, theme.id, "alice")).toHaveLength(1);
  });

  it("deux créations simultanées de version ne produisent pas de numéro en double", async () => {
    const theme = await makeUserTheme(t, "alice");
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#222222") });
    await saveRevision(t, theme.id, "alice", { styles: styleVariant("#333333") });
    await Promise.all([createVersion(t, theme.id, "alice", { revision: 2 }), createVersion(t, theme.id, "alice", { revision: 3 })]);
    expect((await listVersions(t, theme.id, "alice")).map((v) => v.version)).toEqual([3, 2, 1]);
  });
});
