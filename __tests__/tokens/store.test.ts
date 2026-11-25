// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { defaultThemeState } from "@/config/theme";
import { useEditorStore } from "@/store/editor-store";
import type { ThemeStyles } from "@/types/theme";
import { setToken } from "@/utils/tokens/edit";
import { getPath } from "@/utils/tokens/object-path";
import { resolveTheme } from "@/utils/tokens/resolve";

const store = () => useEditorStore.getState();

beforeEach(() => {
  useEditorStore.setState({ themeState: { ...defaultThemeState }, history: [], future: [], themeCheckpoint: null });
});

describe("store de l'éditeur avec tokens", () => {
  it("un thème sans override n'a pas de modifications non enregistrées ; un token personnalisé en crée", () => {
    store().applyThemePreset("violet-bloom");
    expect(store().hasUnsavedChanges()).toBe(false);
    store().setThemeState({ ...store().themeState, styles: setToken(store().themeState.styles, ["motion", "duration", "fast"], "70ms") });
    expect(store().hasUnsavedChanges()).toBe(true);
  });

  it("changer de preset repart du preset (les overrides de tokens ne fuient pas d'un thème à l'autre)", () => {
    store().setThemeState({ ...store().themeState, styles: setToken(store().themeState.styles, ["layout", "header", "height"], "6rem") });
    store().applyThemePreset("cyberpunk");
    expect(store().themeState.styles.tokens).toBeUndefined();
    expect(getPath(resolveTheme(store().themeState.styles).tokens, ["layout", "header", "height"])).toBe("4rem");
  });

  it("annuler / rétablir ramènent aussi les tokens", () => {
    store().applyThemePreset("violet-bloom");
    const next = setToken(store().themeState.styles, ["motion", "duration", "slow"], "800ms");
    store().setThemeState({ ...store().themeState, styles: next });
    expect(getPath(store().themeState.styles.tokens, ["motion", "duration", "slow"])).toBe("800ms");
    store().undo();
    expect(store().themeState.styles.tokens).toBeUndefined();
    store().redo();
    expect(getPath(store().themeState.styles.tokens, ["motion", "duration", "slow"])).toBe("800ms");
  });

  it("« Reset » au preset retire les tokens et les couleurs étendues personnalisées", () => {
    store().applyThemePreset("violet-bloom");
    const styles = setToken(store().themeState.styles, ["zIndex", "modal"], 450) as ThemeStyles;
    (styles.light as Record<string, string>).success = "#123456";
    store().setThemeState({ ...store().themeState, styles });
    expect(store().hasUnsavedChanges()).toBe(true);
    store().resetToCurrentPreset();
    expect(store().themeState.styles.tokens).toBeUndefined();
    expect((store().themeState.styles.light as Record<string, string>).success).toBeUndefined();
    expect(store().hasUnsavedChanges()).toBe(false);
  });

  it("un ancien état persisté (sans tokens ni extras) se résout sans erreur", () => {
    const legacy = JSON.parse(JSON.stringify(defaultThemeState));
    delete legacy.styles.tokens;
    expect(() => resolveTheme(legacy.styles)).not.toThrow();
  });
});
