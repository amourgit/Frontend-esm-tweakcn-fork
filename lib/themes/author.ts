import { eq } from "drizzle-orm";
import { user as userTable } from "@/db/schema";
import { ThemeNotFoundError } from "@/types/errors";
import type { ThemeAuthor, ThemeDb, ThemeMetadata } from "./types";

export const SYSTEM_AUTHOR: ThemeAuthor = { type: "system", id: null, name: "system" };

/**
 * Clés de métadonnées gérées par le serveur : l'utilisateur ne peut ni les fournir ni les écraser
 * (sinon on pourrait se faire passer pour un autre auteur ou falsifier la provenance d'un thème).
 */
export const RESERVED_METADATA_KEYS = ["author", "derivedFrom", "restoredFromRevision"] as const;

export function stripReservedKeys(metadata: ThemeMetadata | undefined | null): ThemeMetadata {
  const clean: ThemeMetadata = { ...(metadata ?? {}) };
  for (const key of RESERVED_METADATA_KEYS) delete clean[key];
  return clean;
}

export async function loadUserAuthor(db: ThemeDb, userId: string): Promise<ThemeAuthor> {
  const [row] = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!row) throw new ThemeNotFoundError("User not found");
  return { type: "user", id: row.id, name: row.name };
}

export function readAuthor(metadata: ThemeMetadata): ThemeAuthor {
  const raw = metadata.author as Partial<ThemeAuthor> | undefined;
  if (raw && (raw.type === "system" || raw.type === "user") && typeof raw.name === "string") {
    return { type: raw.type, id: raw.id ?? null, name: raw.name };
  }
  return SYSTEM_AUTHOR;
}
