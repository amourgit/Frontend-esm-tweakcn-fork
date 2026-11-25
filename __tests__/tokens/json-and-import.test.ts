import { describe, expect, it } from "vitest";

import { defaultThemeState } from "@/config/theme";
import { parseCssInput } from "@/utils/parse-css-input";
import { generateThemeCode } from "@/utils/theme-style-generator";
import { buildEgenTokensDocument, mergeImportedStyles, minimizeStyles, parseEgenTokensDocument } from "@/utils/tokens/export-json";
import { DERIVED_COLOR_KEYS } from "@/utils/tokens/derive";
import { flatten, getPath, treeEquals } from "@/utils/tokens/object-path";
import { resolveTheme } from "@/utils/tokens/resolve";
import { getTokenDefinitions } from "@/utils/tokens/registry";
import * as culori from "culori";
import { clone, stateOf, stylesOf, THEME_NAMES } from "./helpers";
import skeleton from "@/config/tokens/egen-theme-skeleton.json";
import type { ThemeStyles } from "@/types/theme";

describe("egen-tokens.json — export / import", () => {
  it("aller-retour sans perte pour les 43 thèmes (la forme minimale est retrouvée)", () => {
    for (const name of THEME_NAMES) {
      const styles = stylesOf(name);
      const parsed = parseEgenTokensDocument(JSON.parse(JSON.stringify(buildEgenTokensDocument(styles, { name }))));
      expect(parsed.ok, name).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.extendedCount + parsed.tokenCount, `${name}: aucun override fantôme`).toBe(0);
      const a = resolveTheme(styles);
      const b = resolveTheme(parsed.styles);
      expect(treeEquals(a.light, b.light) && treeEquals(a.dark, b.dark) && treeEquals(a.tokens, b.tokens), name).toBe(true);
    }
  });

  it("les vraies personnalisations survivent à l'aller-retour", () => {
    const styles = {
      ...clone(stylesOf("violet-bloom")),
      tokens: { motion: { duration: { fast: "70ms" } }, layout: { header: { height: "5rem" } } },
    } as ThemeStyles;
    (styles.light as Record<string, string>).success = "#10002b";
    (styles.dark as Record<string, string>)["header"] = "#101010";
    const parsed = parseEgenTokensDocument(JSON.parse(JSON.stringify(buildEgenTokensDocument(styles))));
    expect(parsed.ok && parsed.styles.tokens).toEqual({ motion: { duration: { fast: "70ms" } }, layout: { header: { height: "5rem" } } });
    expect(parsed.ok && (parsed.styles.light as Record<string, string>).success).toBe("#10002b");
    expect(parsed.ok && (parsed.styles.dark as Record<string, string>).header).toBe("#101010");
    expect(parsed.ok && (parsed.styles.light as Record<string, string>)["success-hover"]).toBeUndefined();
  });

  it("accepte un document PARTIEL (un thème ne renseigne que ce qu'il veut)", () => {
    const parsed = parseEgenTokensDocument({ tokens: { motion: { duration: { fast: "60ms" } } } });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(getPath(resolveTheme(parsed.styles).tokens, ["motion", "duration", "fast"])).toBe("60ms");
    expect(getPath(resolveTheme(parsed.styles).tokens, ["motion", "duration", "slow"])).toBe("500ms");
  });

  it("rejette les documents invalides avec un message clair", () => {
    expect(parseEgenTokensDocument(null)).toMatchObject({ ok: false });
    expect(parseEgenTokensDocument([])).toMatchObject({ ok: false });
    expect(parseEgenTokensDocument({})).toMatchObject({ ok: false });
    expect(parseEgenTokensDocument({ light: { primary: 3 } })).toMatchObject({ ok: false, error: expect.stringContaining("light.primary") });
    expect(parseEgenTokensDocument({ tokens: "x" })).toMatchObject({ ok: false });
  });

  it("fusion à l'import : ne perd ni les tokens ni les couleurs déjà personnalisés", () => {
    const current = { ...clone(stylesOf("default")), tokens: { layout: { header: { height: "5rem" } } } } as ThemeStyles;
    const imported = parseEgenTokensDocument({ tokens: { motion: { duration: { fast: "60ms" } } } });
    if (!imported.ok) throw new Error("import");
    const merged = mergeImportedStyles(current, imported.styles);
    expect(merged.tokens).toEqual({ layout: { header: { height: "5rem" } }, motion: { duration: { fast: "60ms" } } });
  });

  it("minimizeStyles retire exactement ce qui est dérivable", () => {
    const full = clone(stylesOf("default")) as ThemeStyles;
    const resolved = resolveTheme(full);
    (full.light as Record<string, string>) = { ...full.light, ...Object.fromEntries(DERIVED_COLOR_KEYS.map((k) => [k, resolved.light[k]])) };
    expect(Object.keys(minimizeStyles(full).light)).toHaveLength(44);
  });
});

describe("squelette de référence config/tokens/egen-theme-skeleton.json", () => {
  it("est à jour (régénérer avec `pnpm tokens:skeleton`)", () => {
    const fresh = buildEgenTokensDocument(defaultThemeState.styles, {
      name: "EGEN Skeleton",
      description:
        "Squelette de référence neutre : toutes les variables nécessaires pour construire un thème. Un thème n'en renseigne que ce qu'il veut personnaliser.",
      author: "EGEN / CIVITAS",
    });
    expect(JSON.parse(JSON.stringify(fresh))).toEqual(skeleton);
  });

  it("couvre tout le catalogue de tokens et toutes les couleurs étendues", () => {
    for (const def of getTokenDefinitions().filter((d) => !d.optional)) {
      expect(getPath(skeleton.tokens, def.path), def.id).not.toBeUndefined();
    }
    for (const key of DERIVED_COLOR_KEYS) {
      expect((skeleton.light as Record<string, string>)[key], key).toBeTruthy();
      expect((skeleton.dark as Record<string, string>)[key], key).toBeTruthy();
    }
    expect(flatten(skeleton.tokens).length).toBeGreaterThan(380);
  });
});

describe("import CSS du squelette complet", () => {
  const deltaE = culori.differenceEuclidean("oklab");

  it.each(["default", "violet-bloom", "cyberpunk", "mocha-mousse"])("« %s » : export complet → import → même thème résolu", (name) => {
    const css = generateThemeCode(stateOf(name), "oklch", "4", { scope: "complete" });
    const { lightColors, darkColors, tokens } = parseCssInput(css);
    // Rien de ce qui est dérivable ne doit rester un override après minimisation
    const imported = minimizeStyles({
      ...clone(defaultThemeState.styles),
      light: { ...defaultThemeState.styles.light, ...lightColors },
      dark: { ...defaultThemeState.styles.dark, ...darkColors },
      ...(tokens ? { tokens } : {}),
    } as ThemeStyles);
    const original = resolveTheme(stylesOf(name));
    const reimported = resolveTheme(imported);

    for (const mode of ["light", "dark"] as const) {
      for (const key of DERIVED_COLOR_KEYS) {
        const a = culori.parse(original[mode][key]);
        const b = culori.parse(reimported[mode][key]);
        expect(a && b, `${name} ${mode}.${key}`).toBeTruthy();
        // Tolérance : l'import convertit en hex (écrêtage sRGB des couleurs hors gamut) ; l'alpha doit rester identique
        expect(deltaE(a!, b!), `${name} ${mode}.${key}`).toBeLessThan(0.03);
        expect(a!.alpha ?? 1).toBeCloseTo(b!.alpha ?? 1, 2);
      }
    }
    // Tokens non colorés : égalité exacte
    for (const def of getTokenDefinitions().filter((d) => d.kind !== "color" && !d.optional)) {
      expect(String(getPath(reimported.tokens, def.path)), `${name} ${def.id}`).toBe(String(getPath(original.tokens, def.path)));
    }
  });

  it("un CSS ne contenant que quelques variables étendues n'écrase rien d'autre", () => {
    const { lightColors, tokens } = parseCssInput(":root { --success: #00aa55; --motion-duration-fast: 90ms; --layout-sidebar-position: right; }");
    expect((lightColors as Record<string, string>).success).toBe("#00aa55");
    expect(tokens).toEqual({ motion: { duration: { fast: "90ms" } }, layout: { sidebar: { position: "right" } } });
    expect(Object.keys(lightColors)).toEqual(["success"]);
  });
});
