import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getHostOrigins } from "@/app/api/egen/host-origins/route";
import { GET as getManifest } from "@/app/egen-config.json/route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /egen-config.json", () => {
  it("sert la déclaration quand EGEN_PUBLIC_URL est défini, sans cache", async () => {
    vi.stubEnv("EGEN_PUBLIC_URL", "https://design.exemple.org");
    const response = getManifest();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ manifestVersion: 1, name: "@civitas/esm-tweakcn-app", route: "theme-studio", url: "https://design.exemple.org" });
  });

  it("503 explicite (et non une déclaration trompeuse) si EGEN_PUBLIC_URL manque", async () => {
    vi.stubEnv("EGEN_PUBLIC_URL", "");
    const response = getManifest();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/EGEN_PUBLIC_URL/);
  });
});

describe("GET /api/egen/host-origins", () => {
  it("reprend les origines de frame-ancestors, validées et dédoublonnées", async () => {
    vi.stubEnv("EGEN_FRAME_ANCESTORS", "https://egen.exemple.org, http://localhost:9000 https://egen.exemple.org javascript:alert(1)");
    const body = await getHostOrigins().json();
    expect(body.hostOrigins).toEqual(["https://egen.exemple.org", "http://localhost:9000"]);
  });

  it("aucune origine si la variable est vide : l'app ne se connecte à personne", async () => {
    vi.stubEnv("EGEN_FRAME_ANCESTORS", "");
    expect((await getHostOrigins().json()).hostOrigins).toEqual([]);
  });
});
