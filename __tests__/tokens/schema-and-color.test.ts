import { describe, expect, it } from "vitest";

import { defaultThemeState } from "@/config/theme";
import { MAX_THEME_STYLES_BYTES, themeStylesInputSchema, themeStylesSchema } from "@/types/theme";
import { colorFormatter } from "@/utils/color-converter";
import { clone } from "./helpers";

describe("schéma de validation (frontière serveur)", () => {
  const styles = {
    ...clone(defaultThemeState.styles),
    tokens: { typography: { fontSize: { base: { size: "1rem" } } }, zIndex: { modal: 400 } },
  } as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  styles.light.header = "rgba(255,255,255,0.75)";
  styles.light["success-500"] = "#22c55e";

  it("ne détruit plus les clés inconnues ni les tokens", () => {
    const parsed = themeStylesInputSchema.safeParse(styles);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect((parsed.data.light as Record<string, string>).header).toBe("rgba(255,255,255,0.75)");
    expect((parsed.data.light as Record<string, string>)["success-500"]).toBe("#22c55e");
    expect(parsed.data.tokens).toEqual(styles.tokens);
  });

  it("l'ancien schéma strict (utilisé pour les types) les supprimait bien", () => {
    expect(Object.keys(themeStylesSchema.parse(styles).light)).not.toContain("header");
  });

  it("reste strict sur ce qui compte", () => {
    expect(themeStylesInputSchema.safeParse({ ...styles, light: { ...styles.light, x: { a: 1 } } }).success).toBe(false);
    expect(themeStylesInputSchema.safeParse({ light: {}, dark: {} }).success).toBe(false);
    expect(themeStylesInputSchema.safeParse({ ...styles, tokens: { big: "x".repeat(MAX_THEME_STYLES_BYTES) } }).success).toBe(false);
    expect(themeStylesInputSchema.safeParse({ ...styles, tokens: "oops" }).success).toBe(false);
  });

  it("refuse à l'enregistrement un token qui écraserait une couleur ou une ombre du thème", () => {
    expect(themeStylesInputSchema.safeParse({ ...styles, tokens: { border: { subtle: "1px" } } }).success).toBe(false);
    expect(themeStylesInputSchema.safeParse({ ...styles, tokens: { shadow: { md: "0 0 0 0 red" } } }).success).toBe(false);
    expect(themeStylesInputSchema.safeParse({ ...styles, tokens: { shadow: { override: { md: "0 0 0 0 red" } } } }).success).toBe(true);
    expect(themeStylesInputSchema.safeParse({ ...styles, tokens: { radius: { md: "4px" } } }).success).toBe(true);
  });

  it("accepte un thème ancien (sans tokens ni extras)", () => {
    expect(themeStylesInputSchema.safeParse(clone(defaultThemeState.styles)).success).toBe(true);
  });
});

describe("convertisseur de couleurs — canal alpha", () => {
  it("garde la forme historique des couleurs opaques", () => {
    expect(colorFormatter("#ff0000", "hsl", "3")).toBe("0 100% 50%");
    expect(colorFormatter("#ff0000", "hsl", "4")).toBe("hsl(0 100% 50%)");
    expect(colorFormatter("rgb(255,0,0)", "hex")).toBe("#ff0000");
  });
  it("préserve l'alpha dans tous les formats", () => {
    expect(colorFormatter("rgba(255, 255, 255, 0.72)", "hsl", "3")).toBe("0 0% 100% / 0.72");
    expect(colorFormatter("rgba(15, 23, 42, 0.75)", "hsl", "4")).toMatch(/\/ 0\.75\)$/);
    expect(colorFormatter("rgba(0,0,0,0.45)", "oklch")).toMatch(/\/ 0\.45\)$/);
    expect(colorFormatter("rgba(255,0,0,0.5)", "hex")).toBe("#ff000080");
    expect(colorFormatter("rgba(255,0,0,0.5)", "rgb")).toBe("rgba(255, 0, 0, 0.5)");
  });
  it("preserveAlpha:false pour les ombres (l'opacité est portée ailleurs)", () => {
    expect(colorFormatter("rgba(255,0,0,0.5)", "hsl", "3", { preserveAlpha: false })).toBe("0 100% 50%");
  });
});
