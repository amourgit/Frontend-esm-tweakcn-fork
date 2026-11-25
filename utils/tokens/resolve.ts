import { COMMON_STYLES, defaultThemeState } from "@/config/theme";
import { DEFAULT_TOKENS, DERIVED_PALETTES } from "@/config/tokens/defaults";
import type { ThemeStyles } from "@/types/theme";
import { generateRamp } from "./color-math";
import { DERIVED_COLOR_MAP, type DeriveContext, type Mode } from "./derive";
import { cloneDeep, deepMerge, getPath, isPlainObject, type TokenTree } from "./object-path";

/**
 * Résolution d'un thème : LA fonction à appeler partout où l'on a besoin de TOUTES les valeurs
 * (aperçu live, export CSS/Tailwind/registre, éditeur, import).
 *
 *   résolu = squelette de référence  ←  dérivations depuis les couleurs du thème  ←  overrides du thème
 *
 * Le thème stocké (preset, base de données, état persisté) reste PARTIEL et rétro-compatible :
 * seules les clés réellement personnalisées y figurent.
 */

export type ResolvedModeStyles = Record<string, string>;

export interface ResolvedTheme {
  light: ResolvedModeStyles;
  dark: ResolvedModeStyles;
  tokens: TokenTree;
}

/** Les 44 clés historiques de tweakcn (couleurs de base, polices, radius, ombres, spacing). */
export const BASE_STYLE_KEYS: readonly string[] = Object.keys(defaultThemeState.styles.light);

const isExplicit = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** Vrai si le thème renseigne explicitement cette clé de couleur étendue pour ce mode. */
export function isColorOverridden(styles: ThemeStyles, mode: Mode, key: string): boolean {
  return isExplicit((styles[mode] as Record<string, unknown> | undefined)?.[key]);
}

export function resolveModeStyles(styles: ThemeStyles, mode: Mode): ResolvedModeStyles {
  const explicit = (styles?.[mode] ?? {}) as Record<string, unknown>;
  const resolved: ResolvedModeStyles = {
    ...(defaultThemeState.styles[mode] as Record<string, string>),
  };
  for (const [key, value] of Object.entries(explicit)) {
    if (isExplicit(value)) resolved[key] = value;
  }

  const ctx: DeriveContext = {
    mode,
    isLight: mode === "light",
    get: (key) => resolveKey(key),
  };
  const visiting = new Set<string>();
  const resolveKey = (key: string): string => {
    if (isExplicit(explicit[key])) return explicit[key] as string;
    if (key in resolved && !(key in DERIVED_COLOR_MAP)) return resolved[key];
    const definition = DERIVED_COLOR_MAP[key];
    if (!definition) return resolved[key] ?? "";
    if (key in resolved) return resolved[key]; // déjà calculé (mémoïsé)
    if (visiting.has(key)) return ""; // garde anti-cycle
    visiting.add(key);
    const value = definition.derive(ctx);
    visiting.delete(key);
    resolved[key] = value;
    return value;
  };

  for (const key of Object.keys(DERIVED_COLOR_MAP)) resolveKey(key);
  return resolved;
}

export function resolveTokens(styles: ThemeStyles, light?: ResolvedModeStyles): TokenTree {
  const lightStyles = light ?? resolveModeStyles(styles, "light");
  const derived: TokenTree = {};
  for (const [name, colorKey] of Object.entries(DERIVED_PALETTES)) {
    (derived as Record<string, unknown>)[name] = generateRamp(lightStyles[colorKey]);
  }
  const base = deepMerge(cloneDeep(DEFAULT_TOKENS), { palette: derived } as TokenTree);
  // `meta` ne produit aucune variable CSS : il est géré à part (export JSON).
  const overrides = isPlainObject(styles?.tokens) ? styles.tokens : {};
  const { meta: _meta, ...tokenOverrides } = overrides as Record<string, unknown>;
  return deepMerge(base, tokenOverrides);
}

// Cache par identité d'objet, validé par une empreinte du contenu : si un appelant modifie un
// thème « en place » (certains utilitaires historiques le font), on recalcule au lieu de servir
// un résultat périmé. Résoudre coûte ~2 ms ; l'empreinte ~0,1 ms.
const cache = new WeakMap<object, { fingerprint: string; result: ResolvedTheme }>();

export function resolveTheme(styles: ThemeStyles): ResolvedTheme {
  const cacheable = styles && typeof styles === "object";
  const fingerprint = cacheable ? JSON.stringify(styles) : "";
  if (cacheable) {
    const hit = cache.get(styles);
    if (hit && hit.fingerprint === fingerprint) return hit.result;
  }
  const light = resolveModeStyles(styles, "light");
  const dark = resolveModeStyles(styles, "dark");
  const result: ResolvedTheme = { light, dark, tokens: resolveTokens(styles, light) };
  if (cacheable) cache.set(styles, { fingerprint, result });
  return result;
}

/** Valeur résolue d'une couleur ou d'un token (chemin pointé « motion.duration.fast »). */
export function resolvedTokenValue(styles: ThemeStyles, path: string[]): unknown {
  return getPath(resolveTheme(styles).tokens, path);
}

export const isCommonStyleKey = (key: string) => COMMON_STYLES.includes(key);
