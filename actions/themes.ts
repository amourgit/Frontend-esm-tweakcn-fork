"use server";

import { z } from "zod";
import { db } from "@/db";
import * as themeService from "@/lib/themes/service";
import { seedBuiltInThemes } from "@/lib/themes/seed";
import { defaultPresets } from "@/utils/theme-presets";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { themeStylesInputSchema, type ThemeStyles } from "@/types/theme";
import { cache } from "react";
import {
  UnauthorizedError,
  ValidationError,
  ThemeNotFoundError,
  ThemeVersionConflictError,
  actionError,
  actionSuccess,
  ErrorCode,
} from "@/types/errors";

// Helper to get user ID with better error handling
async function getCurrentUserId(): Promise<string> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  return session.user.id;
}

// Log errors for observability
function logError(error: Error, context: Record<string, any>) {
  console.error("Theme action error:", error, context);

  // For production, you'd want to send critical errors to an external service
  if (error.name === "UnauthorizedError" || error.name === "ValidationError") {
    // These are expected errors, log but don't report
    console.warn("Expected error:", { error: error.message, context });
  } else {
    // Unexpected errors should be reported
    console.error("Unexpected error:", { error: error.message, stack: error.stack, context });
  }
}

const MAX_METADATA_BYTES = 32 * 1024;

const nameSchema = z.string().trim().min(1, "Theme name cannot be empty").max(50, "Theme name too long");
const descriptionSchema = z.string().max(500, "Description too long").nullable();
const changeNoteSchema = z.string().max(500, "Change note too long").nullable();
const metadataSchema = z
  .record(z.string(), z.unknown())
  .refine((m) => JSON.stringify(m).length <= MAX_METADATA_BYTES, {
    message: `Metadata too large (max ${MAX_METADATA_BYTES / 1024} KB)`,
  });

const createThemeSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.optional(),
  styles: themeStylesInputSchema,
  metadata: metadataSchema.optional(),
  changeNote: changeNoteSchema.optional(),
});

const updateThemeSchema = z.object({
  id: z.string().min(1, "Theme ID required"),
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  styles: themeStylesInputSchema.optional(),
  metadata: metadataSchema.optional(),
  changeNote: changeNoteSchema.optional(),
  /** Version sur laquelle l'utilisateur a travaillé (détection des modifications concurrentes). */
  baseVersion: z.number().int().positive().optional(),
});

// Layer 1: Clean server actions with proper error handling

/** Thèmes de l'utilisateur connecté (thèmes système exclus : voir `getBuiltInThemes`). */
export async function getThemes() {
  try {
    const userId = await getCurrentUserId();
    return await themeService.listUserThemes(db, userId);
  } catch (error) {
    logError(error as Error, { action: "getThemes" });
    throw error;
  }
}

/**
 * Thèmes système (livrés avec le studio), lus depuis la base — publics, sans authentification.
 * Garde-fou : si la base n'a jamais été initialisée (seed non joué), on l'importe une fois ici.
 */
export async function getBuiltInThemes() {
  try {
    let rows = await themeService.listBuiltInThemes(db);
    if (rows.length === 0) {
      await seedBuiltInThemes(db, defaultPresets);
      rows = await themeService.listBuiltInThemes(db);
    }
    return rows;
  } catch (error) {
    logError(error as Error, { action: "getBuiltInThemes" });
    throw error;
  }
}

export const getTheme = cache(async (themeId: string) => {
  try {
    if (!themeId) {
      throw new ValidationError("Theme ID required");
    }

    const theme = await themeService.getThemeById(db, themeId);

    if (!theme) {
      throw new ThemeNotFoundError();
    }

    return theme;
  } catch (error) {
    logError(error as Error, { action: "getTheme", themeId });
    throw error;
  }
});

export async function createTheme(formData: {
  name: string;
  styles: ThemeStyles;
  description?: string | null;
  metadata?: Record<string, unknown>;
  changeNote?: string | null;
}) {
  try {
    const userId = await getCurrentUserId();

    const validation = createThemeSchema.safeParse(formData);
    if (!validation.success) {
      throw new ValidationError("Invalid input", validation.error.format());
    }

    const { theme } = await themeService.createTheme(db, { userId, ...validation.data });
    return actionSuccess(theme);
  } catch (error) {
    logError(error as Error, { action: "createTheme", formData: { name: formData.name } });
    throw error;
  }
}

/**
 * Enregistre une nouvelle version du thème (jamais d'écrasement). Renvoie le thème à jour ;
 * `versionCreated` vaut false si le contenu était identique à la version courante.
 */
export async function updateTheme(formData: {
  id: string;
  name?: string;
  description?: string | null;
  styles?: ThemeStyles;
  metadata?: Record<string, unknown>;
  changeNote?: string | null;
  baseVersion?: number;
}) {
  try {
    const userId = await getCurrentUserId();

    const validation = updateThemeSchema.safeParse(formData);
    if (!validation.success) {
      throw new ValidationError("Invalid input", validation.error.format());
    }

    const { id: themeId, ...changes } = validation.data;

    if (
      changes.name === undefined &&
      changes.description === undefined &&
      changes.styles === undefined &&
      changes.metadata === undefined
    ) {
      throw new ValidationError("No update data provided");
    }

    const { theme, versionCreated } = await themeService.saveThemeVersion(
      db,
      themeId,
      userId,
      changes
    );
    return actionSuccess({ ...theme, versionCreated });
  } catch (error) {
    if (error instanceof ThemeVersionConflictError) {
      return actionError(ErrorCode.THEME_VERSION_CONFLICT, error.message);
    }
    logError(error as Error, { action: "updateTheme", themeId: formData.id });
    throw error;
  }
}

export async function deleteTheme(themeId: string) {
  try {
    const userId = await getCurrentUserId();

    if (!themeId) {
      throw new ValidationError("Theme ID required");
    }

    return await themeService.softDeleteTheme(db, themeId, userId);
  } catch (error) {
    logError(error as Error, { action: "deleteTheme", themeId });
    throw error;
  }
}

/** Historique d'un thème (sans les styles), version la plus récente d'abord. Lisible par tout utilisateur connecté pour un thème système, par son propriétaire pour un thème utilisateur. */
export async function getThemeVersions(themeId: string) {
  try {
    const userId = await getCurrentUserId();
    const theme = await themeService.getThemeById(db, themeId);
    if (!theme || (theme.source === "USER" && theme.userId !== userId)) {
      throw new ThemeNotFoundError();
    }
    return await themeService.listThemeVersions(db, themeId);
  } catch (error) {
    logError(error as Error, { action: "getThemeVersions", themeId });
    throw error;
  }
}

/** Contenu complet (styles compris) d'une version donnée. */
export async function getThemeVersion(themeId: string, version: number) {
  try {
    const userId = await getCurrentUserId();
    const theme = await themeService.getThemeById(db, themeId);
    if (!theme || (theme.source === "USER" && theme.userId !== userId)) {
      throw new ThemeNotFoundError();
    }
    const row = await themeService.getThemeVersion(db, themeId, version);
    if (!row) throw new ThemeNotFoundError("Theme version not found");
    return row;
  } catch (error) {
    logError(error as Error, { action: "getThemeVersion", themeId });
    throw error;
  }
}

/** Restaure une ancienne version : crée une nouvelle version avec son contenu. */
export async function restoreThemeVersion(themeId: string, version: number) {
  try {
    const userId = await getCurrentUserId();
    const { theme, versionCreated } = await themeService.restoreThemeVersion(
      db,
      themeId,
      userId,
      version
    );
    return actionSuccess({ ...theme, versionCreated });
  } catch (error) {
    logError(error as Error, { action: "restoreThemeVersion", themeId });
    throw error;
  }
}
