import { db } from "@/db";
import { theme as themeTable } from "@/db/schema";
import { oauthError, requireAuth } from "@/lib/oauth";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

/**
 * Liste les thèmes de l'utilisateur autorisé, du plus récemment modifié au plus ancien.
 * ?updated_since=<date ISO 8601> : ne renvoie que les thèmes créés/modifiés strictement après cette date
 * (permet à un système externe de détecter les nouvelles versions sans tout relire).
 * Un ETag est fourni ; If-None-Match identique → 304.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "themes:read");
  if (auth.error) return auth.error;

  const filters = [eq(themeTable.userId, auth.tokenData.userId), isNull(themeTable.deletedAt)];

  const updatedSince = req.nextUrl.searchParams.get("updated_since");
  if (updatedSince) {
    const since = new Date(updatedSince);
    if (Number.isNaN(since.getTime())) {
      return oauthError("invalid_request", "updated_since must be an ISO 8601 date", 400);
    }
    filters.push(gt(themeTable.updatedAt, since));
  }

  const themes = await db
    .select({
      id: themeTable.id,
      name: themeTable.name,
      description: themeTable.description,
      version: themeTable.currentVersion,
      revision: themeTable.currentRevision,
      metadata: themeTable.metadata,
      styles: themeTable.styles,
      createdAt: themeTable.createdAt,
      updatedAt: themeTable.updatedAt,
    })
    .from(themeTable)
    .where(and(...filters))
    .orderBy(desc(themeTable.updatedAt), themeTable.id);

  const etag = `"${createHash("sha256")
    .update(themes.map((t) => `${t.id}:${t.revision}:${t.updatedAt.toISOString()}`).join("|"))
    .digest("hex")
    .slice(0, 32)}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return Response.json(
    { data: themes },
    { headers: { ETag: etag, "Cache-Control": "private, no-cache" } }
  );
}
