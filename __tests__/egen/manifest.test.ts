import { IFRAME_ALLOW_TOKENS, IFRAME_SANDBOX_TOKENS, validateManifest } from "@egen-civitas/esm-embed-protocol";
import { describe, expect, it } from "vitest";

import { EGEN_MODULE_NAME, EGEN_ROUTE, EgenManifestError, buildEgenManifest } from "@/lib/egen/manifest";

describe("déclaration egen-config.json", () => {
  const manifest = buildEgenManifest("https://design.exemple.org/");

  it("est valide selon le protocole du SDK", () => {
    expect(validateManifest(manifest).ok).toBe(true);
  });

  it("identifie l'app : nom de module, route du Core, URL sans barre finale", () => {
    expect(manifest.name).toBe(EGEN_MODULE_NAME);
    expect(manifest.route).toBe(EGEN_ROUTE);
    expect(manifest.url).toBe("https://design.exemple.org");
    expect(manifest.technology).toBe("nextjs");
    expect(manifest.navigation.mode).toBe("history");
  });

  it("se place dans le rail gauche, groupe Conception (libellé affiché ; le Core en dérive l'identifiant)", () => {
    expect(manifest.placement).toEqual({ rail: "left", group: "Conception", icon: "Palette" });
  });

  it("ne demande que des capacités de la voie unique (aucune identité, aucun thème, aucune API)", () => {
    expect(Object.keys(manifest.capabilities).sort()).toEqual(["events", "locale", "navigation", "notifications"]);
    expect(manifest.capabilities.events).toEqual({ publish: ["app.theme-studio.*"], subscribe: ["core.*"] });
  });

  it("demande des droits d'iframe tous présents dans les listes blanches du protocole", () => {
    expect(manifest.iframe?.sandbox?.length).toBeGreaterThan(0);
    for (const token of manifest.iframe?.sandbox ?? []) expect(IFRAME_SANDBOX_TOKENS).toContain(token);
    for (const token of manifest.iframe?.allow ?? []) expect(IFRAME_ALLOW_TOKENS).toContain(token);
    expect(manifest.iframe?.sandbox).not.toContain("allow-top-navigation");
  });

  it("refuse une URL publique absente, non https ou avec identifiants", () => {
    expect(() => buildEgenManifest(undefined)).toThrow(EgenManifestError);
    expect(() => buildEgenManifest("  ")).toThrow(/EGEN_PUBLIC_URL/);
    expect(() => buildEgenManifest("http://design.exemple.org")).toThrow(/invalide/);
    expect(() => buildEgenManifest("https://user:pass@design.exemple.org")).toThrow(/invalide/);
  });

  it("tolère http pour localhost (développement)", () => {
    expect(buildEgenManifest("http://localhost:3000").url).toBe("http://localhost:3000");
  });
});
