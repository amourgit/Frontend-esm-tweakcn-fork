import z from "zod";

// Error codes for server actions - these survive serialization
export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  THEME_NOT_FOUND: "THEME_NOT_FOUND",
  THEME_LIMIT_REACHED: "THEME_LIMIT_REACHED",
  THEME_REVISION_CONFLICT: "THEME_REVISION_CONFLICT",
  THEME_ALREADY_VERSIONED: "THEME_ALREADY_VERSIONED",
  THEME_FORBIDDEN: "THEME_FORBIDDEN",
  ALREADY_PUBLISHED: "ALREADY_PUBLISHED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Typed result for server actions
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };

// Helper to create error results
export function actionError(code: ErrorCode, message: string): ActionResult<never> {
  return { success: false, error: { code, message } };
}

// Helper to create success results
export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class SubscriptionRequiredError extends Error {
  constructor(
    message = "Subscription required",
    public data?: unknown
  ) {
    super(message);
    this.name = "SubscriptionRequiredError";
  }
}

export class ThemeNotFoundError extends Error {
  constructor(message = "Theme not found") {
    super(message);
    this.name = "ThemeNotFoundError";
  }
}

/** L'état de base fourni n'est plus l'état courant du thème (modification concurrente). */
export class ThemeRevisionConflictError extends Error {
  constructor(
    public currentRevision: number,
    message = "Theme was modified by someone else. Reload it before saving."
  ) {
    super(message);
    this.name = "ThemeRevisionConflictError";
  }
}

/** Cet état porte déjà une version : on n'en pose pas deux sur le même état. */
export class ThemeRevisionAlreadyVersionedError extends Error {
  constructor(
    public version: number,
    message = `This state already has version ${version}.`
  ) {
    super(message);
    this.name = "ThemeRevisionAlreadyVersionedError";
  }
}

/** Action interdite sur ce thème (ex. suppression d'un thème système). */
export class ThemeForbiddenError extends Error {
  constructor(message = "This action is not allowed on this theme") {
    super(message);
    this.name = "ThemeForbiddenError";
  }
}

export type ApiErrorCode =
  | "SUBSCRIPTION_REQUIRED"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "UNKNOWN_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public data?: unknown,
    public status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const MyErrorResponseSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
  status: z.number().optional(),
});

export type MyErrorResponseType = z.infer<typeof MyErrorResponseSchema>;
