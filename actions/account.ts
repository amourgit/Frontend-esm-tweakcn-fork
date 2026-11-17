"use server";

import { db } from "@/db";
import { user as userTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/shared";
import { logError } from "@/lib/shared";
import { actionError, actionSuccess, ErrorCode, type ActionResult } from "@/types/errors";

export async function deleteAccount(): Promise<ActionResult<boolean>> {
  try {
    const userId = await getCurrentUserId();

    // Delete user — CASCADE handles: sessions, accounts, themes,
    // oauthAuthorizationCode, oauthToken
    await db.delete(userTable).where(eq(userTable.id, userId));

    return actionSuccess(true);
  } catch (error) {
    logError(error as Error, { action: "deleteAccount" });
    return actionError(ErrorCode.UNKNOWN_ERROR, "Failed to delete account. Please try again.");
  }
}
