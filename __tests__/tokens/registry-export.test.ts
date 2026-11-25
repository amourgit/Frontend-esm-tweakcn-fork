import { registryItemSchema } from "shadcn/schema";
import { describe, expect, it } from "vitest";

import { DERIVED_COLOR_KEYS } from "@/utils/tokens/derive";
import { tokenCssVarName } from "@/utils/tokens/css-vars";
import { flatten } from "@/utils/tokens/object-path";
import { resolveTheme } from "@/utils/tokens/resolve";
import { generateThemeRegistryItemFromStyles } from "@/utils/registry/themes";
import { golden, sha } from "./golden";
import { clone, stylesOf, THEME_NAMES } from "./helpers";

describe("export registre shadcn", () => {
  it("standard : identique à l'export d'avant l'intégration (43 thèmes) et valide pour shadcn", () => {
    const mismatches: string[] = [];
    for (const name of THEME_NAMES) {
      const item = generateThemeRegistryItemFromStyles(name, clone(stylesOf(name)));
      if (sha(JSON.stringify(item)) !== golden[`registry:${name}`]) mismatches.push(name);
      expect(registryItemSchema.safeParse(item).success, `${name} schema`).toBe(true);
    }
    expect(mismatches).toEqual([]);
  });

  it.each(THEME_NAMES)("complete « %s » : valide pour shadcn, couleurs étendues + tokens présents", (name) => {
    const item = generateThemeRegistryItemFromStyles(name, clone(stylesOf(name)), "complete");
    const parsed = registryItemSchema.safeParse(item);
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 2))).toBe(true);

    const cssVars = item.cssVars as { light: Record<string, string>; dark: Record<string, string> };
    for (const key of DERIVED_COLOR_KEYS) {
      expect(cssVars.light[key], `light.${key}`).toBeTruthy();
      expect(cssVars.dark[key], `dark.${key}`).toBeTruthy();
    }
    const rootTokens = ((item.css as Record<string, Record<string, Record<string, string>>>)["@layer base"]?.[":root"]) ?? {};
    const { tokens } = resolveTheme(stylesOf(name));
    for (const { path } of flatten(tokens)) expect(rootTokens[tokenCssVarName(path)], tokenCssVarName(path)).toBeDefined();
  });

  it("n'altère jamais le thème source (les deux portées)", () => {
    const styles = clone(stylesOf("violet-bloom"));
    const before = JSON.stringify(styles);
    generateThemeRegistryItemFromStyles("violet-bloom", styles);
    generateThemeRegistryItemFromStyles("violet-bloom", styles, "complete");
    expect(JSON.stringify(styles)).toBe(before);
  });

  it("complete : les couleurs étendues sont converties en oklch, alpha conservé", () => {
    const item = generateThemeRegistryItemFromStyles("default", clone(stylesOf("default")), "complete");
    const light = (item.cssVars as { light: Record<string, string> }).light;
    expect(light.overlay).toMatch(/^oklch\(.* \/ 0\.45\)$/);
    expect(light.success).toMatch(/^oklch\(/);
  });
});
