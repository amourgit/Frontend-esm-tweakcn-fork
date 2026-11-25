import * as culori from "culori";

/**
 * Calcul de couleurs pour la dérivation des tokens : tout est fait en oklab/oklch (perceptuel),
 * le canal alpha est conservé, et toute couleur illisible retombe sur une valeur de repli
 * (jamais d'exception : un thème partiel ou mal saisi ne doit pas casser l'éditeur).
 */

const toOklch = culori.converter("oklch");

export const LIGHT_TEXT = "oklch(0.985 0 0)";
export const DARK_TEXT = "oklch(0.205 0 0)";

export const parseColor = (value: string | undefined): culori.Color | undefined => {
  if (!value) return undefined;
  try {
    return culori.parse(value) ?? undefined;
  } catch {
    return undefined;
  }
};

const COLOR_PREFIX = /^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|hwb\(|color\()/i;

/** Vrai pour une valeur de couleur CSS littérale (pas pour var(), calc() ni color-mix()). */
export const isColorValue = (value: unknown): value is string =>
  typeof value === "string" &&
  (COLOR_PREFIX.test(value.trim()) || value.trim().toLowerCase() === "transparent") &&
  parseColor(value) !== undefined;

const round3 = (n: number | undefined) =>
  n === undefined || Number.isNaN(n) ? 0 : Number(n.toFixed(3));

export function formatOklch(color: culori.Color): string {
  const c = toOklch(color);
  const alpha = c.alpha !== undefined && c.alpha < 1 ? ` / ${round3(c.alpha)}` : "";
  return `oklch(${round3(c.l)} ${round3(c.c)} ${round3(c.h)}${alpha})`;
}

/** Mélange perceptuel de `a` vers `b` (t = 0 → a, t = 1 → b). Repli : `a`. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca) return a;
  if (!cb) return a;
  try {
    return formatOklch(culori.interpolate([ca, cb], "oklab")(t));
  } catch {
    return a;
  }
}

export function withAlpha(value: string, alpha: number): string {
  const c = parseColor(value);
  if (!c) return value;
  return formatOklch({ ...c, alpha });
}

/** Texte clair ou sombre, selon le meilleur contraste WCAG sur `background`. */
export function readableOn(background: string): string {
  const bg = parseColor(background);
  if (!bg) return LIGHT_TEXT;
  const light = culori.wcagContrast(bg, LIGHT_TEXT);
  const dark = culori.wcagContrast(bg, DARK_TEXT);
  return light >= dark ? LIGHT_TEXT : DARK_TEXT;
}

export const chromaOf = (value: string): number => {
  const c = parseColor(value);
  return c ? (toOklch(c).c ?? 0) : 0;
};

export const lightnessOf = (value: string): number => {
  const c = parseColor(value);
  return c ? (toOklch(c).l ?? 0) : 0;
};

export const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
export type Shade = (typeof SHADES)[number];

const RAMP_LIGHTNESS = [0.975, 0.945, 0.895, 0.82, 0.72, 0.63, 0.55, 0.47, 0.39, 0.32, 0.23];
const RAMP_CHROMA = [0.1, 0.22, 0.45, 0.72, 0.92, 1, 1, 0.9, 0.76, 0.6, 0.42];

/**
 * Rampe de 11 nuances (50 → 950) autour d'une couleur de base : même teinte, luminosité
 * décroissante, chroma en cloche. La nuance dont la luminosité est la plus proche de la base
 * est remplacée par la base elle-même, pour que la couleur du thème figure exactement dans sa rampe.
 */
export function generateRamp(base: string): Record<Shade, string> {
  const parsed = parseColor(base);
  const ramp = {} as Record<Shade, string>;
  if (!parsed) {
    SHADES.forEach((shade, i) => (ramp[shade] = formatOklch({ mode: "oklch", l: RAMP_LIGHTNESS[i], c: 0, h: 0 })));
    return ramp;
  }
  const o = toOklch(parsed);
  const hue = Number.isNaN(o.h) || o.h === undefined ? 0 : o.h;
  const baseL = o.l ?? 0.5;
  let nearest = 0;
  RAMP_LIGHTNESS.forEach((l, i) => {
    if (Math.abs(l - baseL) < Math.abs(RAMP_LIGHTNESS[nearest] - baseL)) nearest = i;
  });
  const scale = (o.c ?? 0) / RAMP_CHROMA[nearest];
  SHADES.forEach((shade, i) => {
    if (i === nearest) {
      ramp[shade] = formatOklch(parsed);
      return;
    }
    const color = culori.clampChroma(
      { mode: "oklch", l: RAMP_LIGHTNESS[i], c: scale * RAMP_CHROMA[i], h: hue },
      "oklch"
    );
    ramp[shade] = formatOklch(color);
  });
  return ramp;
}
