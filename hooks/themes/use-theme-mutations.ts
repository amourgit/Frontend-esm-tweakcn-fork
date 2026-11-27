import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTheme, updateTheme, deleteTheme, restoreThemeVersion } from "@/actions/themes";
import { themeKeys } from "./use-themes-data";
import { ThemeStyles, Theme } from "@/types/theme";
import { ErrorCode } from "@/types/errors";
import { toast } from "@/components/ui/use-toast";
import { themeToPreset, useThemePresetStore } from "@/store/theme-preset-store";
import { useRouter } from "next/navigation";

/** Métadonnées d'une version, saisies à l'enregistrement. */
export interface ThemeSaveInput {
  name?: string;
  description?: string | null;
  changeNote?: string | null;
  metadata?: Record<string, unknown>;
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
      case "ThemeVersionConflictError":
        return "This theme was modified elsewhere. Reload it before saving your changes.";
      case "ThemeForbiddenError":
        return "This action is not allowed on this theme.";
      default:
        return "An unexpected error occurred. Please try again.";
    }
  };

  toast({
    title: `Failed to ${operation} theme`,
    description: getErrorMessage(error),
    variant: "destructive",
  });

  return error;
}

export function useCreateTheme() {
  const queryClient = useQueryClient();
  const { registerPreset } = useThemePresetStore();

  return useMutation({
    mutationFn: async (
      data: Omit<ThemeSaveInput, "name"> & { name: string; styles: ThemeStyles }
    ) => {
      const result = await createTheme(data);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(themeKeys.lists(), (old: Theme[] | undefined) => {
        return old ? [...old, data] : [data];
      });

      registerPreset(data.id, themeToPreset(data, "SAVED"));

      toast({
        title: "Theme created",
        description: `"${data.name}" has been created successfully.`,
      });
    },
    onError: (error) => {
      // Theme limit errors are already handled in mutationFn, skip duplicate toast
      if ((error as Error).message.includes("limit")) {
        return;
      }
      handleMutationError(error as Error, "create");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: themeKeys.lists() });
    },
  });
}

export function useUpdateTheme() {
  const queryClient = useQueryClient();
  const { updatePreset } = useThemePresetStore();

  return useMutation({
    mutationFn: async (data: { id: string; styles?: ThemeStyles; baseVersion?: number } & ThemeSaveInput) => {
      const result = await updateTheme(data);
      if (!result.success) {
        const error = new Error(result.error.message);
        if (result.error.code === ErrorCode.THEME_VERSION_CONFLICT) {
          error.name = "ThemeVersionConflictError";
        }
        throw error;
      }
      return result.data;
    },
    onMutate: async (updatedTheme) => {
      await queryClient.cancelQueries({ queryKey: themeKeys.lists() });
      await queryClient.cancelQueries({ queryKey: themeKeys.detail(updatedTheme.id) });

      const previousThemes = queryClient.getQueryData(themeKeys.lists());
      const previousTheme = queryClient.getQueryData(themeKeys.detail(updatedTheme.id));

      queryClient.setQueryData(themeKeys.lists(), (old: Theme[] | undefined) => {
        if (!old) return [];
        return old.map((theme) =>
          theme.id === updatedTheme.id
            ? {
                ...theme,
                ...(updatedTheme.name && { name: updatedTheme.name }),
                ...(updatedTheme.styles && { styles: updatedTheme.styles }),
                updatedAt: new Date(),
              }
            : theme
        );
      });

      return { previousThemes, previousTheme };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(themeKeys.detail(data.id), data);
      queryClient.setQueryData(themeKeys.lists(), (old: Theme[] | undefined) => {
        if (!old) return [data];
        return old.map((theme) => (theme.id === data.id ? data : theme));
      });

      // Un thème système reste un thème système : il gagne une version, il ne devient pas « enregistré ».
      updatePreset(data.id, themeToPreset(data, data.source === "BUILT_IN" ? "BUILT_IN" : "SAVED"));

      toast(
        data.versionCreated
          ? {
              title: "New version saved",
              description: `"${data.name}" is now at version ${data.currentVersion}.`,
            }
          : {
              title: "No changes to save",
              description: `"${data.name}" is identical to its current version.`,
            }
      );
    },
    onError: (error, variables, context) => {
      if (context?.previousThemes) {
        queryClient.setQueryData(themeKeys.lists(), context.previousThemes);
      }
      if (context?.previousTheme) {
        queryClient.setQueryData(themeKeys.detail(variables.id), context.previousTheme);
      }
      handleMutationError(error as Error, "update");
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: themeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: themeKeys.detail(variables.id) });
    },
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
      handleMutationError(error as Error, "delete");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: themeKeys.lists() });
    },
  });
}

/** Restaure une ancienne version d'un thème : crée une nouvelle version avec son contenu. */
export function useRestoreThemeVersion() {
  const queryClient = useQueryClient();
  const { updatePreset } = useThemePresetStore();

  return useMutation({
    mutationFn: async (data: { themeId: string; version: number }) => {
      const result = await restoreThemeVersion(data.themeId, data.version);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    onSuccess: (data) => {
      updatePreset(data.id, themeToPreset(data, data.source === "BUILT_IN" ? "BUILT_IN" : "SAVED"));
      queryClient.setQueryData(themeKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: themeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: themeKeys.versions(data.id) });
      toast(
        data.versionCreated
          ? {
              title: "Version restored",
              description: `"${data.name}" is now at version ${data.currentVersion}.`,
            }
          : { title: "Already current", description: "This version is already the current one." }
      );
    },
    onError: (error) => handleMutationError(error as Error, "restore"),
  });
}
