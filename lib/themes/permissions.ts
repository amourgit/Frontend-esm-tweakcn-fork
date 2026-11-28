/**
 * Règles de propriété des thèmes (projets personnels) — SEUL endroit où elles sont décidées.
 *
 *  - Lire    : un thème système est lisible par tous ; un thème utilisateur par son propriétaire.
 *  - Écrire  : seul le propriétaire d'un thème utilisateur peut le modifier, y poser des versions,
 *              le restaurer ou le supprimer. Un thème système n'est jamais modifiable : on en
 *              tire une copie dérivée, qui appartient à celui qui la crée.
 *
 * Quand la notion de projet arrivera, ces fonctions seront remplacées par des permissions de projet.
 */
import { ThemeForbiddenError, ThemeNotFoundError } from "@/types/errors";
import type { ThemeRow } from "./types";

export function canRead(row: ThemeRow, actorId: string | null): boolean {
  return row.source === "BUILT_IN" || (actorId !== null && row.userId === actorId);
}

/** Même erreur que « introuvable » : on ne révèle pas l'existence du thème d'autrui. */
export function assertCanRead(row: ThemeRow, actorId: string | null): void {
  if (!canRead(row, actorId)) throw new ThemeNotFoundError();
}

export function assertCanWrite(row: ThemeRow, actorId: string): void {
  if (row.source === "BUILT_IN") {
    throw new ThemeForbiddenError(
      "System themes cannot be modified. Save a derived copy of it instead."
    );
  }
  if (row.userId !== actorId) throw new ThemeNotFoundError("Theme not found or not owned by user");
}
