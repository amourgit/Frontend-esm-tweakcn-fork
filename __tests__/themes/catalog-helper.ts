import type { Theme } from "@/types/theme";
import { defaultPresets } from "@/utils/theme-presets";
import { mergePresetWithDefaults } from "@/utils/theme-merge";

/** Lignes `theme` telles que le seed les écrit en base (thèmes système, version 1) — pour hydrater le store dans les tests. */
export function builtInThemeRows(): Theme[] {
  const at = new Date("2025-04-01T00:00:00.000Z");
  return Object.entries(defaultPresets).map(([id, preset]) => ({
    id,
    userId: null,
    source: "BUILT_IN" as const,
    name: preset.label || id,
    description: null,
    styles: mergePresetWithDefaults(preset.styles),
    metadata: {},
    currentVersion: 1,
    deletedAt: null,
    createdAt: preset.createdAt ? new Date(preset.createdAt) : at,
    updatedAt: at,
  }));
}
