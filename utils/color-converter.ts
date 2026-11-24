import * as culori from "culori";
import { ColorFormat } from "../types";
import { Hsl } from "culori";

export const formatNumber = (num?: number) => {
  if (!num) return "0";
  return num % 1 === 0 ? num : num.toFixed(4);
};

// Canal alpha : n'est émis que s'il est inférieur à 1, pour que les couleurs opaques gardent
// exactement leur forme historique (aucune régression sur les 40 presets existants).
const alphaOf = (color: { alpha?: number }): number | undefined =>
  typeof color.alpha === "number" && color.alpha < 1 ? Math.max(0, color.alpha) : undefined;

const formatAlpha = (alpha: number) => Number(alpha.toFixed(3)).toString();

const withAlpha = (components: string, alpha?: number) =>
  alpha === undefined ? components : `${components} / ${formatAlpha(alpha)}`;

export const formatHsl = (hsl: Hsl) => {
  return `hsl(${withAlpha(
    `${formatNumber(hsl.h)} ${formatNumber(hsl.s * 100)}% ${formatNumber(hsl.l * 100)}%`,
    alphaOf(hsl)
  )})`;
};

export interface ColorFormatterOptions {
  /**
   * Conserve le canal alpha des couleurs translucides (rgba, hsla, #rrggbbaa, oklch(… / a)).
   * Vrai par défaut. À désactiver quand l'opacité est portée par un autre paramètre
   * (ex. `shadow-opacity`, qui ajoute lui-même `/ <opacité>` après la couleur).
   */
  preserveAlpha?: boolean;
}

export const colorFormatter = (
  colorValue: string,
  format: ColorFormat = "hsl",
  tailwindVersion: "3" | "4" = "3",
  options: ColorFormatterOptions = {}
): string => {
  const { preserveAlpha = true } = options;
  try {
    const parsed = culori.parse(colorValue);
    if (!parsed) throw new Error("Invalid color input");
    const color = preserveAlpha ? parsed : { ...parsed, alpha: 1 };
    const alpha = alphaOf(color);

    switch (format) {
      case "hsl": {
        const hsl = culori.converter("hsl")(color);
        if (tailwindVersion === "4") {
          return formatHsl(hsl);
        }
        return withAlpha(
          `${formatNumber(hsl.h)} ${formatNumber(hsl.s * 100)}% ${formatNumber(hsl.l * 100)}%`,
          alpha
        );
      }
      case "rgb":
        return culori.formatRgb(color); // e.g., "rgb(64, 128, 192)"
      case "oklch": {
        const oklch = culori.converter("oklch")(color);
        return `oklch(${withAlpha(
          `${formatNumber(oklch.l)} ${formatNumber(oklch.c)} ${formatNumber(oklch.h)}`,
          alpha
        )})`;
      }
      case "hex":
        // e.g., "#4080c0", ou "#4080c0b8" (8 chiffres) pour une couleur translucide
        return alpha === undefined ? culori.formatHex(color) : culori.formatHex8(color);
      default:
        return colorValue;
    }
  } catch (error) {
    console.error(`Failed to convert color: ${colorValue}`, error);
    return colorValue;
  }
};

export const convertToHSL = (colorValue: string): string => colorFormatter(colorValue, "hsl");
