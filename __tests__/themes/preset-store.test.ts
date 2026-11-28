// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/store/editor-store";
import { themeToPreset, useThemePresetStore } from "@/store/theme-preset-store";
import { defaultThemeState } from "@/config/theme";
import { defaultPresets } from "@/utils/theme-presets";
import { getBuiltInThemeStyles } from "@/utils/theme-preset-helper";
import { builtInThemeRows } from "./catalog-helper";

const presets = () => useThemePresetStore.getState();

beforeEach(() => {
  useThemePresetStore.setState({ presets: {} });
  useEditorStore.setState({ themeState: { ...defaultThemeState }, history: [], future: [], themeCheckpoint: null });
});

describe("store de presets alimenté par la base", () => {
  it("démarre vide : plus aucun thème n'est lu depuis le fichier", () => {
    expect(Object.keys(presets().presets)).toHaveLength(0);
  });

  it("setSystemPresets expose les 42 thèmes système et le thème par défaut, identiques à l'ancien chargement fichier", () => {
    presets().setSystemPresets(builtInThemeRows());
    const all = presets().presets;
    expect(Object.keys(all)).toHaveLength(Object.keys(defaultPresets).length + 1);
    for (const [id, preset] of Object.entries(all)) {
      expect(preset.source).toBe("BUILT_IN");
      expect(preset.version).toBe(1);
      expect(preset.revision).toBe(1);
      if (id !== "default") expect(preset.styles).toEqual(getBuiltInThemeStyles(id)!.styles);
    }
  });

  it("applyThemePreset applique un thème système depuis la base, sans modification non enregistrée", () => {
    presets().setSystemPresets(builtInThemeRows());
    useEditorStore.getState().applyThemePreset("modern-minimal");
    expect(useEditorStore.getState().themeState.styles.light.primary).toBe("#3b82f6");
    expect(useEditorStore.getState().hasUnsavedChanges()).toBe(false);
  });

  it("une nouvelle version d'un thème système (rechargement) remplace son contenu et son numéro", () => {
    presets().setSystemPresets(builtInThemeRows());
    const rows = builtInThemeRows();
    const edited = rows.find((r) => r.id === "modern-minimal")!;
    edited.styles = { ...edited.styles, light: { ...edited.styles.light, primary: "#123456" } };
    edited.currentVersion = 2;
    edited.description = "Adapté à l'organisation";
    presets().setSystemPresets(rows);
    expect(presets().presets["modern-minimal"]).toMatchObject({ version: 2, description: "Adapté à l'organisation" });
    expect(presets().presets["modern-minimal"].styles.light.primary).toBe("#123456");
  });

  it("recharger les thèmes système conserve les thèmes enregistrés, et se déconnecter conserve les thèmes système", () => {
    const [first] = builtInThemeRows();
    presets().registerPreset("mine", themeToPreset({ ...first, id: "mine", source: "USER", userId: "u1" }, "SAVED"));
    presets().setSystemPresets(builtInThemeRows());
    expect(presets().presets.mine?.source).toBe("SAVED");
    presets().unloadSavedPresets();
    expect(presets().presets.mine).toBeUndefined();
    expect(Object.keys(presets().presets)).toHaveLength(Object.keys(defaultPresets).length + 1);
  });

  it("le thème par défaut est celui dont l'attribut is_default est coché en base", () => {
    expect(presets().defaultPresetId).toBe("default"); // valeur de repli avant chargement
    const rows = builtInThemeRows().map((r) => ({ ...r, isDefault: r.id === "modern-minimal" }));
    presets().setSystemPresets(rows);
    expect(presets().defaultPresetId).toBe("modern-minimal");
    expect(presets().presets["modern-minimal"].isDefault).toBe(true);
    expect(presets().presets.default.isDefault).toBe(false);
  });

  it("le thème par défaut se charge depuis la base comme les autres", () => {
    presets().setSystemPresets(builtInThemeRows());
    useEditorStore.getState().applyThemePreset("default");
    expect(useEditorStore.getState().themeState.styles).toEqual(defaultThemeState.styles);
    expect(useEditorStore.getState().hasUnsavedChanges()).toBe(false);
  });
});
