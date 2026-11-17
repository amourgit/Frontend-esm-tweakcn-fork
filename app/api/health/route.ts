import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Sonde de santé (conteneur / orchestrateur) : l'application répond et la base est joignable. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error", detail: "database unreachable" }, { status: 503 });
  }
}
