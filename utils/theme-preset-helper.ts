import { defaultThemeState } from "../config/theme";
import { ThemeStyles, ThemeTokens, PartialThemeStyleProps } from "../types/theme";
import { useThemePresetStore } from "../store/theme-preset-store";
import { defaultPresets } from "./theme-presets";

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

/**
 * Un preset ne renseigne que ce qu'il personnalise : les 44 clés tweakcn manquantes viennent des
 * défauts ; les couleurs étendues et `tokens` restent des overrides OPTIONNELS (ce qui n'est pas
 * renseigné est dérivé des couleurs du preset par `resolveTheme`, jamais copié d'un thème neutre).
 */
export function mergePresetWithDefaults(presetStyles: {
  light?: PartialThemeStyleProps;
  dark?: PartialThemeStyleProps;
  tokens?: ThemeTokens;
}): ThemeStyles {
  const defaultTheme = defaultThemeState.styles;
  const merged = {
    light: {
      ...defaultTheme.light,
      ...(presetStyles.light || {}),
    },
    dark: {
      ...defaultTheme.dark,
      ...(presetStyles.light || {}),
      ...(presetStyles.dark || {}),
    },
  } as ThemeStyles;
  if (presetStyles.tokens && Object.keys(presetStyles.tokens).length > 0) {
    merged.tokens = presetStyles.tokens;
  }
  return merged;
}

export function getPresetThemeStyles(name: string): ThemeStyles {
  if (name === "default") {
    return defaultThemeState.styles;
  }

  const store = useThemePresetStore.getState();
  const preset = store.getPreset(name);
  if (!preset) {
    return defaultThemeState.styles;
  }

  return mergePresetWithDefaults(preset.styles);
}
