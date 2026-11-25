import { defaultThemeState } from "@/config/theme";
import { ThemeStyles } from "@/types/theme";

export function mergeThemeStylesWithDefaults(themeStyles: ThemeStyles): ThemeStyles {
  const mergedStyles: ThemeStyles = {
    ...defaultThemeState.styles,
    light: { ...defaultThemeState.styles.light, ...themeStyles.light },
    dark: { ...defaultThemeState.styles.dark, ...themeStyles.dark },
  };
  if (themeStyles.tokens) mergedStyles.tokens = themeStyles.tokens;
  return mergedStyles;
}
