import fs from "fs";
import path from "path";

import { generateThemeRegistryItemFromStyles } from "@/utils/registry/themes";
import { defaultPresets } from "@/utils/theme-presets";
import { defaultThemeState } from "@/config/theme";
import { ThemeStyles } from "@/types/theme";

const THEMES_DIR = path.join(process.cwd(), "public", "r", "themes");

// Ensure directory exists
if (!fs.existsSync(THEMES_DIR)) {
  fs.mkdirSync(THEMES_DIR, { recursive: true });
}

// Helper to get preset theme styles without going through the store
function getPresetThemeStylesForScript(name: string): ThemeStyles {
  const defaultTheme = defaultThemeState.styles;
  if (name === "default") {
    return defaultTheme;
  }

  const preset = defaultPresets[name];
  if (!preset) {
    return defaultTheme;
  }

  return {
    light: {
      ...defaultTheme.light,
      ...(preset.styles.light || {}),
    },
    dark: {
      ...defaultTheme.dark,
      ...(preset.styles.light || {}),
      ...(preset.styles.dark || {}),
    },
  };
}

// Generate registry files for all presets
Object.keys(defaultPresets).forEach((name) => {
  const themeStyles = getPresetThemeStylesForScript(name);

  // Generate shadcn registry format
  const registryItem = generateThemeRegistryItemFromStyles(name, themeStyles);
  const filePath = path.join(THEMES_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(registryItem, null, 2));
  console.log(`Generated registry file for theme: ${name}`);
});
