import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ColorFormat } from "@/types";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";
export type ColorSelectorTab = "list" | "palette";
/** `standard` : variables shadcn historiques ; `complete` : + squelette EGEN (couleurs étendues, tokens). */
export type TokenScope = "standard" | "complete";

const colorFormatsByVersion = {
  "3": ["hex", "rgb", "hsl"] as const,
  "4": ["hex", "rgb", "hsl", "oklch"] as const,
};

interface PreferencesStore {
  tailwindVersion: "3" | "4";
  colorFormat: ColorFormat;
  packageManager: PackageManager;
  colorSelectorTab: ColorSelectorTab;
  tokenScope: TokenScope;
  chatSuggestionsOpen: boolean;
  setTailwindVersion: (version: "3" | "4") => void;
  setColorFormat: (format: ColorFormat) => void;
  setPackageManager: (pm: PackageManager) => void;
  setColorSelectorTab: (tab: ColorSelectorTab) => void;
  setTokenScope: (scope: TokenScope) => void;
  setChatSuggestionsOpen: (open: boolean) => void;
  getAvailableColorFormats: () => readonly ColorFormat[];
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set, get) => ({
      tailwindVersion: "4",
      colorFormat: "oklch",
      packageManager: "pnpm",
      colorSelectorTab: "list",
      tokenScope: "complete",
      chatSuggestionsOpen: true,
      setTailwindVersion: (version: "3" | "4") => {
        const currentFormat = get().colorFormat;
        if (version === "3" && currentFormat === "oklch") {
          set({ tailwindVersion: version, colorFormat: "hsl" });
        } else {
          set({ tailwindVersion: version });
        }
      },
      setColorFormat: (format: ColorFormat) => {
        const availableFormats = get().getAvailableColorFormats();
        if (availableFormats.includes(format)) {
          set({ colorFormat: format });
        }
      },
      setPackageManager: (pm: PackageManager) => {
        set({ packageManager: pm });
      },
      setColorSelectorTab: (tab: ColorSelectorTab) => {
        set({ colorSelectorTab: tab });
      },
      setTokenScope: (scope: TokenScope) => {
        set({ tokenScope: scope });
      },
      getAvailableColorFormats: () => {
        const version = get().tailwindVersion as "3" | "4";
        return colorFormatsByVersion[version];
      },
      setChatSuggestionsOpen: (open: boolean) => {
        set({ chatSuggestionsOpen: open });
      },
    }),
    {
      name: "preferences-storage", // unique name for localStorage
    }
  )
);
