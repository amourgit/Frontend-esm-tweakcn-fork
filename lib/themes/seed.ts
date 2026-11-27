/**
 * Import des thèmes livrés avec le dépôt (`utils/theme-presets.ts`) dans la base, comme thèmes
 * système (`source = 'BUILT_IN'`), version 1.
 *
 * Idempotent et sûr en cas de redémarrage ou de plusieurs instances simultanées :
 *  - l'id du thème est son slug (clé primaire) → `ON CONFLICT DO NOTHING` ;
 *  - la version 1 est protégée par l'unicité (theme_id, version) ;
 *  - tout se fait dans une transaction sous verrou consultatif (`pg_advisory_xact_lock`).
 * Un thème déjà présent n'est JAMAIS réécrit : la base fait foi, y compris si le fichier source change.
 */
import cuid from "cuid";
import { sql } from "drizzle-orm";
import { theme as themeTable, themeVersion } from "@/db/schema";
import type { ThemePreset } from "@/types/theme";
import { mergePresetWithDefaults } from "@/utils/theme-merge";
import { themeContentHash } from "./hash";
import type { ThemeDb } from "./service";

export const SEED_SOURCE_FILE = "utils/theme-presets.ts";

/**
 * 19 presets livrés n'ont pas de date : on les ancre avant le plus ancien preset daté (2025-04-01)
 * pour qu'ils ne soient jamais présentés comme « nouveaux » dans le sélecteur (comportement d'avant).
 * La métadonnée `seed.createdAtEstimated` signale que cette date n'est pas une vraie date de création.
 */
const UNDATED_PRESET_CREATED_AT = new Date("2025-04-01T00:00:00.000Z");
const SEED_LOCK_KEY = "egen-theme-studio:seed-built-in-themes";

export interface SeedResult {
  inserted: number;
  existing: number;
}

export async function seedBuiltInThemes(
  db: ThemeDb,
  presets: Record<string, ThemePreset>
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
        origin: "tweakcn-official",
        seed: {
          key: slug,
          file: SEED_SOURCE_FILE,
          ...(createdAt === UNDATED_PRESET_CREATED_AT ? { createdAtEstimated: true } : {}),
        },
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
          currentVersion: 1,
          createdAt,
          updatedAt: at,
        })
        .onConflictDoNothing({ target: themeTable.id })
        .returning({ id: themeTable.id });

      if (created.length === 0) continue; // déjà importé : on ne touche à rien

      await tx
        .insert(themeVersion)
        .values({
          id: cuid(),
          themeId: slug,
          version: 1,
          name,
          description: null,
          styles,
          metadata,
          changeNote: "Version initiale (thème livré avec le dépôt)",
          origin: "SEED",
          contentHash: themeContentHash({ name, description: null, styles }),
          createdBy: null,
          createdAt: at,
        })
        .onConflictDoNothing();

      inserted++;
    }

    return { inserted, existing: Object.keys(presets).length - inserted };
  });
}
