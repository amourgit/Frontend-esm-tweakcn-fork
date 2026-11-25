import { describe, expect, it } from "vitest";

import { defaultThemeState } from "@/config/theme";
import type { ThemeStyles } from "@/types/theme";
import { DERIVED_COLOR_KEYS } from "@/utils/tokens/derive";
import { flatten, getPath } from "@/utils/tokens/object-path";
import { chromaOf, isColorValue } from "@/utils/tokens/color-math";
import { getTokenDefinitions } from "@/utils/tokens/registry";
import { BASE_STYLE_KEYS, resolveTheme } from "@/utils/tokens/resolve";
import { clone, stylesOf, THEME_NAMES } from "./helpers";

describe("résolution du thème", () => {
  it("le thème par défaut est complet : 44 clés tweakcn + couleurs étendues, dans les deux modes", () => {
    const r = resolveTheme(defaultThemeState.styles);
    expect(BASE_STYLE_KEYS).toHaveLength(44);
    for (const mode of ["light", "dark"] as const) {
      for (const key of [...BASE_STYLE_KEYS, ...DERIVED_COLOR_KEYS]) {
        expect(r[mode][key], `${mode}.${key}`).toBeTruthy();
      }
    }
  });

  it("chaque token du catalogue a une valeur résolue (rien d'oublié)", () => {
    const { tokens } = resolveTheme(defaultThemeState.styles);
    for (const def of getTokenDefinitions().filter((d) => !d.optional)) {
      expect(getPath(tokens, def.path), def.id).not.toBeUndefined();
    }
  });

  it.each(THEME_NAMES)("preset « %s » : toutes les clés du squelette sont résolues", (name) => {
    const r = resolveTheme(stylesOf(name));
    for (const mode of ["light", "dark"] as const) {
      for (const key of DERIVED_COLOR_KEYS) {
        expect(typeof r[mode][key], `${name} ${mode}.${key}`).toBe("string");
        expect(r[mode][key], `${name} ${mode}.${key}`).not.toBe("");
      }
    }
    expect(flatten(r.tokens).length).toBeGreaterThan(380);
  });

  it("les valeurs dérivées suivent les couleurs du thème (preset violet ≠ neutre)", () => {
    const violet = resolveTheme(stylesOf("violet-bloom"));
    const neutral = resolveTheme(defaultThemeState.styles);
    expect(chromaOf(violet.light["primary-hover"])).toBeGreaterThan(0.1);
    expect(chromaOf(neutral.light["primary-hover"])).toBeLessThan(0.02);
    expect(violet.light.link).toBe(violet.light.primary); // lien = primary quand il est coloré
    expect(chromaOf((violet.tokens as never as { palette: { primary: Record<string, string> } }).palette.primary["500"])).toBeGreaterThan(0.1);
  });

  it("un override explicite gagne ; le retirer ramène la valeur dérivée", () => {
    const base = stylesOf("violet-bloom");
    const derived = resolveTheme(base).light["success"];
    const custom = clone(base) as ThemeStyles;
    (custom.light as Record<string, string>).success = "#10002b";
    expect(resolveTheme(custom).light.success).toBe("#10002b");
    expect(resolveTheme(custom).light["success-foreground"]).not.toBe(resolveTheme(base).light["success-foreground"]); // dérivés de l'override
    delete (custom.light as Record<string, string>).success;
    expect(resolveTheme(custom).light.success).toBe(derived);
  });

  it("un thème ne renseigne que ce qu'il veut : override partiel de tokens, le reste vient du squelette", () => {
    const styles = {
      ...clone(defaultThemeState.styles),
      tokens: { motion: { duration: { fast: "80ms" } }, layout: { sidebar: { width: "18rem" } } },
    } as ThemeStyles;
    const { tokens } = resolveTheme(styles);
    expect(getPath(tokens, ["motion", "duration", "fast"])).toBe("80ms");
    expect(getPath(tokens, ["motion", "duration", "slow"])).toBe("500ms");
    expect(getPath(tokens, ["layout", "sidebar", "width"])).toBe("18rem");
    expect(getPath(tokens, ["layout", "sidebar", "collapsedWidth"])).toBe("4rem");
  });

  it("une valeur vide ou undefined est « non renseignée » (le défaut reste)", () => {
    const styles = { ...clone(defaultThemeState.styles), tokens: { motion: { duration: { fast: "" } } } } as ThemeStyles;
    expect(getPath(resolveTheme(styles).tokens, ["motion", "duration", "fast"])).toBe("100ms");
  });

  it("ne lève jamais d'exception sur des couleurs invalides ou un thème sans tokens/extras", () => {
    const broken = clone(defaultThemeState.styles) as ThemeStyles;
    (broken.light as Record<string, string>).primary = "pas-une-couleur";
    (broken.dark as Record<string, string>).background = "???";
    expect(() => resolveTheme(broken)).not.toThrow();
    expect(() => resolveTheme({ light: {}, dark: {} } as ThemeStyles)).not.toThrow();
  });

  it("conserve les clés inconnues (couleurs propres à un thème)", () => {
    const styles = clone(defaultThemeState.styles) as ThemeStyles;
    (styles.light as Record<string, string>)["brand-gold"] = "#d4af37";
    expect(resolveTheme(styles).light["brand-gold"]).toBe("#d4af37");
  });

  it("ne mute jamais son entrée", () => {
    const styles = clone(stylesOf("violet-bloom"));
    const before = JSON.stringify(styles);
    resolveTheme(styles);
    expect(JSON.stringify(styles)).toBe(before);
  });

  it("les rampes de palette dérivées contiennent la couleur du thème et sont de vraies couleurs", () => {
    const { tokens } = resolveTheme(stylesOf("violet-bloom"));
    const ramp = (tokens as never as { palette: Record<string, Record<string, string>> }).palette;
    for (const name of ["primary", "secondary", "accent", "neutral", "success", "warning", "info", "error"]) {
      expect(Object.keys(ramp[name])).toHaveLength(11);
      for (const value of Object.values(ramp[name])) expect(isColorValue(value), `${name} ${value}`).toBe(true);
    }
  });
});
