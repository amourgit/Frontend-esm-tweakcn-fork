"use server";

import { z } from "zod";
import { db } from "@/db";
import * as themes from "@/lib/themes";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { themeStylesInputSchema, type ThemeStyles } from "@/types/theme";
import { cache } from "react";
import {
  UnauthorizedError,
  ValidationError,
  ThemeNotFoundError,
  ThemeRevisionConflictError,
  ThemeRevisionAlreadyVersionedError,
  ThemeForbiddenError,
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

/** Identité de l'appelant, ou null (lecture publique des thèmes système). */
async function getOptionalUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
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
const messageSchema = z.string().max(500, "Message too long").nullable();
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
  message: messageSchema.optional(),
  /** Thème dont celui-ci est une copie dérivée : le serveur en relève l'état et la version. */
  derivedFromThemeId: z.string().min(1).optional(),
});

const saveStateSchema = z.object({
  id: z.string().min(1, "Theme ID required"),
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  styles: themeStylesInputSchema.optional(),
  metadata: metadataSchema.optional(),
  message: messageSchema.optional(),
  /** État sur lequel l'utilisateur a travaillé (détection des modifications concurrentes). */
  baseRevision: z.number().int().positive().optional(),
  /** Pose aussi une version sur l'état enregistré. */
  release: z.object({ notes: messageSchema.optional() }).optional(),
});

const createVersionSchema = z.object({
  themeId: z.string().min(1),
  /** État à étiqueter ; par défaut l'état courant. */
  revision: z.number().int().positive().optional(),
  notes: messageSchema.optional(),
});

/** Erreurs métier attendues → résultat typé (le message survit à la sérialisation des server actions). */
function toActionError(error: unknown) {
  if (error instanceof ThemeRevisionConflictError) {
    return actionError(ErrorCode.THEME_REVISION_CONFLICT, error.message);
  }
  if (error instanceof ThemeRevisionAlreadyVersionedError) {
    return actionError(ErrorCode.THEME_ALREADY_VERSIONED, error.message);
  }
  if (error instanceof ThemeForbiddenError) {
    return actionError(ErrorCode.THEME_FORBIDDEN, error.message);
  }
  return null;
}

// ───────────────────────────── Lecture ─────────────────────────────

/** Thèmes de l'utilisateur connecté (thèmes système exclus : voir `getSystemThemes`). */
export async function getThemes() {
  try {
    const userId = await getCurrentUserId();
    return await themes.listUserThemes(db, userId);
  } catch (error) {
    logError(error as Error, { action: "getThemes" });
    throw error;
  }
}

/**
 * Thèmes système (auteur : le système), thème par défaut compris — publics, sans authentification.
 * Garde-fou : si la base n'a jamais été initialisée (seed non joué), on l'importe une fois ici.
 */
export async function getSystemThemes() {
  try {
    let rows = await themes.listSystemThemes(db);
    if (rows.length === 0) {
      await themes.seedSystemThemes(db);
      rows = await themes.listSystemThemes(db);
    }
    return rows;
  } catch (error) {
    logError(error as Error, { action: "getSystemThemes" });
    throw error;
  }
}

/** Thème par identifiant (état courant). Public : sert les liens de partage et le registre. */
export const getTheme = cache(async (themeId: string) => {
  try {
    if (!themeId) {
      throw new ValidationError("Theme ID required");
    }

    const theme = await themes.getThemeById(db, themeId);

    if (!theme) {
      throw new ThemeNotFoundError();
    }

    return theme;
  } catch (error) {
    logError(error as Error, { action: "getTheme", themeId });
    throw error;
  }
});

/** Thème à ouvrir dans l'éditeur : un thème système, ou un thème appartenant à l'utilisateur. */
export async function getThemeForEditor(themeId: string) {
  try {
    const userId = await getOptionalUserId();
    const theme = await themes.getThemeById(db, themeId);
    if (!theme) throw new ThemeNotFoundError();
    themes.assertCanRead(theme, userId);
    return theme;
  } catch (error) {
    logError(error as Error, { action: "getThemeForEditor", themeId });
    throw error;
  }
}

/** Fiche d'identité du thème (version, auteur, dates, provenance…). */
export async function getThemeDetails(themeId: string) {
  try {
    return await themes.getThemeDetails(db, themeId, await getOptionalUserId());
  } catch (error) {
    logError(error as Error, { action: "getThemeDetails", themeId });
    throw error;
  }
}

/** États du thème, le plus récent d'abord. */
export async function getThemeRevisions(themeId: string) {
  try {
    return await themes.listRevisions(db, themeId, await getOptionalUserId());
  } catch (error) {
    logError(error as Error, { action: "getThemeRevisions", themeId });
    throw error;
  }
}

/** Contenu complet (styles compris) d'un état. */
export async function getThemeRevision(themeId: string, revision: number) {
  try {
    return await themes.getRevision(db, themeId, revision, await getOptionalUserId());
  } catch (error) {
    logError(error as Error, { action: "getThemeRevision", themeId });
    throw error;
  }
}

/** Versions du thème, la plus récente d'abord. */
export async function getThemeVersions(themeId: string) {
  try {
    return await themes.listVersions(db, themeId, await getOptionalUserId());
  } catch (error) {
    logError(error as Error, { action: "getThemeVersions", themeId });
    throw error;
  }
}

// ───────────────────────────── Écriture ─────────────────────────────

/** Crée un thème appartenant à l'utilisateur (état 1 + version 1), éventuellement dérivé d'un autre. */
export async function createTheme(formData: {
  name: string;
  styles: ThemeStyles;
  description?: string | null;
  metadata?: Record<string, unknown>;
  message?: string | null;
  derivedFromThemeId?: string;
}) {
  try {
    const userId = await getCurrentUserId();

    const validation = createThemeSchema.safeParse(formData);
    if (!validation.success) {
      throw new ValidationError("Invalid input", validation.error.format());
    }

    const { theme } = await themes.createTheme(db, { actorId: userId, ...validation.data });
    return actionSuccess(theme);
  } catch (error) {
    logError(error as Error, { action: "createTheme", formData: { name: formData.name } });
    throw error;
  }
}

/**
 * Enregistre un nouvel ÉTAT du thème (jamais d'écrasement) ; avec `release`, pose aussi une version
 * sur cet état. `revisionCreated` vaut false si le contenu était identique à l'état courant.
 */
export async function saveThemeState(formData: {
  id: string;
  name?: string;
  description?: string | null;
  styles?: ThemeStyles;
  metadata?: Record<string, unknown>;
  message?: string | null;
  baseRevision?: number;
  release?: { notes?: string | null };
}) {
  try {
    const userId = await getCurrentUserId();

    const validation = saveStateSchema.safeParse(formData);
    if (!validation.success) {
      throw new ValidationError("Invalid input", validation.error.format());
    }

    const { id: themeId, release, ...changes } = validation.data;
    if (
      changes.name === undefined &&
      changes.description === undefined &&
      changes.styles === undefined &&
      changes.metadata === undefined &&
      !release
    ) {
      throw new ValidationError("No update data provided");
    }

    const result = await themes.saveRevision(db, themeId, userId, changes, { release });
    return actionSuccess({
      ...result.theme,
      revisionCreated: result.revisionCreated,
      versionCreated: result.version !== null,
    });
  } catch (error) {
    const expected = toActionError(error);
    if (expected) return expected;
    logError(error as Error, { action: "saveThemeState", themeId: formData.id });
    throw error;
  }
}

/** Pose une version sur un état précis du thème (par défaut l'état courant). */
export async function createThemeVersion(formData: {
  themeId: string;
  revision?: number;
  notes?: string | null;
}) {
  try {
    const userId = await getCurrentUserId();

    const validation = createVersionSchema.safeParse(formData);
    if (!validation.success) {
      throw new ValidationError("Invalid input", validation.error.format());
    }

    const { themeId, ...input } = validation.data;
    const { theme, version } = await themes.createVersion(db, themeId, userId, input);
    return actionSuccess({ ...theme, createdVersion: version.version });
  } catch (error) {
    const expected = toActionError(error);
    if (expected) return expected;
    logError(error as Error, { action: "createThemeVersion", themeId: formData.themeId });
    throw error;
  }
}

/** Restaure un ancien état : crée un nouvel état avec son contenu (l'historique n'est jamais réécrit). */
export async function restoreThemeRevision(themeId: string, revision: number) {
  try {
    const userId = await getCurrentUserId();
    const result = await themes.restoreRevision(db, themeId, userId, revision);
    return actionSuccess({
      ...result.theme,
      revisionCreated: result.revisionCreated,
      versionCreated: false,
    });
  } catch (error) {
    const expected = toActionError(error);
    if (expected) return expected;
    logError(error as Error, { action: "restoreThemeRevision", themeId });
    throw error;
  }
}

export async function deleteTheme(themeId: string) {
  try {
    const userId = await getCurrentUserId();

    if (!themeId) {
      throw new ValidationError("Theme ID required");
    }

    return await themes.softDeleteTheme(db, themeId, userId);
  } catch (error) {
    logError(error as Error, { action: "deleteTheme", themeId });
    throw error;
  }
}
