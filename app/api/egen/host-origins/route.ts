import { NextResponse } from "next/server";

import { parseFrameAncestors } from "@/lib/frame-ancestors";

export const dynamic = "force-dynamic";

/**
 * Origines du Shell EGEN autorisées à embarquer l'app (même variable que l'en-tête `frame-ancestors`).
 * Le client SDK n'accepte de parler qu'à ces origines explicites, jamais `*`.
 */
export function GET() {
  return NextResponse.json(
    { hostOrigins: parseFrameAncestors(process.env.EGEN_FRAME_ANCESTORS) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
