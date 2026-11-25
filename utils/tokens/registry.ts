import { defaultThemeState } from "@/config/theme";
import { isColorValue } from "./color-math";
import { tokenCssVarName } from "./css-vars";
import { flatten } from "./object-path";
import { resolveTokens } from "./resolve";

/**
 * Catalogue des tokens du squelette (métadonnées pour l'éditeur, l'aperçu et les exports).
 * Construit automatiquement depuis les valeurs par défaut : tout token ajouté au squelette
 * apparaît donc d'office dans l'éditeur — rien ne peut être « oublié ».
 */

export type TokenKind =
  | "color"
  | "length"
  | "duration"
  | "easing"
  | "number"
  | "boolean"
  | "enum"
  | "shadow"
  | "text";

export interface TokenDefinition {
  /** Chemin pointé : « motion.duration.fast ». */
  id: string;
  path: string[];
  cssVar: string;
  group: string;
  subgroup: string;
  label: string;
  kind: TokenKind;
  options?: string[];
  /** Vrai si le token n'a pas de valeur par défaut propre (ex. ombres imposées) : vide = automatique. */
  optional?: boolean;
  defaultValue: string | number | boolean;
}

export const TOKEN_GROUPS: { id: string; title: string; description: string }[] = [
  { id: "palette", title: "Color palette", description: "11-step ramps (50–950) for each role." },
  { id: "typography", title: "Typography", description: "Families, sizes, weights, line heights and text styles." },
  { id: "sizing", title: "Sizing", description: "Containers, control heights and touch targets." },
  { id: "density", title: "Density", description: "Compact, comfortable and spacious scale factors." },
  { id: "radius", title: "Radius", description: "Radius scale and per-component radii." },
  { id: "border", title: "Borders & focus ring", description: "Widths, styles and ring geometry." },
  { id: "shadow", title: "Shadows", description: "Inner/focus shadows, component elevations and scale overrides." },
  { id: "opacity", title: "Opacity", description: "State opacities (disabled, hover, pressed…)." },
  { id: "layout", title: "Layout", description: "Sidebar, header, content, footer and breakpoints." },
  { id: "component", title: "Components", description: "Per-component sizing and spacing." },
  { id: "motion", title: "Motion", description: "Durations, easings, delays and transitions." },
  { id: "effects", title: "Effects & filters", description: "Blur, saturation and brightness scales." },
  { id: "zIndex", title: "Z-index layers", description: "Stacking order." },
  { id: "icons", title: "Icons", description: "Library, stroke width and sizes." },
  { id: "a11y", title: "Accessibility", description: "Contrast target, focus and forced colors." },
];

const ENUMS: Record<string, string[]> = {
  "layout.sidebar.position": ["left", "right"],
  "layout.sidebar.variant": ["solid", "bordered", "floating"],
  "layout.header.variant": ["solid", "bordered", "floating"],
  "layout.sidebar.breakpoint": ["sm", "md", "lg", "xl", "2xl"],
  "border.style": ["solid", "dashed", "dotted", "double"],
  "border.ring.style": ["solid", "dashed", "dotted"],
  "density.default": ["compact", "comfortable", "spacious"],
  "motion.reduced": ["respect", "always", "never"],
  "icons.library": ["lucide", "phosphor", "tabler", "heroicons", "feather", "material"],
  "a11y.focusVisible": ["ring", "outline", "underline"],
  "a11y.forcedColors": ["respect", "ignore"],
};

/** Ombres imposables : valeur vide = ombre calculée par tweakcn depuis les 6 paramètres d'ombre. */
const SHADOW_OVERRIDE_SIZES = ["2xs", "xs", "sm", "default", "md", "lg", "xl", "2xl"];

const LENGTH = /^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch|pt)$/;
const DURATION = /^-?\d*\.?\d+(ms|s)$/;
const EASING = /^(linear|ease|ease-in|ease-out|ease-in-out)$|^cubic-bezier\(|^steps\(/;
const SHADOW = /^(inset\s)?-?\d/;

export function inferKind(id: string, value: string | number | boolean): TokenKind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (id in ENUMS) return "enum";
  if (id.startsWith("shadow.") && !id.startsWith("shadow.component")) return "shadow";
  if (isColorValue(value)) return "color";
  if (LENGTH.test(value)) return "length";
  if (DURATION.test(value)) return "duration";
  if (EASING.test(value)) return "easing";
  if (/^-?\d*\.?\d+$/.test(value)) return "number";
  if (SHADOW.test(value) && /\d(px|rem)/.test(value)) return "shadow";
  return "text";
}

const humanize = (segment: string) =>
  segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());

let cached: TokenDefinition[] | undefined;

export function getTokenDefinitions(): TokenDefinition[] {
  if (cached) return cached;
  const defaults = resolveTokens(defaultThemeState.styles);
  const definitions: TokenDefinition[] = flatten(defaults).map(({ path, value }) => {
    const id = path.join(".");
    const kind = inferKind(id, value as string | number | boolean);
    const [group, second, ...rest] = path;
    const hasSubgroup = rest.length > 0;
    return {
      id,
      path,
      cssVar: tokenCssVarName(path),
      group,
      subgroup: hasSubgroup ? humanize(second) : "General",
      label: hasSubgroup ? rest.map(humanize).join(" · ") : humanize(second ?? group),
      kind,
      options: ENUMS[id],
      defaultValue: value as string | number | boolean,
    };
  });
  for (const size of SHADOW_OVERRIDE_SIZES) {
    const path = ["shadow", "override", size];
    definitions.push({
      id: path.join("."),
      path,
      cssVar: tokenCssVarName(["shadow", size === "default" ? "" : size].filter(Boolean)),
      group: "shadow",
      subgroup: "Scale override",
      label: size === "default" ? "Default" : size,
      kind: "shadow",
      optional: true,
      defaultValue: "",
    });
  }
  const order = TOKEN_GROUPS.map((g) => g.id);
  cached = definitions.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  return cached;
}

export const getTokenDefinition = (id: string) => getTokenDefinitions().find((d) => d.id === id);

export interface TokenSubgroup {
  title: string;
  tokens: TokenDefinition[];
}
export interface TokenGroup {
  id: string;
  title: string;
  description: string;
  subgroups: TokenSubgroup[];
  count: number;
}

export function getTokenGroups(): TokenGroup[] {
  const definitions = getTokenDefinitions();
  return TOKEN_GROUPS.map((group) => {
    const inGroup = definitions.filter((d) => d.group === group.id);
    const subgroups: TokenSubgroup[] = [];
    for (const token of inGroup) {
      let sub = subgroups.find((s) => s.title === token.subgroup);
      if (!sub) subgroups.push((sub = { title: token.subgroup, tokens: [] }));
      sub.tokens.push(token);
    }
    return { ...group, subgroups, count: inGroup.length };
  }).filter((group) => group.count > 0);
}

/**
 * Convertit une valeur lue dans un CSS (toujours du texte) vers le type du token :
 * booléens (`1`/`0`/`true`/`false`) et nombres (z-index) retrouvent leur type d'origine.
 */
export function coerceTokenValue(definition: TokenDefinition, raw: string): string | number | boolean {
  const value = raw.trim();
  if (typeof definition.defaultValue === "boolean") return value === "1" || value.toLowerCase() === "true";
  if (typeof definition.defaultValue === "number" && /^-?\d*\.?\d+$/.test(value)) return Number(value);
  return value;
}
