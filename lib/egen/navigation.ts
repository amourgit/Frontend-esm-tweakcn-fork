/**
 * Chemin « vu par le Core » : chemin + requête de la page courante de l'app (le Core le reflète dans son URL pour
 * l'actualisation, le retour/avance et les liens partageables).
 */
export function currentPath(pathname: string | null, search: string | null | undefined): string {
  const path = pathname && pathname.startsWith("/") ? pathname : "/";
  const query = (search ?? "").replace(/^\?/, "");
  return query ? `${path}?${query}` : path;
}

/**
 * Chemin demandé par le Core (`goto`) accepté pour une navigation interne : relatif à l'app uniquement
 * (jamais d'URL absolue ni protocole-relative, qui permettraient une redirection vers un autre site).
 */
export function safeGotoPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  return path;
}
