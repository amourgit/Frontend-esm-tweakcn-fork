import { createHash } from "crypto";

/** JSON canonique : clés triées récursivement, pour qu'un même contenu donne toujours la même empreinte. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export interface HashableThemeContent {
  name: string;
  description: string | null;
  styles: unknown;
}

/** Empreinte du contenu d'un thème (nom, description, styles) — les métadonnées n'y participent pas. */
export function themeContentHash(content: HashableThemeContent): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        name: content.name,
        description: content.description ?? null,
        styles: content.styles,
      })
    )
    .digest("hex");
}
