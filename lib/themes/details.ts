/** Fiche d'identité d'un thème (métadonnées affichées dans le studio). */
import { count, desc, eq } from "drizzle-orm";
import { themeRevision, themeVersion } from "@/db/schema";
import { ThemeNotFoundError } from "@/types/errors";
import { readAuthor, stripReservedKeys } from "./author";
import { assertCanRead } from "./permissions";
import { getThemeById } from "./queries";
import type { ThemeDb, ThemeDerivedFrom, ThemeDetails } from "./types";

export async function getThemeDetails(
  db: ThemeDb,
  themeId: string,
  actorId: string | null
): Promise<ThemeDetails> {
  const theme = await getThemeById(db, themeId);
  if (!theme) throw new ThemeNotFoundError();
  assertCanRead(theme, actorId);

  const [[{ revisions }], [{ versions }], [latest], [head]] = await Promise.all([
    db.select({ revisions: count() }).from(themeRevision).where(eq(themeRevision.themeId, themeId)),
    db.select({ versions: count() }).from(themeVersion).where(eq(themeVersion.themeId, themeId)),
    db
      .select({ version: themeVersion.version, revision: themeRevision.revision })
      .from(themeVersion)
      .innerJoin(themeRevision, eq(themeVersion.revisionId, themeRevision.id))
      .where(eq(themeVersion.themeId, themeId))
      .orderBy(desc(themeVersion.version))
      .limit(1),
    db
      .select({ metadata: themeRevision.metadata })
      .from(themeRevision)
      .where(eq(themeRevision.themeId, themeId))
      .orderBy(desc(themeRevision.revision))
      .limit(1),
  ]);

  const latestRevision = latest?.revision ?? null;
  return {
    id: theme.id,
    name: theme.name,
    description: theme.description,
    source: theme.source,
    isDefault: theme.isDefault,
    author: readAuthor(theme.metadata),
    derivedFrom: (theme.metadata.derivedFrom as ThemeDerivedFrom | undefined) ?? null,
    metadata: stripReservedKeys(theme.metadata),
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt,
    currentRevision: theme.currentRevision,
    revisionCount: revisions,
    currentVersion: theme.currentVersion,
    versionCount: versions,
    latestVersionRevision: latestRevision,
    unreleasedRevisions: latestRevision === null ? theme.currentRevision : theme.currentRevision - latestRevision,
    lastModifiedBy: head ? readAuthor(head.metadata).name : null,
  };
}
