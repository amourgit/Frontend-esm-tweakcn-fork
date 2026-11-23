/**
 * Embarquement en iframe (EGEN) : valide EGEN_FRAME_ANCESTORS (origines séparées par espaces ou virgules)
 * et construit l'en-tête CSP `frame-ancestors`. Sans variable, aucun en-tête : comportement inchangé.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseFrameAncestors(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const origins: string[] = [];
  for (const item of raw.split(/[\s,]+/).filter(Boolean)) {
    try {
      const u = new URL(item);
      const ok = u.protocol === "https:" || (u.protocol === "http:" && LOCAL_HOSTS.has(u.hostname));
      if (ok && !u.username && !u.password) origins.push(u.origin);
    } catch {
      /* origine invalide : ignorée */
    }
  }
  return Array.from(new Set(origins));
}

export function frameAncestorsHeader(raw: string | undefined | null): string | null {
  const origins = parseFrameAncestors(raw);
  return origins.length ? `frame-ancestors 'self' ${origins.join(" ")}` : null;
}
