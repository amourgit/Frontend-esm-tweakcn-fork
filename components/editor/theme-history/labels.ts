import type { ThemeRevisionOrigin } from "@/db/schema";

/** Libellé de l'origine d'un état. */
export const ORIGIN_LABEL: Record<ThemeRevisionOrigin, string> = {
  SEED: "Initial import",
  CREATE: "Created",
  DERIVE: "Derived",
  SAVE: "Saved",
  RESTORE: "Restored",
};

export function formatDateTime(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** « by Kim », ou « by the system » pour un état importé (pas d'auteur utilisateur). */
export function authorLabel(createdByName: string | null): string {
  return createdByName ? `by ${createdByName}` : "by the system";
}
