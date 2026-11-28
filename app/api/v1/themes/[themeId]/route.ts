import { db } from "@/db";
import { theme as themeTable } from "@/db/schema";
import { oauthError, requireAuth } from "@/lib/oauth";
import { eq, and, isNull } from "drizzle-orm";
import { createHash } from "crypto";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ themeId: string }> }) {
  const auth = await requireAuth(req, "themes:read");
  if (auth.error) return auth.error;

  const { themeId } = await params;

  const [theme] = await db
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
    .where(
      and(
        eq(themeTable.id, themeId),
        eq(themeTable.userId, auth.tokenData.userId),
        isNull(themeTable.deletedAt)
      )
    )
    .limit(1);

  if (!theme) {
    return oauthError("not_found", "Theme not found", 404);
  }

  const etag = `"${createHash("sha256")
    .update(`${theme.id}:${theme.revision}:${theme.updatedAt.toISOString()}`)
    .digest("hex")
    .slice(0, 32)}"`;

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return Response.json(
    { data: theme },
    { headers: { ETag: etag, "Cache-Control": "private, no-cache" } }
  );
}
