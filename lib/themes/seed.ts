/**
 * Import des thèmes système dans la base : les 42 thèmes livrés avec le dépôt
 * (`utils/theme-presets.ts`) et le thème par défaut. Auteur : le système. État 1 + version 1.
 *
 * Idempotent et sûr en cas de redémarrage ou de plusieurs instances simultanées :
 *  - l'id du thème est son slug (clé primaire) → `ON CONFLICT DO NOTHING` ;
 *  - le thème, son état 1 et sa version 1 sont écrits dans UNE transaction, sous verrou consultatif ;
 *  - l'index unique partiel garantit un seul thème par défaut.
 * Un thème déjà présent n'est JAMAIS réécrit : la base fait foi, y compris si le fichier source change.
 */
import { sql } from "drizzle-orm";
import { theme as themeTable } from "@/db/schema";
import { defaultThemeState } from "@/config/theme";
import { DEFAULT_THEME_ID } from "@/config/default-theme-id";
import type { ThemePreset } from "@/types/theme";
import { defaultPresets } from "@/utils/theme-presets";
import { mergePresetWithDefaults } from "@/utils/theme-merge";
import { SYSTEM_AUTHOR } from "./author";
import { insertRevision } from "./revisions";
import { tagRevision } from "./versions";
import type { ThemeDb } from "./types";

export const SEED_SOURCE_FILE = "utils/theme-presets.ts";
export { DEFAULT_THEME_ID };
const SEED_LOCK_KEY = "egen-theme-studio:seed-system-themes";

/**
 * 19 presets livrés n'ont pas de date : on les ancre avant le plus ancien preset daté (2025-04-01)
 * pour qu'ils ne soient jamais présentés comme « nouveaux » dans le sélecteur.
 * `seed.createdAtEstimated` signale que cette date n'est pas une vraie date de création.
 */
const UNDATED_PRESET_CREATED_AT = new Date("2025-04-01T00:00:00.000Z");

/** Thème par défaut + thèmes livrés, tels qu'ils sont importés. */
export function getSystemPresets(): Record<string, ThemePreset> {
  return {
    [DEFAULT_THEME_ID]: {
      label: "Default",
      styles: defaultThemeState.styles,
      createdAt: UNDATED_PRESET_CREATED_AT.toISOString(),
    },
    ...defaultPresets,
  };
}

export interface SeedResult {
  inserted: number;
  existing: number;
}

export async function seedSystemThemes(
  db: ThemeDb,
  presets: Record<string, ThemePreset> = getSystemPresets()
): Promise<SeedResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${SEED_LOCK_KEY}))`);

    let inserted = 0;
    const at = new Date();

    for (const [slug, preset] of Object.entries(presets)) {
      const name = preset.label || slug;
      const styles = mergePresetWithDefaults(preset.styles);
      const dated = preset.createdAt ? new Date(preset.createdAt) : null;
      const createdAt = dated && !Number.isNaN(dated.getTime()) ? dated : UNDATED_PRESET_CREATED_AT;
      const metadata = {
        origin: slug === DEFAULT_THEME_ID ? "egen-studio" : "tweakcn-official",
        seed: {
          key: slug,
          file: SEED_SOURCE_FILE,
          ...(createdAt === UNDATED_PRESET_CREATED_AT ? { createdAtEstimated: true } : {}),
        },
        author: SYSTEM_AUTHOR,
      };

      const created = await tx
        .insert(themeTable)
        .values({
          id: slug,
          userId: null,
          source: "BUILT_IN",
          name,
          description: null,
          styles,
          metadata,
          isDefault: slug === DEFAULT_THEME_ID,
          currentRevision: 1,
          currentVersion: null,
          createdAt,
          updatedAt: at,
        })
        .onConflictDoNothing({ target: themeTable.id })
        .returning({ id: themeTable.id });

      if (created.length === 0) continue; // déjà importé : on ne touche à rien

      const revision = await insertRevision(tx, {
        themeId: slug,
        revision: 1,
        parentRevision: null,
        name,
        description: null,
        styles,
        metadata,
        message: "Initial state (theme shipped with the studio)",
        origin: "SEED",
        createdBy: null,
        createdAt: at,
      });
      await tagRevision(tx, {
        themeId: slug,
        revision,
        actorId: null,
        notes: "Initial version",
        at,
      });

      inserted++;
    }

    return { inserted, existing: Object.keys(presets).length - inserted };
  });
}
