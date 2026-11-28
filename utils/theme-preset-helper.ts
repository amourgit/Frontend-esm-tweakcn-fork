import { defaultThemeState } from "../config/theme";
import { ThemeStyles } from "../types/theme";
import { useThemePresetStore } from "../store/theme-preset-store";
import { defaultPresets } from "./theme-presets";
import { mergePresetWithDefaults } from "./theme-merge";

export { mergePresetWithDefaults };

/**
 * Get built-in theme styles by name (without using store).
 * Use this for server-side code where store access is not available.
 * Returns null if the preset doesn't exist.
 */
export function getBuiltInThemeStyles(name: string): { name: string; styles: ThemeStyles } | null {
  const preset = defaultPresets[name];
  if (!preset) {
    return null;
  }

  const styles = mergePresetWithDefaults(preset.styles);
  return {
    name: preset.label || name,
    styles,
  };
}

export function getPresetThemeStyles(name: string): ThemeStyles {
  const store = useThemePresetStore.getState();
  const preset = store.getPreset(name);
  if (!preset) {
    // Catalogue pas encore chargé (ou thème inconnu) : repli sur le squelette par défaut du code.
    return defaultThemeState.styles;
  }

  return mergePresetWithDefaults(preset.styles);
}
