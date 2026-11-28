import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createTheme,
  createThemeVersion,
  deleteTheme,
  restoreThemeRevision,
  saveThemeState,
} from "@/actions/themes";
import { themeKeys } from "./use-themes-data";
import { ThemeStyles, Theme } from "@/types/theme";
import { ErrorCode } from "@/types/errors";
import { toast } from "@/components/ui/use-toast";
import { themeToPreset, useThemePresetStore } from "@/store/theme-preset-store";
import { useRouter } from "next/navigation";

/** Métadonnées saisies à l'enregistrement d'un état (ou à la création d'un thème). */
export interface ThemeSaveInput {
  name?: string;
  description?: string | null;
  /** Message de l'état (comme un message de commit). */
  message?: string | null;
  metadata?: Record<string, unknown>;
}

const ERROR_NAMES: Record<string, string> = {
  [ErrorCode.THEME_REVISION_CONFLICT]: "ThemeRevisionConflictError",
  [ErrorCode.THEME_ALREADY_VERSIONED]: "ThemeRevisionAlreadyVersionedError",
  [ErrorCode.THEME_FORBIDDEN]: "ThemeForbiddenError",
};

/** Convertit un résultat d'action en erreur typée (le nom survit, le message du serveur aussi). */
function unwrap<T>(result: { success: true; data: T } | { success: false; error: { code: string; message: string } }): T {
  if (result.success) return result.data;
  const error = new Error(result.error.message);
  error.name = ERROR_NAMES[result.error.code] ?? "Error";
  throw error;
}

function handleMutationError(error: Error, operation: string) {
  console.error(`Theme ${operation} error:`, error);

  const getErrorMessage = (error: Error) => {
    switch (error.name) {
      case "UnauthorizedError":
        return "Please sign in to continue.";
      case "ValidationError":
        return error.message || "Invalid input provided.";
      case "ThemeNotFoundError":
        return "Theme not found.";
      case "ThemeRevisionConflictError":
        return "This theme was modified elsewhere. Reload it before saving your changes.";
      case "ThemeRevisionAlreadyVersionedError":
        return error.message;
      case "ThemeForbiddenError":
        return error.message || "This action is not allowed on this theme.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  };

  toast({
    title: `Failed to ${operation}`,
    description: getErrorMessage(error),
    variant: "destructive",
  });

  return error;
}

/** Après toute écriture : aligne le store de presets et rafraîchit les caches (liste, fiche, états, versions). */
function syncAfterWrite(queryClient: QueryClient, theme: Theme) {
  useThemePresetStore
    .getState()
    .updatePreset(theme.id, themeToPreset(theme, theme.source === "BUILT_IN" ? "BUILT_IN" : "SAVED"));
  queryClient.setQueryData(themeKeys.detail(theme.id), theme);
  queryClient.invalidateQueries({ queryKey: themeKeys.lists() });
  queryClient.invalidateQueries({ queryKey: themeKeys.history(theme.id) });
}

/** Crée un thème appartenant à l'utilisateur (état 1 + version 1), éventuellement dérivé d'un autre. */
export function useCreateTheme() {
  const queryClient = useQueryClient();
  const { registerPreset } = useThemePresetStore();

  return useMutation({
    mutationFn: async (
      data: Omit<ThemeSaveInput, "name"> & {
        name: string;
        styles: ThemeStyles;
        derivedFromThemeId?: string;
      }
    ) => unwrap(await createTheme(data)),
    onSuccess: (data) => {
      registerPreset(data.id, themeToPreset(data, "SAVED"));
      queryClient.setQueryData(themeKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: themeKeys.lists() });

      toast({
        title: "Theme saved",
        description: `"${data.name}" has been saved successfully.`,
      });
    },
    onError: (error) => handleMutationError(error as Error, "save theme"),
  });
}

/**
 * Enregistre un nouvel ÉTAT d'un thème de l'utilisateur. Avec `release`, pose aussi une version sur
 * cet état. N'est jamais appelé sur un thème système (le studio propose alors une copie dérivée).
 */
export function useSaveThemeState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: ThemeSaveInput & {
        id: string;
        styles?: ThemeStyles;
        baseRevision?: number;
        release?: { notes?: string | null };
      }
    ) => unwrap(await saveThemeState(data)),
    onSuccess: (data) => {
      syncAfterWrite(queryClient, data);
      if (!data.revisionCreated && !data.versionCreated) {
        toast({
          title: "No changes to save",
          description: `"${data.name}" is identical to its current state.`,
        });
        return;
      }
      toast({
        title: data.versionCreated ? "State saved and version created" : "State saved",
        description: data.versionCreated
          ? `"${data.name}" is now at version ${data.currentVersion}.`
          : `"${data.name}" is now at state ${data.currentRevision}.`,
      });
    },
    onError: (error) => handleMutationError(error as Error, "save state"),
  });
}

/** Pose une version sur un état précis d'un thème (par défaut son état courant). */
export function useCreateThemeVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { themeId: string; revision?: number; notes?: string | null }) =>
      unwrap(await createThemeVersion(data)),
    onSuccess: (data) => {
      syncAfterWrite(queryClient, data);
      toast({
        title: `Version ${data.createdVersion} created`,
        description: `A version now marks this state of "${data.name}".`,
      });
    },
    onError: (error) => handleMutationError(error as Error, "create version"),
  });
}

/** Restaure un ancien état : crée un nouvel état avec son contenu (l'historique n'est jamais réécrit). */
export function useRestoreThemeRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { themeId: string; revision: number }) =>
      unwrap(await restoreThemeRevision(data.themeId, data.revision)),
    onSuccess: (data) => {
      syncAfterWrite(queryClient, data);
      toast(
        data.revisionCreated
          ? { title: "State restored", description: `"${data.name}" is now at state ${data.currentRevision}.` }
          : { title: "Already current", description: "This state is already the current one." }
      );
    },
    onError: (error) => handleMutationError(error as Error, "restore state"),
  });
}

export function useDeleteTheme() {
  const queryClient = useQueryClient();
  const { unregisterPreset } = useThemePresetStore();
  const router = useRouter();

  return useMutation({
    mutationFn: (themeId: string) => deleteTheme(themeId),
    onMutate: async (themeId) => {
      await queryClient.cancelQueries({ queryKey: themeKeys.lists() });
      const previousThemes = queryClient.getQueryData(themeKeys.lists());

      queryClient.setQueryData(themeKeys.lists(), (old: Theme[] | undefined) => {
        return old ? old.filter((theme) => theme.id !== themeId) : [];
      });

      return { previousThemes, themeId };
    },
    onSuccess: (data, themeId) => {
      unregisterPreset(themeId);
      queryClient.removeQueries({ queryKey: themeKeys.detail(themeId) });

      toast({
        title: "Theme deleted",
        description: `"${data.name}" has been deleted successfully.`,
      });
      router.refresh();
    },
    onError: (error, _themeId, context) => {
      if (context?.previousThemes) {
        queryClient.setQueryData(themeKeys.lists(), context.previousThemes);
      }
      handleMutationError(error as Error, "delete theme");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: themeKeys.lists() });
    },
  });
}

