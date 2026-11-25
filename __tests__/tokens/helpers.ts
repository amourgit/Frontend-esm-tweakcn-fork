import { defaultThemeState } from "@/config/theme";
import type { ThemeEditorState } from "@/types/editor";
import type { ThemeStyles } from "@/types/theme";
import { defaultPresets } from "@/utils/theme-presets";
import { getBuiltInThemeStyles } from "@/utils/theme-preset-helper";

export const THEME_NAMES = ["default", ...Object.keys(defaultPresets)];

export const stylesOf = (name: string): ThemeStyles =>
  name === "default" ? defaultThemeState.styles : getBuiltInThemeStyles(name)!.styles;

export const stateOf = (name: string, styles = stylesOf(name)): ThemeEditorState =>
  ({ ...defaultThemeState, styles, preset: name }) as ThemeEditorState;

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
