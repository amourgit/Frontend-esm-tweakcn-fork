import { create } from "zustand";
import { DEFAULT_THEME_ID } from "@/config/default-theme-id";
import { Theme, ThemePreset } from "@/types/theme";
import { getThemes } from "@/actions/themes";

/** Convertit une ligne `theme` de la base en preset utilisable par l'éditeur. */
export function themeToPreset(theme: Theme, source: "SAVED" | "BUILT_IN"): ThemePreset {
  return {
    label: theme.name,
    description: theme.description,
    version: theme.currentVersion,
    revision: theme.currentRevision,
    isDefault: theme.isDefault,
    styles: theme.styles,
    source,
    createdAt: new Date(theme.createdAt).toISOString(),
  };
}

interface ThemePresetStore {
  presets: Record<string, ThemePreset>;
  /** Thème pris par défaut par le studio : celui dont l'attribut `is_default` est coché en base. */
  defaultPresetId: string;
  registerPreset: (name: string, preset: ThemePreset) => void;
  unregisterPreset: (name: string) => void;
  updatePreset: (name: string, preset: ThemePreset) => void;
  getPreset: (name: string) => ThemePreset | undefined;
  getAllPresets: () => Record<string, ThemePreset>;
  /** Charge les thèmes système lus en base (remplace les précédents, conserve les thèmes de l'utilisateur). */
  setSystemPresets: (themes: Theme[]) => void;
  loadSavedPresets: () => Promise<void>;
  unloadSavedPresets: () => void;
}

const onlySystem = (presets: Record<string, ThemePreset>) =>
  Object.fromEntries(Object.entries(presets).filter(([, p]) => p.source === "BUILT_IN"));

export const useThemePresetStore = create<ThemePresetStore>()((set, get) => ({
  // Les thèmes système viennent de la base : `setSystemPresets` les injecte avant le premier rendu de l'éditeur.
  presets: {},
  defaultPresetId: DEFAULT_THEME_ID,
  setSystemPresets: (themes: Theme[]) => {
    const system = Object.fromEntries(themes.map((t) => [t.id, themeToPreset(t, "BUILT_IN")]));
    const flagged = themes.find((t) => t.isDefault);
    set((state) => ({
      defaultPresetId: flagged?.id ?? DEFAULT_THEME_ID,
      presets: {
        ...system,
        ...Object.fromEntries(Object.entries(state.presets).filter(([, p]) => p.source !== "BUILT_IN")),
      },
    }));
  },
  registerPreset: (name: string, preset: ThemePreset) => {
    set((state) => ({ presets: { ...state.presets, [name]: preset } }));
  },
  unregisterPreset: (name: string) => {
    set((state) => {
      const { [name]: _, ...remainingPresets } = state.presets;
      return { presets: remainingPresets };
    });
  },
  loadSavedPresets: async () => {
    try {
      const savedThemes = await getThemes();
      const savedPresets = savedThemes.reduce(
        (acc, theme) => {
          acc[theme.id] = themeToPreset(theme, "SAVED");
          return acc;
        },
        {} as Record<string, ThemePreset>
      );
      set((state) => ({ presets: { ...state.presets, ...savedPresets } }));
    } catch (error) {
      console.error("Failed to load saved presets:", error);
    }
  },
  unloadSavedPresets: () => {
    set((state) => ({ presets: onlySystem(state.presets) }));
  },
  updatePreset: (name: string, preset: ThemePreset) => {
    set((state) => ({ presets: { ...state.presets, [name]: preset } }));
  },
  getPreset: (name: string) => get().presets[name],
  getAllPresets: () => get().presets,
}));
