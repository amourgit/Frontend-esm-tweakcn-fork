/**
 * Persistance et versionnement des thèmes du studio (couche base de données).
 *
 * Fonctions pures vis-à-vis de Next (aucun `headers()` / session) : l'appelant fournit la base et
 * l'identité de l'acteur. Cela permet de les utiliser depuis les server actions, le script de
 * migration/seed et les tests.
 *
 * Invariants garantis ici, dans UNE transaction à chaque écriture :
 *  - `theme.current_version` = plus grand `theme_version.version` du thème ;
 *  - `theme.{name,description,styles}` = contenu de cette version ;
 *  - les versions sont immuables, numérotées sans trou (1, 2, 3…) par thème ;
 *  - jamais deux versions consécutives de contenu identique.
 */
import cuid from "cuid";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import {
  theme as themeTable,
  themeVersion,
  user as userTable,
  type ThemeVersionOrigin,
} from "@/db/schema";
import type { ThemeStyles } from "@/types/theme";
import {
  ThemeForbiddenError,
  ThemeNotFoundError,
  ThemeVersionConflictError,
} from "@/types/errors";
import { themeContentHash } from "./hash";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThemeDb = PgDatabase<PgQueryResultHKT, any>;

export type ThemeRow = typeof themeTable.$inferSelect;
export type ThemeVersionRow = typeof themeVersion.$inferSelect;
export type ThemeVersionSummary = Omit<ThemeVersionRow, "styles"> & {
  /** Nom de l'auteur (null pour une version importée au démarrage ou un compte supprimé). */
  createdByName: string | null;
};

export type ThemeMetadata = Record<string, unknown>;

export interface SaveThemeInput {
  name?: string;
  description?: string | null;
  styles?: ThemeStyles;
  metadata?: ThemeMetadata;
  changeNote?: string | null;
}

export interface SaveThemeResult {
  theme: ThemeRow;
  version: ThemeVersionRow;
  /** false : le contenu était identique à la version courante, rien n'a été écrit. */
  versionCreated: boolean;
}

function now() {
  return new Date();
}

/** Un thème utilisateur n'est visible/modifiable que par son propriétaire ; un thème système l'est par tout utilisateur connecté. */
function assertCanWrite(row: ThemeRow, actorId: string) {
  if (row.source === "USER" && row.userId !== actorId) {
    // Même message que « introuvable » : on ne révèle pas l'existence du thème d'autrui.
    throw new ThemeNotFoundError("Theme not found or not owned by user");
  }
}

async function lockTheme(tx: ThemeDb, themeId: string): Promise<ThemeRow> {
  const [row] = await tx
    .select()
    .from(themeTable)
    .where(and(eq(themeTable.id, themeId), isNull(themeTable.deletedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new ThemeNotFoundError();
  return row;
}

export async function createTheme(
  db: ThemeDb,
  input: {
    userId: string;
    name: string;
    styles: ThemeStyles;
    description?: string | null;
    metadata?: ThemeMetadata;
    changeNote?: string | null;
  }
): Promise<SaveThemeResult> {
  const id = cuid();
  const at = now();
  const description = input.description?.trim() || null;
  const metadata = input.metadata ?? {};

  return db.transaction(async (tx) => {
    const [theme] = await tx
      .insert(themeTable)
      .values({
        id,
        userId: input.userId,
        source: "USER",
        name: input.name,
        description,
        styles: input.styles,
        metadata,
        currentVersion: 1,
        createdAt: at,
        updatedAt: at,
      })
      .returning();

    const [version] = await tx
      .insert(themeVersion)
      .values({
        id: cuid(),
        themeId: id,
        version: 1,
        name: input.name,
        description,
        styles: input.styles,
        metadata,
        changeNote: input.changeNote?.trim() || null,
        origin: "CREATE",
        contentHash: themeContentHash({ name: input.name, description, styles: input.styles }),
        createdBy: input.userId,
        createdAt: at,
      })
      .returning();

    return { theme, version, versionCreated: true };
  });
}

/**
 * Enregistre une nouvelle version d'un thème existant (modification validée dans le studio).
 * `baseVersion` (optionnel) : version sur laquelle l'utilisateur a travaillé ; si elle n'est plus la
 * version courante, la sauvegarde est refusée (évite d'écraser silencieusement une autre modification).
 */
export async function saveThemeVersion(
  db: ThemeDb,
  themeId: string,
  actorId: string,
  input: SaveThemeInput & { baseVersion?: number },
  origin: ThemeVersionOrigin = "UPDATE"
): Promise<SaveThemeResult> {
  return db.transaction(async (tx) => {
    const current = await lockTheme(tx, themeId);
    assertCanWrite(current, actorId);

    if (input.baseVersion !== undefined && input.baseVersion !== current.currentVersion) {
      throw new ThemeVersionConflictError(current.currentVersion);
    }

    const next = {
      name: input.name ?? current.name,
      description:
        input.description === undefined ? current.description : input.description?.trim() || null,
      styles: input.styles ?? current.styles,
    };

    const [currentVersionRow] = await tx
      .select()
      .from(themeVersion)
      .where(
        and(eq(themeVersion.themeId, themeId), eq(themeVersion.version, current.currentVersion))
      )
      .limit(1);

    // Déduplication : on compare au contenu COURANT du thème (pas à une empreinte stockée).
    const nextHash = themeContentHash(next);
    const currentHash = themeContentHash({
      name: current.name,
      description: current.description,
      styles: current.styles,
    });
    const metadataChanged =
      input.metadata !== undefined &&
      JSON.stringify(input.metadata) !== JSON.stringify(current.metadata);

    if (nextHash === currentHash && (origin === "RESTORE" || !metadataChanged)) {
      return { theme: current, version: currentVersionRow, versionCreated: false };
    }

    const at = now();
    const versionNumber = current.currentVersion + 1;
    const metadata = input.metadata ?? current.metadata;

    const [version] = await tx
      .insert(themeVersion)
      .values({
        id: cuid(),
        themeId,
        version: versionNumber,
        name: next.name,
        description: next.description,
        styles: next.styles,
        metadata,
        changeNote: input.changeNote?.trim() || null,
        origin,
        contentHash: nextHash,
        createdBy: actorId,
        createdAt: at,
      })
      .returning();

    const [theme] = await tx
      .update(themeTable)
      .set({
        name: next.name,
        description: next.description,
        styles: next.styles,
        metadata,
        currentVersion: versionNumber,
        updatedAt: at,
      })
      .where(eq(themeTable.id, themeId))
      .returning();

    return { theme, version, versionCreated: true };
  });
}

/** Restaure le contenu d'une ancienne version en créant une NOUVELLE version (l'historique n'est jamais réécrit). */
export async function restoreThemeVersion(
  db: ThemeDb,
  themeId: string,
  actorId: string,
  versionNumber: number
): Promise<SaveThemeResult> {
  const [old] = await db
    .select()
    .from(themeVersion)
    .where(and(eq(themeVersion.themeId, themeId), eq(themeVersion.version, versionNumber)))
    .limit(1);
  if (!old) throw new ThemeNotFoundError("Theme version not found");

  return saveThemeVersion(
    db,
    themeId,
    actorId,
    {
      name: old.name,
      description: old.description,
      styles: old.styles,
      metadata: { ...old.metadata, restoredFromVersion: versionNumber },
      changeNote: `Restauration de la version ${versionNumber}`,
    },
    "RESTORE"
  );
}

/** Suppression logique d'un thème utilisateur : l'historique des versions est conservé. */
export async function softDeleteTheme(db: ThemeDb, themeId: string, actorId: string) {
  return db.transaction(async (tx) => {
    const current = await lockTheme(tx, themeId);
    if (current.source === "BUILT_IN") {
      throw new ThemeForbiddenError("Built-in themes cannot be deleted");
    }
    assertCanWrite(current, actorId);
    await tx
      .update(themeTable)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(eq(themeTable.id, themeId));
    return { id: current.id, name: current.name };
  });
}

export async function getThemeById(db: ThemeDb, themeId: string): Promise<ThemeRow | null> {
  const [row] = await db
    .select()
    .from(themeTable)
    .where(and(eq(themeTable.id, themeId), isNull(themeTable.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listUserThemes(db: ThemeDb, userId: string): Promise<ThemeRow[]> {
  return db
    .select()
    .from(themeTable)
    .where(
      and(
        eq(themeTable.userId, userId),
        eq(themeTable.source, "USER"),
        isNull(themeTable.deletedAt)
      )
    );
}

export async function listBuiltInThemes(db: ThemeDb): Promise<ThemeRow[]> {
  return db
    .select()
    .from(themeTable)
    .where(and(eq(themeTable.source, "BUILT_IN"), isNull(themeTable.deletedAt)))
    .orderBy(asc(themeTable.createdAt), asc(themeTable.id));
}

/** Historique d'un thème, version la plus récente d'abord, sans les styles (léger). */
export async function listThemeVersions(
  db: ThemeDb,
  themeId: string
): Promise<ThemeVersionSummary[]> {
  return db
    .select({
      id: themeVersion.id,
      themeId: themeVersion.themeId,
      version: themeVersion.version,
      name: themeVersion.name,
      description: themeVersion.description,
      metadata: themeVersion.metadata,
      changeNote: themeVersion.changeNote,
      origin: themeVersion.origin,
      contentHash: themeVersion.contentHash,
      createdBy: themeVersion.createdBy,
      createdByName: userTable.name,
      createdAt: themeVersion.createdAt,
    })
    .from(themeVersion)
    .leftJoin(userTable, eq(themeVersion.createdBy, userTable.id))
    .where(eq(themeVersion.themeId, themeId))
    .orderBy(desc(themeVersion.version));
}

export async function getThemeVersion(
  db: ThemeDb,
  themeId: string,
  versionNumber: number
): Promise<ThemeVersionRow | null> {
  const [row] = await db
    .select()
    .from(themeVersion)
    .where(and(eq(themeVersion.themeId, themeId), eq(themeVersion.version, versionNumber)))
    .limit(1);
  return row ?? null;
}
