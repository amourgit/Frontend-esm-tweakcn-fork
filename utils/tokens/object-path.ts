/**
 * Utilitaires d'objets imbriqués pour les tokens EGEN (immuables, sans dépendance).
 * Un « chemin » est un tableau de segments : ["typography", "fontSize", "xs", "size"].
 */

export type Primitive = string | number | boolean | null;
export type TokenTree = { [key: string]: TokenTree | Primitive };

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isUnset = (value: unknown) => value === undefined || value === "";

/**
 * Fusion profonde : les feuilles de `override` gagnent sur celles de `base`.
 * `undefined` et la chaîne vide sont traités comme « non renseigné » (la valeur de base reste),
 * ce qui permet à un thème de ne remplir que les tokens qu'il veut personnaliser.
 */
export function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (isUnset(override) ? base : (override as T)) as T;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isUnset(value)) continue;
    result[key] = key in result ? deepMerge(result[key], value) : cloneDeep(value);
  }
  return result as T;
}

export function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneDeep) as unknown as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneDeep(v)])) as T;
  }
  return value;
}

export interface Leaf {
  path: string[];
  value: Primitive;
}

/** Liste toutes les feuilles (valeurs primitives) d'un arbre, dans l'ordre d'insertion. */
export function flatten(tree: unknown, prefix: string[] = []): Leaf[] {
  if (isPlainObject(tree)) {
    return Object.entries(tree).flatMap(([key, value]) => flatten(value, [...prefix, key]));
  }
  if (tree === undefined) return [];
  return [{ path: prefix, value: tree as Primitive }];
}

export function getPath(tree: unknown, path: string[]): unknown {
  let current: unknown = tree;
  for (const segment of path) {
    if (!isPlainObject(current)) return undefined;
    current = current[segment];
  }
  return current;
}

/** Retourne une copie de `tree` avec `value` posé au chemin donné (crée les niveaux manquants). */
export function setPath<T extends object>(tree: T | undefined, path: string[], value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const node: Record<string, unknown> = isPlainObject(tree) ? tree : {};
  return {
    ...node,
    [head]: rest.length === 0 ? value : setPath(node[head] as object | undefined, rest, value),
  } as T;
}

/** Retourne une copie sans la clé au chemin donné ; les objets devenus vides sont élagués. */
export function unsetPath<T extends object>(tree: T | undefined, path: string[]): T {
  if (!isPlainObject(tree) || path.length === 0) return (tree ?? {}) as T;
  const [head, ...rest] = path;
  if (!(head in tree)) return tree as T;
  const next: Record<string, unknown> = { ...tree };
  if (rest.length === 0) {
    delete next[head];
  } else {
    const child = unsetPath(next[head] as object | undefined, rest);
    if (isPlainObject(child) && Object.keys(child).length === 0) delete next[head];
    else next[head] = child;
  }
  return next as T;
}

export const hasPath = (tree: unknown, path: string[]) => !isUnset(getPath(tree, path));

/** Égalité structurelle sur des arbres JSON. */
export function treeEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && treeEquals(a[k], b[k]));
  }
  return false;
}

/** Clés d'un sous-arbre (tableau vide si le chemin n'existe pas ou n'est pas un objet). */
export function keysAt(tree: unknown, path: string[]): string[] {
  const node = getPath(tree, path);
  return isPlainObject(node) ? Object.keys(node) : [];
}
