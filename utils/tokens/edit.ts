import type { ThemeStyles } from "@/types/theme";
import { setPath, unsetPath, type TokenTree } from "./object-path";
import type { Mode } from "./derive";
import { BASE_STYLE_KEYS } from "./resolve";

/**
 * Opérations d'édition PURES sur un thème partiel. L'éditeur (panneau de contrôle) et les tests
 * passent par les mêmes fonctions : ce qui est testé est ce qui s'exécute.
 */

/** Couleurs étendues (hors clés tweakcn) explicitement personnalisées par le thème pour ce mode. */
export function getOverriddenColorKeys(styles: ThemeStyles, mode: Mode): Set<string> {
  const base = new Set(BASE_STYLE_KEYS);
  return new Set(
    Object.entries((styles?.[mode] ?? {}) as Record<string, unknown>)
      .filter(([key, value]) => !base.has(key) && typeof value === "string" && value.trim() !== "")
      .map(([key]) => key)
  );
}

/** « Auto » : retire l'override pour que la valeur soit de nouveau dérivée des couleurs du thème. */
export function resetColorKeys(styles: ThemeStyles, mode: Mode, keys: string[]): ThemeStyles {
  const next: Record<string, unknown> = { ...(styles?.[mode] ?? {}) };
  for (const key of keys) delete next[key];
  return { ...styles, [mode]: next } as ThemeStyles;
}

export function setToken(styles: ThemeStyles, path: string[], value: unknown): ThemeStyles {
  return { ...styles, tokens: setPath(styles.tokens as TokenTree | undefined, path, value) } as ThemeStyles;
}

/** Retire des overrides les tokens donnés ; `tokens` disparaît s'il ne reste rien. */
export function resetTokenPaths(styles: ThemeStyles, paths: string[][]): ThemeStyles {
  let tokens = styles.tokens as TokenTree | undefined;
  for (const path of paths) tokens = unsetPath(tokens, path);
  const { tokens: _previous, ...rest } = styles;
  return (tokens && Object.keys(tokens).length > 0 ? { ...rest, tokens } : rest) as ThemeStyles;
}
