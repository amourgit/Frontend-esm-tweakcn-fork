/**
 * Versions d'un thème : étiquettes numérotées posées sur un état précis (comme un tag Git).
 * Un état porte au plus une version ; les numéros croissent sans jamais être réutilisés.
 */
import cuid from "cuid";
import { and, desc, eq, max } from "drizzle-orm";
import {
  theme as themeTable,
  themeRevision,
  themeVersion,
  user as userTable,
} from "@/db/schema";
import { ThemeNotFoundError, ThemeRevisionAlreadyVersionedError } from "@/types/errors";
import { assertCanRead, assertCanWrite } from "./permissions";
import { getThemeById, lockTheme } from "./queries";
import type { RevisionRow, ThemeDb, ThemeRow, VersionRow, VersionSummary } from "./types";

/** Pose la prochaine version sur `revision`. À appeler dans une transaction où le thème est verrouillé. */
export async function tagRevision(
  tx: ThemeDb,
  params: { themeId: string; revision: RevisionRow; actorId: string | null; notes?: string | null; at: Date }
): Promise<VersionRow> {
  const [existing] = await tx
    .select({ version: themeVersion.version })
    .from(themeVersion)
    .where(eq(themeVersion.revisionId, params.revision.id))
    .limit(1);
  if (existing) throw new ThemeRevisionAlreadyVersionedError(existing.version);

  const [{ last }] = await tx
    .select({ last: max(themeVersion.version) })
    .from(themeVersion)
    .where(eq(themeVersion.themeId, params.themeId));
  const next = (last ?? 0) + 1;

  const [version] = await tx
    .insert(themeVersion)
    .values({
      id: cuid(),
      themeId: params.themeId,
      version: next,
      revisionId: params.revision.id,
      notes: params.notes?.trim() || null,
      createdBy: params.actorId,
      createdAt: params.at,
    })
    .returning();

  await tx
    .update(themeTable)
    .set({ currentVersion: next, updatedAt: params.at })
    .where(eq(themeTable.id, params.themeId));

  return version;
}

/** Crée une version sur un état précis du thème (par défaut : son état courant). */
export async function createVersion(
  db: ThemeDb,
  themeId: string,
  actorId: string,
  input: { revision?: number; notes?: string | null } = {}
): Promise<{ theme: ThemeRow; version: VersionRow }> {
  return db.transaction(async (tx) => {
    const theme = await lockTheme(tx, themeId);
    assertCanWrite(theme, actorId);

    const revisionNumber = input.revision ?? theme.currentRevision;
    const [revision] = await tx
      .select()
      .from(themeRevision)
      .where(and(eq(themeRevision.themeId, themeId), eq(themeRevision.revision, revisionNumber)))
      .limit(1);
    if (!revision) throw new ThemeNotFoundError("Theme state not found");

    const version = await tagRevision(tx, {
      themeId,
      revision,
      actorId,
      notes: input.notes,
      at: new Date(),
    });
    const [updated] = await tx.select().from(themeTable).where(eq(themeTable.id, themeId));
    return { theme: updated, version };
  });
}

/** Versions d'un thème, la plus récente d'abord, avec l'état sur lequel chacune est posée. */
export async function listVersions(
  db: ThemeDb,
  themeId: string,
  actorId: string | null
): Promise<VersionSummary[]> {
  const theme = await getThemeById(db, themeId);
  if (!theme) throw new ThemeNotFoundError();
  assertCanRead(theme, actorId);

  const rows = await db
    .select({
      id: themeVersion.id,
      themeId: themeVersion.themeId,
      version: themeVersion.version,
      revisionId: themeVersion.revisionId,
      notes: themeVersion.notes,
      createdBy: themeVersion.createdBy,
      createdAt: themeVersion.createdAt,
      revision: themeRevision.revision,
      revisionMessage: themeRevision.message,
      createdByName: userTable.name,
    })
    .from(themeVersion)
    .innerJoin(themeRevision, eq(themeVersion.revisionId, themeRevision.id))
    .leftJoin(userTable, eq(themeVersion.createdBy, userTable.id))
    .where(eq(themeVersion.themeId, themeId))
    .orderBy(desc(themeVersion.version));
  return rows;
}
