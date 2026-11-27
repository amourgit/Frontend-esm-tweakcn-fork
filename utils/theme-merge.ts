import { defaultThemeState } from "../config/theme";
import type { PartialThemeStyleProps, ThemeStyles, ThemeTokens } from "../types/theme";

/**
 * Un preset ne renseigne que ce qu'il personnalise : les 44 clés tweakcn manquantes viennent des
 * défauts ; les couleurs étendues et `tokens` restent des overrides OPTIONNELS (ce qui n'est pas
 * renseigné est dérivé des couleurs du preset par `resolveTheme`, jamais copié d'un thème neutre).
 *
 * Module pur (aucun import de store ni de server action) : utilisable par le seed en base, les
 * scripts Node et le bundle client.
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
