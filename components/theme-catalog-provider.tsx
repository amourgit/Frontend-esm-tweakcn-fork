"use client";

import { useState, type ReactNode } from "react";
import { useThemePresetStore } from "@/store/theme-preset-store";
import type { Theme } from "@/types/theme";

/**
 * Injecte dans le store les thèmes système (dont le thème par défaut) lus en base AVANT le premier rendu des enfants
 * (le sélecteur, `applyThemePreset`, `hasUnsavedChanges`… les lisent de façon synchrone).
 * Ces données sont publiques et identiques pour tous les utilisateurs.
 */
export function ThemeCatalogProvider({
  systemThemes,
  children,
}: {
  systemThemes: Theme[];
  children: ReactNode;
}) {
  useState(() => {
    useThemePresetStore.getState().setSystemPresets(systemThemes);
    return null;
  });
  return <>{children}</>;
}
