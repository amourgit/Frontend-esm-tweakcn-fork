import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { theme, themeRevision, themeVersion, ThemeRevisionOrigin } from "@/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ThemeDb = PgDatabase<PgQueryResultHKT, any>;

export type ThemeRow = typeof theme.$inferSelect;
export type RevisionRow = typeof themeRevision.$inferSelect;
export type VersionRow = typeof themeVersion.$inferSelect;
export type { ThemeRevisionOrigin };

export type ThemeMetadata = Record<string, unknown>;

/** Auteur d'un thème ou d'un état : le système (thèmes livrés) ou un utilisateur. */
export interface ThemeAuthor {
  type: "system" | "user";
  id: string | null;
  name: string;
}

/** Thème dont est dérivée une copie (renseigné par le serveur, jamais par le client). */
export interface ThemeDerivedFrom {
  themeId: string;
  themeName: string;
  revision: number;
  version: number | null;
}

/** Un état, sans ses styles (listes légères). `version` = numéro de la version posée sur cet état, s'il y en a une. */
export type RevisionSummary = Omit<RevisionRow, "styles"> & {
  createdByName: string | null;
  version: number | null;
};

/** Une version, avec l'état sur lequel elle est posée. */
export type VersionSummary = VersionRow & {
  revision: number;
  revisionMessage: string | null;
  createdByName: string | null;
};

/** Fiche d'identité d'un thème, telle qu'affichée dans le studio. */
export interface ThemeDetails {
  id: string;
  name: string;
  description: string | null;
  source: "BUILT_IN" | "USER";
  isDefault: boolean;
  author: ThemeAuthor;
  derivedFrom: ThemeDerivedFrom | null;
  /** Métadonnées libres saisies par l'utilisateur (hors clés système). */
  metadata: ThemeMetadata;
  createdAt: Date;
  updatedAt: Date;
  /** État courant (numéro) et nombre total d'états. */
  currentRevision: number;
  revisionCount: number;
  /** Dernière version publiée, NULL si aucune. */
  currentVersion: number | null;
  versionCount: number;
  /** Numéro de l'état sur lequel porte la dernière version. */
  latestVersionRevision: number | null;
  /** États enregistrés depuis la dernière version (0 = l'état courant est exactement la dernière version). */
  unreleasedRevisions: number;
  lastModifiedBy: string | null;
}

export interface SaveRevisionInput {
  name?: string;
  description?: string | null;
  styles?: import("@/types/theme").ThemeStyles;
  metadata?: ThemeMetadata;
  message?: string | null;
  /** État sur lequel l'utilisateur a travaillé : refus si ce n'est plus l'état courant. */
  baseRevision?: number;
}

export interface SaveRevisionResult {
  theme: ThemeRow;
  revision: RevisionRow;
  /** false : contenu identique à l'état courant, rien n'a été écrit. */
  revisionCreated: boolean;
  /** Version posée dans la même opération (si demandée et possible). */
  version: VersionRow | null;
}
