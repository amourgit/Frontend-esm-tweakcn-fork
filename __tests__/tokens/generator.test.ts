import { describe, expect, it } from "vitest";

import { DERIVED_COLOR_KEYS } from "@/utils/tokens/derive";
import { tokenCssVarName } from "@/utils/tokens/css-vars";
import { flatten } from "@/utils/tokens/object-path";
import { getTokenDefinitions } from "@/utils/tokens/registry";
import { resolveTheme } from "@/utils/tokens/resolve";
import { generateTailwindConfigCode, generateThemeCode } from "@/utils/theme-style-generator";
import { sha, golden } from "./golden";
import { stateOf, stylesOf, THEME_NAMES } from "./helpers";

const FORMATS = [
  ["hsl", "3"],
  ["oklch", "4"],
  ["hex", "4"],
  ["rgb", "3"],
] as const;

describe("export CSS — portée « standard » (compatibilité shadcn)", () => {
  it("est strictement identique à l'export d'avant l'intégration, pour tous les thèmes et formats", () => {
    const mismatches: string[] = [];
    for (const name of THEME_NAMES) {
      for (const [fmt, tw] of FORMATS) {
        const key = `css:${name}:${fmt}:${tw}`;
        // Sans option : la portée par défaut du générateur reste « standard ».
        if (sha(generateThemeCode(stateOf(name), fmt, tw)) !== golden[key]) mismatches.push(key);
        if (sha(generateThemeCode(stateOf(name), fmt, tw, { scope: "standard" })) !== golden[key]) mismatches.push(`${key} (scope)`);
      }
      const tw3 = `tw3:${name}`;
      if (sha(generateTailwindConfigCode(stateOf(name), "hsl", "3")) !== golden[tw3]) mismatches.push(tw3);
    }
    expect(mismatches).toEqual([]);
  });
});

describe("export CSS — portée « complete » (squelette EGEN)", () => {
  it.each(THEME_NAMES)("« %s » : émet toutes les couleurs étendues et tous les tokens", (name) => {
    const css = generateThemeCode(stateOf(name), "oklch", "4", { scope: "complete" });
    const [rootBlock, darkBlock] = [css.split(/^\.dark \{/m)[0], css.split(/^\.dark \{/m)[1]];
    for (const key of DERIVED_COLOR_KEYS) {
      expect(rootBlock, `:root --${key}`).toMatch(new RegExp(`^  --${key}: `, "m"));
      expect(darkBlock, `.dark --${key}`).toMatch(new RegExp(`^  --${key}: `, "m"));
    }
    const { tokens } = resolveTheme(stylesOf(name));
    for (const { path } of flatten(tokens)) {
      expect(rootBlock, tokenCssVarName(path)).toContain(`  ${tokenCssVarName(path)}: `);
    }
    // les tokens (indépendants du mode) ne sont pas répétés dans .dark
    expect(darkBlock).not.toContain("--motion-duration-fast");
  });

  it("n'émet jamais de valeur vide ni « undefined »", () => {
    for (const name of THEME_NAMES) {
      for (const [fmt, tw] of FORMATS) {
        const css = generateThemeCode(stateOf(name), fmt, tw, { scope: "complete" });
        expect(css, `${name} ${fmt}`).not.toMatch(/undefined|NaN|\[object Object\]/);
        expect(css, `${name} ${fmt}`).not.toMatch(/--[\w-]+:\s*;/);
      }
    }
  });

  it("préserve l'alpha des couleurs translucides dans tous les formats", () => {
    const css = (fmt: "hsl" | "oklch" | "hex" | "rgb", tw: "3" | "4") =>
      generateThemeCode(stateOf("default"), fmt, tw, { scope: "complete" });
    expect(css("oklch", "4")).toMatch(/--overlay: oklch\([^)]*\/ 0\.45\)/);
    expect(css("hsl", "3")).toMatch(/--overlay: 0 0% 0% \/ 0\.45;/);
    expect(css("hex", "4")).toMatch(/--overlay: #00000073;/);
    expect(css("rgb", "3")).toMatch(/--overlay: rgba\(0, 0, 0, 0\.45\)/);
  });

  it("Tailwind v4 : @theme inline expose couleurs, tailles de texte, easings, radius et blur", () => {
    const css = generateThemeCode(stateOf("violet-bloom"), "oklch", "4", { scope: "complete" });
    for (const line of [
      "--color-success: var(--success);",
      "--color-primary-hover: var(--primary-hover);",
      "--color-surface-sunken: var(--surface-sunken);",
      "--text-xs: var(--typography-font-size-xs-size);",
      "--text-xs--line-height: var(--typography-font-size-xs-line-height);",
      "--font-weight-semibold: var(--typography-font-weight-semibold);",
      "--leading-tight: var(--typography-line-height-tight);",
      "--ease-in-out: var(--motion-easing-in-out);",
      "--ease-spring: var(--motion-easing-spring);",
      "--radius-2xl: var(--radius-2xl);",
      "--radius-md: var(--radius-md);",
      "--blur-md: var(--effects-blur-md);",
    ]) {
      expect(css, line).toContain(line);
    }
  });

  it("Tailwind v3 : le config expose couleurs étendues, fontSize, motion, zIndex, blur", () => {
    const config = generateTailwindConfigCode(stateOf("violet-bloom"), "hsl", "3", { scope: "complete" });
    for (const needle of [
      '"success": "hsl(var(--success))"',
      '"primary-hover": "hsl(var(--primary-hover))"',
      "fontSize: {",
      '"xs": ["var(--typography-font-size-xs-size)"',
      "transitionTimingFunction: {",
      '"in-out": "var(--motion-easing-in-out)"',
      "zIndex: {",
      '"modal": "var(--z-index-modal)"',
      "blur: {",
    ]) {
      expect(config, needle).toContain(needle);
    }
    // le config reste du JS valide
    expect(() => new Function("module", config)({ exports: {} })).not.toThrow();
  });

  it("les ombres imposées par le thème remplacent le calcul tweakcn", () => {
    const styles = {
      ...stylesOf("default"),
      tokens: { shadow: { override: { md: "0 4px 0 0 oklch(0 0 0 / 0.5)" } } },
    };
    const css = generateThemeCode(stateOf("default", styles), "oklch", "4", { scope: "complete" });
    expect(css).toContain("--shadow-md: 0 4px 0 0 oklch(0 0 0 / 0.5);");
    expect(css).not.toContain("--shadow-override-md");
    // et l'export standard bénéficie aussi de l'override
    expect(generateThemeCode(stateOf("default", styles), "oklch", "4")).toContain("--shadow-md: 0 4px 0 0 oklch(0 0 0 / 0.5);");
  });

  it("catalogue : chaque token du catalogue (hors overrides optionnels) est émis", () => {
    const css = generateThemeCode(stateOf("default"), "oklch", "4", { scope: "complete" });
    for (const def of getTokenDefinitions().filter((d) => !d.optional)) {
      expect(css, def.cssVar).toContain(`  ${def.cssVar}: `);
    }
  });
});
