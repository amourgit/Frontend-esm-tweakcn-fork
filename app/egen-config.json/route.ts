import { NextResponse } from "next/server";

import { buildEgenManifest, EgenManifestError } from "@/lib/egen/manifest";

// Lue à l'exécution (EGEN_PUBLIC_URL n'est connue qu'au déploiement), jamais figée au build.
export const dynamic = "force-dynamic";

/** Déclaration d'intégration au Core EGEN, publiée à la racine de l'URL de l'app (docs/integration-apps/17 §7). */
export function GET() {
  try {
    return NextResponse.json(buildEgenManifest(process.env.EGEN_PUBLIC_URL), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof EgenManifestError) {
      return NextResponse.json({ error: error.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    throw error;
  }
}
