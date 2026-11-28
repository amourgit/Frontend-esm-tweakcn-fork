import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getThemes,
  getTheme,
  getThemeDetails,
  getThemeRevisions,
  getThemeVersions,
} from "@/actions/themes";
import { Theme } from "@/types/theme";

export type ThemeWithPublished = Awaited<ReturnType<typeof getThemes>>[number];

export const themeKeys = {
  all: ["themes"] as const,
  lists: () => [...themeKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...themeKeys.lists(), { filters }] as const,
  details: () => [...themeKeys.all, "detail"] as const,
  detail: (id: string) => [...themeKeys.details(), { id }] as const,
  /** Tout ce qui décrit l'historique d'un thème (fiche, états, versions) : une seule invalidation les rafraîchit. */
  history: (id: string) => [...themeKeys.all, "history", { id }] as const,
  info: (id: string) => [...themeKeys.history(id), "info"] as const,
  revisions: (id: string) => [...themeKeys.history(id), "revisions"] as const,
  versions: (id: string) => [...themeKeys.history(id), "versions"] as const,
};

export function useThemesData(initialData?: ThemeWithPublished[]) {
  return useQuery({
    queryKey: themeKeys.lists(),
    queryFn: getThemes,
    initialData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useThemeData(themeId: string | null, initialData?: Theme) {
  return useQuery({
    queryKey: themeKeys.detail(themeId!),
    queryFn: () => getTheme(themeId!),
    enabled: !!themeId,
    initialData,
    staleTime: 1000 * 60 * 10, // 10 minutes for individual themes
  });
}

export function usePrefetchThemes() {
  const queryClient = useQueryClient();

  return (themeIds: string[]) => {
    themeIds.forEach((id) => {
      queryClient.prefetchQuery({
        queryKey: themeKeys.detail(id),
        queryFn: () => getTheme(id),
        staleTime: 1000 * 60 * 10,
      });
    });
  };
}

/** Fiche d'identité d'un thème persisté (version, auteur, dates, provenance…). */
export function useThemeDetails(themeId: string | null | undefined) {
  return useQuery({
    queryKey: themeKeys.info(themeId!),
    queryFn: () => getThemeDetails(themeId!),
    enabled: !!themeId,
    staleTime: 1000 * 30,
    retry: false,
  });
}

/** États d'un thème (chargés seulement quand `enabled`). */
export function useThemeRevisions(themeId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: themeKeys.revisions(themeId!),
    queryFn: () => getThemeRevisions(themeId!),
    enabled: enabled && !!themeId,
    staleTime: 0,
  });
}

/** Versions d'un thème (chargées seulement quand `enabled`). */
export function useThemeVersions(themeId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: themeKeys.versions(themeId!),
    queryFn: () => getThemeVersions(themeId!),
    enabled: enabled && !!themeId,
    staleTime: 0,
  });
}
