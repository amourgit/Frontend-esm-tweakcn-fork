/**
 * États d'un thème : chaque enregistrement d'une modification ajoute un état (comme un commit).
 * Écritures atomiques, immuables, numérotées sans trou ; jamais deux états consécutifs identiques.
 */
import cuid from "cuid";
import { and, desc, eq } from "drizzle-orm";
import {
  theme as themeTable,
  themeRevision,
  themeVersion,
  user as userTable,
  type ThemeRevisionOrigin,
} from "@/db/schema";
import type { ThemeStyles } from "@/types/theme";
import { ThemeNotFoundError, ThemeRevisionConflictError } from "@/types/errors";
import { loadUserAuthor, stripReservedKeys } from "./author";
import { themeContentHash } from "./hash";
import { assertCanRead, assertCanWrite } from "./permissions";
import { getThemeById, lockTheme } from "./queries";
import { tagRevision } from "./versions";
import type {
  RevisionRow,
  RevisionSummary,
  SaveRevisionInput,
  SaveRevisionResult,
  ThemeDb,
  ThemeMetadata,
} from "./types";

/** Insère un état. Utilisé par la création, l'enregistrement, la restauration et le seed. */
export async function insertRevision(
  tx: ThemeDb,
  values: {
    themeId: string;
    revision: number;
    parentRevision: number | null;
    name: string;
    description: string | null;
    styles: ThemeStyles;
    metadata: ThemeMetadata;
    message: string | null;
    origin: ThemeRevisionOrigin;
    createdBy: string | null;
    createdAt: Date;
  }
): Promise<RevisionRow> {
  const [row] = await tx
    .insert(themeRevision)
    .values({
      id: cuid(),
      ...values,
      contentHash: themeContentHash({
        name: values.name,
        description: values.description,
        styles: values.styles,
      }),
    })
    .returning();
  return row;
}

/**
 * Enregistre un nouvel état du thème (jamais d'écrasement). Avec `release`, pose aussi une version
 * sur cet état dans la même transaction.
 */
export async function saveRevision(
  db: ThemeDb,
  themeId: string,
  actorId: string,
  input: SaveRevisionInput,
  options: { origin?: ThemeRevisionOrigin; release?: { notes?: string | null } } = {}
): Promise<SaveRevisionResult> {
  const origin = options.origin ?? "SAVE";

  return db.transaction(async (tx) => {
    const current = await lockTheme(tx, themeId);
    assertCanWrite(current, actorId);

    if (input.baseRevision !== undefined && input.baseRevision !== current.currentRevision) {
      throw new ThemeRevisionConflictError(current.currentRevision);
    }

    const next = {
      name: input.name ?? current.name,
      description:
        input.description === undefined ? current.description : input.description?.trim() || null,
      styles: input.styles ?? current.styles,
    };

    const currentUserMeta = stripReservedKeys(current.metadata);
    const nextUserMeta = input.metadata === undefined ? currentUserMeta : stripReservedKeys(input.metadata);
    const metadataChanged = JSON.stringify(nextUserMeta) !== JSON.stringify(currentUserMeta);

    const unchanged =
      themeContentHash(next) ===
        themeContentHash({
          name: current.name,
          description: current.description,
          styles: current.styles,
        }) &&
      (origin === "RESTORE" || !metadataChanged);

    const [headRevision] = await tx
      .select()
      .from(themeRevision)
      .where(
        and(eq(themeRevision.themeId, themeId), eq(themeRevision.revision, current.currentRevision))
      )
      .limit(1);

    if (unchanged) {
      // Rien à enregistrer. Si une version est demandée et que l'état courant n'en a pas, on la pose dessus.
      let version = null;
      if (options.release) {
        const [tagged] = await tx
          .select({ id: themeVersion.id })
          .from(themeVersion)
          .where(eq(themeVersion.revisionId, headRevision.id))
          .limit(1);
        if (!tagged) {
          version = await tagRevision(tx, {
            themeId,
            revision: headRevision,
            actorId,
            notes: options.release.notes,
            at: new Date(),
          });
        }
      }
      const [theme] = await tx.select().from(themeTable).where(eq(themeTable.id, themeId));
      return { theme, revision: headRevision, revisionCreated: false, version };
    }

    const at = new Date();
    const author = await loadUserAuthor(tx, actorId);
    const revisionNumber = current.currentRevision + 1;
    // Le thème garde son auteur et sa provenance ; l'état porte l'auteur de CETTE modification.
    const themeSystemKeys = {
      author: current.metadata.author,
      ...(current.metadata.derivedFrom ? { derivedFrom: current.metadata.derivedFrom } : {}),
    };
    const revisionMetadata: ThemeMetadata = {
      ...nextUserMeta,
      author,
      ...(origin === "RESTORE" && input.metadata?.restoredFromRevision !== undefined
        ? { restoredFromRevision: input.metadata.restoredFromRevision }
        : {}),
    };

    const revision = await insertRevision(tx, {
      themeId,
      revision: revisionNumber,
      parentRevision: current.currentRevision,
      ...next,
      metadata: revisionMetadata,
      message: input.message?.trim() || null,
      origin,
      createdBy: actorId,
      createdAt: at,
    });

    await tx
      .update(themeTable)
      .set({
        ...next,
        metadata: { ...nextUserMeta, ...themeSystemKeys },
        currentRevision: revisionNumber,
        updatedAt: at,
      })
      .where(eq(themeTable.id, themeId));

    const version = options.release
      ? await tagRevision(tx, { themeId, revision, actorId, notes: options.release.notes, at })
      : null;

    const [theme] = await tx.select().from(themeTable).where(eq(themeTable.id, themeId));
    return { theme, revision, revisionCreated: true, version };
  });
}

/**
 * Restaure le contenu d'un ancien état en créant un NOUVEL état (l'historique n'est jamais réécrit,
 * comme un « revert » Git). Sans effet si ce contenu est déjà l'état courant.
 */
export async function restoreRevision(
  db: ThemeDb,
  themeId: string,
  actorId: string,
  revisionNumber: number
): Promise<SaveRevisionResult> {
  const theme = await getThemeById(db, themeId);
  if (!theme) throw new ThemeNotFoundError();
  assertCanWrite(theme, actorId);

  const old = await getRevision(db, themeId, revisionNumber, actorId);
  return saveRevision(
    db,
    themeId,
    actorId,
    {
      name: old.name,
      description: old.description,
      styles: old.styles,
      metadata: { ...stripReservedKeys(old.metadata), restoredFromRevision: revisionNumber },
      message: `Restored state ${revisionNumber}`,
    },
    { origin: "RESTORE" }
  );
}

/** États d'un thème, le plus récent d'abord, sans styles ; `version` = numéro de version posée sur l'état. */
export async function listRevisions(
  db: ThemeDb,
  themeId: string,
  actorId: string | null
): Promise<RevisionSummary[]> {
  const theme = await getThemeById(db, themeId);
  if (!theme) throw new ThemeNotFoundError();
  assertCanRead(theme, actorId);

  return db
    .select({
      id: themeRevision.id,
      themeId: themeRevision.themeId,
      revision: themeRevision.revision,
      parentRevision: themeRevision.parentRevision,
      name: themeRevision.name,
      description: themeRevision.description,
      metadata: themeRevision.metadata,
      message: themeRevision.message,
      origin: themeRevision.origin,
      contentHash: themeRevision.contentHash,
      createdBy: themeRevision.createdBy,
      createdAt: themeRevision.createdAt,
      createdByName: userTable.name,
      version: themeVersion.version,
    })
    .from(themeRevision)
    .leftJoin(userTable, eq(themeRevision.createdBy, userTable.id))
    .leftJoin(themeVersion, eq(themeVersion.revisionId, themeRevision.id))
    .where(eq(themeRevision.themeId, themeId))
    .orderBy(desc(themeRevision.revision));
}

/** Contenu complet d'un état (styles compris). */
export async function getRevision(
  db: ThemeDb,
  themeId: string,
  revisionNumber: number,
  actorId: string | null
): Promise<RevisionRow> {
  const theme = await getThemeById(db, themeId);
  if (!theme) throw new ThemeNotFoundError();
  assertCanRead(theme, actorId);

  const [row] = await db
    .select()
    .from(themeRevision)
    .where(and(eq(themeRevision.themeId, themeId), eq(themeRevision.revision, revisionNumber)))
    .limit(1);
  if (!row) throw new ThemeNotFoundError("Theme state not found");
  return row;
}
