import fs from "fs";
import path from "path";

import { generateThemeRegistryItemFromStyles } from "@/utils/registry/themes";
import { defaultPresets } from "@/utils/theme-presets";
import { getBuiltInThemeStyles } from "@/utils/theme-preset-helper";

const THEMES_DIR = path.join(process.cwd(), "public", "r", "themes");

// Ensure directory exists
if (!fs.existsSync(THEMES_DIR)) {
  fs.mkdirSync(THEMES_DIR, { recursive: true });
}

// Generate registry files for all presets
Object.keys(defaultPresets).forEach((name) => {
  const themeStyles = getBuiltInThemeStyles(name)!.styles;

  // shadcn registry format : standard (compatible shadcn) et complet (squelette EGEN : couleurs étendues + tokens)
  for (const [suffix, scope] of [
    ["", "standard"],
    [".complete", "complete"],
  ] as const) {
    const registryItem = generateThemeRegistryItemFromStyles(name, themeStyles, scope);
    const filePath = path.join(THEMES_DIR, `${name}${suffix}.json`);
    fs.writeFileSync(filePath, JSON.stringify(registryItem, null, 2));
  }
  console.log(`Generated registry files for theme: ${name}`);
});
