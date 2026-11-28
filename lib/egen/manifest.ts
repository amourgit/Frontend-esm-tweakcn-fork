import { validateManifest, type EmbedManifest } from "@egen-civitas/esm-embed-protocol";

import pkg from "../../package.json";

/** Nom de module EGEN de l'app (identité stable : route du Core, approbations de l'opérateur, nom du client SDK). */
export const EGEN_MODULE_NAME = "@civitas/esm-tweakcn-app";

/** Route du Core sous laquelle l'app est montée (`<spa>/theme-studio`). */
export const EGEN_ROUTE = "theme-studio";

export class EgenManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EgenManifestError";
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalHttp(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/**
 * Déclaration d'intégration publiée à `/egen-config.json` (docs/integration-apps/17 §7 du Core).
 *
 * L'app **demande** ses capacités et ses droits d'iframe ; l'opérateur du Core **approuve** un plafond
 * (`external-apps.json` → `grants`) ; le Core applique l'intersection. Rien n'est accordé par cette déclaration seule.
 *
 * @param publicUrl URL publique de l'instance (https ; http toléré pour localhost). Source : `EGEN_PUBLIC_URL`.
 */
export function buildEgenManifest(publicUrl: string | undefined | null): EmbedManifest {
  const url = (publicUrl ?? "").trim().replace(/\/+$/, "");
  if (!url) {
    throw new EgenManifestError("EGEN_PUBLIC_URL n'est pas défini : renseigner l'URL publique de l'instance.");
  }

  const manifest: EmbedManifest = {
    manifestVersion: 1,
    name: EGEN_MODULE_NAME,
    version: pkg.version,
    title: "EGEN Theme Studio",
    url,
    route: EGEN_ROUTE,
    technology: "nextjs",
    navigation: { mode: "history", basePath: "/" },
    // Panneau de rail gauche + entrée de navigation « Conception » (dérivés par le Core à partir de `placement`).
    placement: { rail: "left", group: "conception", icon: "Palette" },
    capabilities: {
      locale: {},
      navigation: {},
      notifications: {},
      events: { publish: ["app.theme-studio.*"], subscribe: ["core.*"] },
    },
    // Exports (téléchargements), dialogues, liens externes hors bac à sable ; presse-papiers et plein écran.
    iframe: {
      sandbox: ["allow-downloads", "allow-modals", "allow-popups-to-escape-sandbox"],
      allow: ["clipboard-read", "clipboard-write", "fullscreen"],
    },
    config: {},
  };

  // Le protocole exige https ; le développement local (http://localhost) est toléré comme le fait l'outillage du Core
  // (`EGEN_ALLOW_HTTP`) : seule l'URL est alors validée sous sa forme https équivalente.
  const result = validateManifest(isLocalHttp(url) ? { ...manifest, url: "https://localhost" } : manifest);
  if (!result.ok) {
    throw new EgenManifestError(`Déclaration EGEN invalide : ${result.errors.join(" ; ")}`);
  }
  return manifest;
}
