import { and, asc, eq, isNull } from "drizzle-orm";
import { theme as themeTable } from "@/db/schema";
import { ThemeNotFoundError } from "@/types/errors";
import type { ThemeDb, ThemeRow } from "./types";

/** Verrouille la ligne du thème pour la durée de la transaction (sérialise les écritures concurrentes). */
export async function lockTheme(tx: ThemeDb, themeId: string): Promise<ThemeRow> {
  const [row] = await tx
    .select()
    .from(themeTable)
    .where(and(eq(themeTable.id, themeId), isNull(themeTable.deletedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new ThemeNotFoundError();
  return row;
}

export async function getThemeById(db: ThemeDb, themeId: string): Promise<ThemeRow | null> {
  const [row] = await db
    .select()
    .from(themeTable)
    .where(and(eq(themeTable.id, themeId), isNull(themeTable.deletedAt)))
    .limit(1);
  return row ?? null;
}

/** Thèmes d'un utilisateur (thèmes système exclus). */
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

/** Thèmes système (auteur : le système), thème par défaut compris. */
export async function listSystemThemes(db: ThemeDb): Promise<ThemeRow[]> {
  return db
    .select()
    .from(themeTable)
    .where(and(eq(themeTable.source, "BUILT_IN"), isNull(themeTable.deletedAt)))
    .orderBy(asc(themeTable.createdAt), asc(themeTable.id));
}

export async function getDefaultTheme(db: ThemeDb): Promise<ThemeRow | null> {
  const [row] = await db
    .select()
    .from(themeTable)
    .where(and(eq(themeTable.isDefault, true), isNull(themeTable.deletedAt)))
    .limit(1);
  return row ?? null;
}
