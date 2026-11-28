/** Création, dérivation et suppression des thèmes. */
import cuid from "cuid";
import { eq } from "drizzle-orm";
import { theme as themeTable } from "@/db/schema";
import type { ThemeStyles } from "@/types/theme";
import { ThemeForbiddenError, ThemeNotFoundError } from "@/types/errors";
import { loadUserAuthor, stripReservedKeys } from "./author";
import { assertCanRead, assertCanWrite } from "./permissions";
import { getThemeById, lockTheme } from "./queries";
import { insertRevision } from "./revisions";
import { tagRevision } from "./versions";
import type { SaveRevisionResult, ThemeDb, ThemeDerivedFrom, ThemeMetadata } from "./types";

export interface CreateThemeInput {
  actorId: string;
  name: string;
  styles: ThemeStyles;
  description?: string | null;
  metadata?: ThemeMetadata;
  message?: string | null;
  /**
   * Thème dont celui-ci est une copie dérivée (un thème système, ou un de ses propres thèmes).
   * Le serveur en relève lui-même l'état et la version : le client ne fournit que l'identifiant.
   */
  derivedFromThemeId?: string;
}

/**
 * Crée un thème appartenant à `actorId` : état 1 + version 1. Quand il dérive d'un autre thème, la
 * provenance est inscrite dans ses métadonnées ; l'auteur reste celui qui le crée (jamais le système).
 */
export async function createTheme(db: ThemeDb, input: CreateThemeInput): Promise<SaveRevisionResult> {
  const id = cuid();
  const at = new Date();
  const description = input.description?.trim() || null;
  const userMetadata = stripReservedKeys(input.metadata);

  return db.transaction(async (tx) => {
    const author = await loadUserAuthor(tx, input.actorId);

    let derivedFrom: ThemeDerivedFrom | null = null;
    if (input.derivedFromThemeId) {
      const source = await getThemeById(tx, input.derivedFromThemeId);
      if (!source) throw new ThemeNotFoundError("Source theme not found");
      assertCanRead(source, input.actorId); // on ne dérive que d'un thème système ou du sien
      derivedFrom = {
        themeId: source.id,
        themeName: source.name,
        revision: source.currentRevision,
        version: source.currentVersion,
      };
    }

    const themeMetadata: ThemeMetadata = {
      ...userMetadata,
      author,
      ...(derivedFrom ? { derivedFrom } : {}),
    };

    const [theme] = await tx
      .insert(themeTable)
      .values({
        id,
        userId: input.actorId,
        source: "USER",
        name: input.name,
        description,
        styles: input.styles,
        metadata: themeMetadata,
        isDefault: false,
        currentRevision: 1,
        currentVersion: null,
        createdAt: at,
        updatedAt: at,
      })
      .returning();

    const revision = await insertRevision(tx, {
      themeId: id,
      revision: 1,
      parentRevision: null,
      name: input.name,
      description,
      styles: input.styles,
      metadata: { ...userMetadata, author, ...(derivedFrom ? { derivedFrom } : {}) },
      message:
        input.message?.trim() ||
        (derivedFrom ? `Derived from “${derivedFrom.themeName}”` : "Initial state"),
      origin: derivedFrom ? "DERIVE" : "CREATE",
      createdBy: input.actorId,
      createdAt: at,
    });

    const version = await tagRevision(tx, {
      themeId: id,
      revision,
      actorId: input.actorId,
      notes: "Initial version",
      at,
    });

    const [fresh] = await tx.select().from(themeTable).where(eq(themeTable.id, id));
    return { theme: fresh ?? theme, revision, revisionCreated: true, version };
  });
}

/** Suppression logique d'un thème de l'utilisateur : états et versions sont conservés. */
export async function softDeleteTheme(db: ThemeDb, themeId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const current = await lockTheme(tx, themeId);
    assertCanWrite(current, actorId);
    if (current.isDefault) throw new ThemeForbiddenError("The default theme cannot be deleted");
    const at = new Date();
    await tx
      .update(themeTable)
      .set({ deletedAt: at, updatedAt: at })
      .where(eq(themeTable.id, themeId));
    return { id: current.id, name: current.name };
  });
}
