import { defaultThemeState } from "@/config/theme";
import type { ThemeStyles } from "@/types/theme";
import { cloneDeep, deepMerge, flatten, getPath, isPlainObject, treeEquals, unsetPath, type TokenTree } from "./object-path";
import { DERIVED_COLOR_KEYS } from "./derive";
import { BASE_STYLE_KEYS, resolveModeStyles, resolveTheme } from "./resolve";
import { TOKEN_GROUPS } from "./registry";

/**
 * Format d'échange `egen-tokens.json` : le squelette COMPLET et résolu d'un thème
 * (`light` / `dark` à plat en kebab-case comme tweakcn, `tokens` imbriqué), plus des métadonnées.
 * C'est ce que consomme TokiForge ; il se réimporte dans l'éditeur sans perte.
 */

export const EGEN_TOKENS_VERSION = "1.0.0";

export interface EgenTokensMeta {
  name: string;
  version: string;
  author?: string;
  description?: string;
  tenantId?: string;
  priority?: number;
  extends?: string | null;
  naming: string;
  [key: string]: unknown;
}

export interface EgenTokensDocument {
  meta: EgenTokensMeta;
  light: Record<string, string>;
  dark: Record<string, string>;
  tokens: TokenTree;
}

const NAMING =
  "tokens.<groupe>.<chemin> → --<groupe>-<chemin> (kebab-case) ; les clés de light/dark → --<clé>.";

const PALETTE_ORDER = ["primary", "secondary", "accent", "neutral", "success", "warning", "info", "error"];

function orderTokens(tokens: TokenTree): TokenTree {
  const ordered: TokenTree = {};
  for (const { id } of TOKEN_GROUPS) if (id in tokens) ordered[id] = tokens[id];
  for (const key of Object.keys(tokens)) if (!(key in ordered)) ordered[key] = tokens[key];
  const palette = ordered.palette;
  if (isPlainObject(palette)) {
    const sorted: TokenTree = {};
    for (const key of PALETTE_ORDER) if (key in palette) sorted[key] = (palette as TokenTree)[key];
    for (const key of Object.keys(palette)) if (!(key in sorted)) sorted[key] = (palette as TokenTree)[key];
    ordered.palette = sorted;
  }
  return ordered;
}

export function buildEgenTokensDocument(
  styles: ThemeStyles,
  meta: Partial<EgenTokensMeta> = {}
): EgenTokensDocument {
  const resolved = resolveTheme(styles);
  const storedMeta = isPlainObject(styles.tokens?.meta) ? (styles.tokens!.meta as Record<string, unknown>) : {};
  return {
    meta: {
      name: "EGEN theme",
      version: EGEN_TOKENS_VERSION,
      tenantId: "default",
      priority: 1,
      extends: null,
      ...storedMeta,
      ...meta,
      naming: NAMING,
    } as EgenTokensMeta,
    light: { ...resolved.light },
    dark: { ...resolved.dark },
    tokens: orderTokens(cloneDeep(resolved.tokens)),
  };
}

/**
 * Retire des `styles` tout ce qui est identique à ce que le résolveur calculerait de lui-même
 * (couleurs étendues dérivées, tokens par défaut) : on retrouve la forme MINIMALE d'un thème,
 * où seules les vraies personnalisations subsistent.
 */
export function minimizeStyles(styles: ThemeStyles): ThemeStyles {
  const base = new Set(BASE_STYLE_KEYS);
  const baseOnly = {
    light: Object.fromEntries(Object.entries(styles.light).filter(([k]) => base.has(k))),
    dark: Object.fromEntries(Object.entries(styles.dark).filter(([k]) => base.has(k))),
  } as ThemeStyles;
  const reference = resolveTheme(baseOnly);

  // Couleurs étendues : une valeur est superflue si le résolveur la recalcule à l'identique à partir
  // de ce qui reste. On procède dans l'ordre de dérivation, donc `success-hover` est jugé APRÈS
  // `success` : un `success` personnalisé justifie un `success-hover` différent du défaut.
  const minimizeMode = (mode: "light" | "dark"): Record<string, string> => {
    const kept = { ...(styles[mode] as Record<string, string>) };
    for (const key of DERIVED_COLOR_KEYS) {
      if (!(key in kept)) continue;
      const without = { ...kept };
      delete without[key];
      const derived = resolveModeStyles({ ...baseOnly, [mode]: without } as ThemeStyles, mode)[key];
      if (derived === kept[key]) delete kept[key];
    }
    return kept;
  };

  let tokens: TokenTree | undefined = styles.tokens ? cloneDeep(styles.tokens as TokenTree) : undefined;
  if (tokens) {
    for (const { path, value } of flatten(tokens)) {
      if (path[0] === "meta") continue;
      if (treeEquals(value, getPath(reference.tokens, path))) tokens = unsetPath(tokens, path);
    }
    if (tokens && Object.keys(tokens).length === 0) tokens = undefined;
  }

  const result = { light: minimizeMode("light"), dark: minimizeMode("dark") } as ThemeStyles;
  if (tokens) result.tokens = tokens;
  return result;
}

export type ParsedTokens =
  | { ok: true; name?: string; styles: ThemeStyles; extendedCount: number; tokenCount: number }
  | { ok: false; error: string };

/**
 * Lit un document `egen-tokens.json` — complet ou partiel. Les clés manquantes sont simplement
 * dérivées/par défaut : un fichier peut ne renseigner que ce qu'il veut personnaliser.
 */
export function parseEgenTokensDocument(input: unknown): ParsedTokens {
  if (!isPlainObject(input)) return { ok: false, error: "The JSON root must be an object." };
  const { light, dark, tokens, meta } = input as Record<string, unknown>;
  if (light === undefined && dark === undefined && tokens === undefined) {
    return { ok: false, error: 'Expected at least one of "light", "dark" or "tokens".' };
  }
  for (const [label, value] of [["light", light], ["dark", dark]] as const) {
    if (value === undefined) continue;
    if (!isPlainObject(value)) return { ok: false, error: `"${label}" must be an object of CSS values.` };
    const bad = Object.entries(value).find(([, v]) => typeof v !== "string");
    if (bad) return { ok: false, error: `"${label}.${bad[0]}" must be a string.` };
  }
  if (tokens !== undefined && !isPlainObject(tokens)) return { ok: false, error: '"tokens" must be an object.' };

  const defaults = defaultThemeState.styles;
  const candidate = {
    light: { ...defaults.light, ...((light as Record<string, string>) ?? {}) },
    // Comme pour les presets : un mode sombre non fourni hérite du clair pour les clés communes.
    dark: { ...defaults.dark, ...((dark as Record<string, string>) ?? {}) },
    ...(isPlainObject(tokens) ? { tokens: tokens as TokenTree } : {}),
  } as ThemeStyles;

  const styles = minimizeStyles(candidate);
  // `meta` décrit le document (nom, version…) : il est renvoyé à part et n'est PAS copié dans le thème,
  // sinon chaque import ajouterait du bruit aux overrides.
  const name = isPlainObject(meta) && typeof meta.name === "string" ? meta.name : undefined;
  const base = new Set(BASE_STYLE_KEYS);
  const extendedCount = [styles.light, styles.dark].reduce(
    (n, mode) => n + Object.keys(mode).filter((k) => !base.has(k)).length,
    0
  );
  const tokenCount = styles.tokens ? flatten(styles.tokens).filter((l) => l.path[0] !== "meta").length : 0;
  return { ok: true, name, styles, extendedCount, tokenCount };
}

/** Applique un thème importé (forme minimale) par-dessus le thème courant, sans rien perdre. */
export function mergeImportedStyles(current: ThemeStyles, imported: ThemeStyles): ThemeStyles {
  const merged: ThemeStyles = {
    ...current,
    light: { ...current.light, ...imported.light },
    dark: { ...current.dark, ...imported.dark },
  };
  if (current.tokens || imported.tokens) {
    merged.tokens = deepMerge((current.tokens ?? {}) as TokenTree, imported.tokens ?? {});
  }
  return merged;
}
