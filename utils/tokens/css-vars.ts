import type { ThemeStyles } from "@/types/theme";
import { isColorValue } from "./color-math";
import { DERIVED_COLOR_KEYS, DERIVED_COLORS, type Mode } from "./derive";
import { flatten, type Primitive } from "./object-path";
import { BASE_STYLE_KEYS, resolveTheme } from "./resolve";

/**
 * Source UNIQUE des variables CSS du squelette étendu. Utilisée par le générateur de code, l'aperçu
 * live (même origine, iframe, script embarqué), l'export registre shadcn et l'export JSON.
 *
 * Convention : tokens.<groupe>.<chemin> → --<groupe>-<chemin> (kebab-case) ;
 *              styles.light|dark.<clé>   → --<clé>.
 */

export type CssVar = [name: string, value: string];
export type ColorFormatterFn = (color: string) => string;

const identity: ColorFormatterFn = (c) => c;

/** « fontSize » → « font-size », « zIndex » → « z-index », « 2xl » reste « 2xl ». */
export const kebab = (segment: string) =>
  segment.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();

export const tokenCssVarName = (path: string[]) => `--${path.map(kebab).join("-")}`;

/**
 * Variables (sans `--`) que seules les clés de mode et le calcul des ombres ont le droit de produire.
 * Un token dont la variable coïnciderait (ex. `tokens.border.subtle` → `--border-subtle`) écraserait une
 * couleur du thème : il est refusé à l'enregistrement et jamais émis.
 */
export const RESERVED_VARIABLES: ReadonlySet<string> = new Set([
  ...BASE_STYLE_KEYS,
  ...DERIVED_COLOR_KEYS,
  "tracking-normal",
  "shadow",
  "shadow-x",
  "shadow-y",
  "shadow-2xs",
  "shadow-xs",
  "shadow-sm",
  "shadow-md",
  "shadow-lg",
  "shadow-xl",
  "shadow-2xl",
]);

/** Chemins pointés des tokens dont la variable CSS est réservée (hors `shadow.override`, traité à part). */
export function findReservedTokenPaths(tokens: unknown): string[] {
  return flatten(tokens)
    .filter(({ path }) => path[0] !== "meta" && !(path[0] === "shadow" && path[1] === "override"))
    .filter(({ path }) => RESERVED_VARIABLES.has(tokenCssVarName(path).slice(2)))
    .map(({ path }) => path.join("."));
}

const stringify = (value: Primitive): string =>
  typeof value === "boolean" ? (value ? "1" : "0") : String(value);

const SHADOW_OVERRIDE_TARGETS: Record<string, string> = {
  "2xs": "shadow-2xs",
  xs: "shadow-xs",
  sm: "shadow-sm",
  default: "shadow",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
  "2xl": "shadow-2xl",
};

/** Ombres imposées par le thème (`tokens.shadow.override.<taille>`), nom de variable → valeur. */
export function getShadowOverrides(styles: ThemeStyles): Record<string, string> {
  const overrides = (styles?.tokens as { shadow?: { override?: Record<string, unknown> } } | undefined)
    ?.shadow?.override;
  const result: Record<string, string> = {};
  if (!overrides || typeof overrides !== "object") return result;
  for (const [size, value] of Object.entries(overrides)) {
    const target = SHADOW_OVERRIDE_TARGETS[size];
    if (target && typeof value === "string" && value.trim() !== "") result[target] = value;
  }
  return result;
}

/** Couleurs étendues (dérivées + clés inconnues du thème) du mode donné, hors clés historiques. */
export function getExtendedColorVars(
  styles: ThemeStyles,
  mode: Mode,
  formatColor: ColorFormatterFn = identity
): CssVar[] {
  const resolved = resolveTheme(styles)[mode];
  const base = new Set(BASE_STYLE_KEYS);
  const derivedKeys = DERIVED_COLORS.map((d) => d.key);
  const passthrough = Object.keys(resolved).filter((k) => !base.has(k) && !derivedKeys.includes(k));
  return [...derivedKeys, ...passthrough].map((key) => {
    const value = resolved[key];
    return [`--${key}`, isColorValue(value) ? formatColor(value) : value];
  });
}

/** Tokens indépendants du mode (hors `meta` et `shadow.override`, traités à part). */
export function getTokenVars(styles: ThemeStyles, formatColor: ColorFormatterFn = identity): CssVar[] {
  const { tokens } = resolveTheme(styles);
  return flatten(tokens)
    .filter(({ path }) => !(path[0] === "shadow" && path[1] === "override"))
    .filter(({ path }) => !RESERVED_VARIABLES.has(tokenCssVarName(path).slice(2)))
    .map(({ path, value }) => {
      const raw = stringify(value);
      const formatted = path[0] === "palette" && isColorValue(raw) ? formatColor(raw) : raw;
      return [tokenCssVarName(path), formatted] as CssVar;
    });
}

export interface CssVarGroup {
  group: string;
  vars: CssVar[];
}

/** Même contenu que `getTokenVars`, regroupé par groupe de tokens (pour des exports lisibles). */
export function getTokenVarGroups(styles: ThemeStyles, formatColor: ColorFormatterFn = identity): CssVarGroup[] {
  const { tokens } = resolveTheme(styles);
  const groups = new Map<string, CssVar[]>();
  for (const { path, value } of flatten(tokens)) {
    if (path[0] === "shadow" && path[1] === "override") continue;
    if (RESERVED_VARIABLES.has(tokenCssVarName(path).slice(2))) continue;
    const raw = stringify(value);
    const formatted = path[0] === "palette" && isColorValue(raw) ? formatColor(raw) : raw;
    const list = groups.get(path[0]) ?? [];
    list.push([tokenCssVarName(path), formatted]);
    groups.set(path[0], list);
  }
  return [...groups.entries()].map(([group, vars]) => ({ group, vars }));
}

/**
 * Toutes les variables du squelette étendu pour un mode, sous forme `{ "--nom": valeur }` :
 * couleurs étendues du mode + tokens indépendants du mode. C'est ce que l'aperçu live applique et
 * ce que le studio envoie aux sites embarqués (cross-origin).
 */
export function getExtendedCssVariableMap(
  styles: ThemeStyles,
  mode: Mode,
  formatColor: ColorFormatterFn = identity
): Record<string, string> {
  return Object.fromEntries([...getExtendedColorVars(styles, mode, formatColor), ...getTokenVars(styles, formatColor)]);
}
