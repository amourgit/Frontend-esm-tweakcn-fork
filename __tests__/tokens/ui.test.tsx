// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ColorsTabContent } from "@/components/editor/colors-tab-content";
import { TokensTabContent } from "@/components/editor/tokens-tab-content";
import TokensPreview from "@/components/editor/theme-preview/tokens-preview";
import ColorPreview from "@/components/editor/theme-preview/color-preview";
import { defaultThemeState } from "@/config/theme";
import type { ThemeStyles } from "@/types/theme";
import { applyThemeToElement } from "@/utils/apply-theme";
import { getOverriddenColorKeys, resetColorKeys, resetTokenPaths, setToken } from "@/utils/tokens/edit";
import { DERIVED_COLORS, DERIVED_COLOR_KEYS } from "@/utils/tokens/derive";
import { getTokenDefinitions } from "@/utils/tokens/registry";
import { getPath } from "@/utils/tokens/object-path";
import { resolveTheme } from "@/utils/tokens/resolve";
import { tokenCssVarName } from "@/utils/tokens/css-vars";
import { clone, stateOf, stylesOf, THEME_NAMES } from "./helpers";

let latest: ThemeStyles;

/** Providers de l'application (layout racine) nécessaires aux composants testés. */
const Providers = ({ children }: { children: React.ReactNode }) => (
  <NuqsTestingAdapter>
    <TooltipProvider>{children}</TooltipProvider>
  </NuqsTestingAdapter>
);

/** Même câblage que ThemeControlPanel (mêmes fonctions pures), sans les providers de l'application. */
function Harness({ initial, mode = "light" }: { initial: ThemeStyles; mode?: "light" | "dark" }) {
  const [styles, setStyles] = useState(initial);
  latest = styles;
  const resolved = resolveTheme(styles);
  const current = { ...defaultThemeState.styles[mode], ...styles[mode] };
  return (
    <Providers>
      <div data-testid="colors">
        <ColorsTabContent
          currentStyles={current}
          updateStyle={(key, value) => setStyles((s) => ({ ...s, [mode]: { ...current, [key]: value } }))}
          updateStyles={(updates) => setStyles((s) => ({ ...s, [mode]: { ...current, ...updates } }))}
          resolvedStyles={resolved[mode]}
          overriddenKeys={getOverriddenColorKeys(styles, mode)}
          resetStyleKeys={(keys) => setStyles((s) => resetColorKeys(s, mode, keys))}
        />
      </div>
      <div data-testid="tokens">
        <TokensTabContent
          resolvedTokens={resolved.tokens}
          overrides={styles.tokens}
          updateToken={(path, value) => setStyles((s) => setToken(s, path, value))}
          resetTokens={(paths) => setStyles((s) => resetTokenPaths(s, paths))}
        />
      </div>
    </Providers>
  );
}

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  document.documentElement.className = "";
});
afterEach(cleanup);

describe("application live sur le DOM (applyThemeToElement)", () => {
  const apply = (name: string, mode: "light" | "dark" = "light") => {
    const root = document.documentElement;
    applyThemeToElement({ ...stateOf(name), currentMode: mode }, root);
    return root;
  };

  it.each(THEME_NAMES)("« %s » : toutes les couleurs étendues et tous les tokens sont appliqués", (name) => {
    const root = apply(name);
    for (const key of DERIVED_COLOR_KEYS) {
      expect(root.style.getPropertyValue(`--${key}`), `--${key}`).not.toBe("");
    }
    for (const def of getTokenDefinitions().filter((d) => !d.optional)) {
      expect(root.style.getPropertyValue(def.cssVar), def.cssVar).not.toBe("");
    }
    // les variables historiques sont toujours là
    expect(root.style.getPropertyValue("--primary")).not.toBe("");
    expect(root.style.getPropertyValue("--shadow-md")).not.toBe("");
  });

  it("suit le mode (clair/sombre) pour les couleurs étendues, pas pour les tokens", () => {
    const light = apply("default", "light");
    const lightOverlay = light.style.getPropertyValue("--overlay");
    const lightFast = light.style.getPropertyValue("--motion-duration-fast");
    const dark = apply("default", "dark");
    expect(dark.style.getPropertyValue("--overlay")).not.toBe(lightOverlay);
    expect(dark.style.getPropertyValue("--motion-duration-fast")).toBe(lightFast);
  });

  it("l'alpha des couleurs translucides arrive jusqu'au DOM", () => {
    expect(apply("default").style.getPropertyValue("--overlay")).toMatch(/\/ 0\.45\)$/);
  });

  it("applique un override de token et le restaure au changement de thème", () => {
    const styles = setToken(stylesOf("default"), ["motion", "duration", "fast"], "77ms");
    applyThemeToElement({ ...stateOf("default", styles) }, document.documentElement);
    expect(document.documentElement.style.getPropertyValue("--motion-duration-fast")).toBe("77ms");
    applyThemeToElement(stateOf("violet-bloom"), document.documentElement);
    expect(document.documentElement.style.getPropertyValue("--motion-duration-fast")).toBe("100ms");
  });

  it("les couleurs dérivées suivent le preset appliqué", () => {
    const hover = (n: string) => apply(n).style.getPropertyValue("--primary-hover");
    expect(hover("default")).not.toBe(hover("violet-bloom"));
  });
});

describe("onglet Couleurs — couleurs étendues", () => {
  it("affiche tous les groupes et toutes les couleurs étendues, « Auto » par défaut", () => {
    render(<Harness initial={clone(stylesOf("violet-bloom"))} />);
    const colors = within(screen.getByTestId("colors"));
    const rows = colors.getAllByText(/^Auto$/);
    expect(rows).toHaveLength(DERIVED_COLORS.length);
    for (const group of ["Status", "Interactive states", "Surfaces & layout", "Borders & focus", "Text, links & selection", "Charts (extended)", "Sidebar (extended)", "Scrollbar"]) {
      expect(colors.getAllByText(group).length, group).toBeGreaterThan(0);
    }
  });

  it("modifier une couleur étendue crée un override « Custom » ; le reset revient à Auto", async () => {
    const { container } = render(<Harness initial={clone(stylesOf("default"))} />);
    const row = container.querySelector('[data-extended-color="success"]') as HTMLElement;
    expect(row).toBeTruthy();
    const text = row.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(text, { target: { value: "#123456" } });
    // ColorPicker temporise la saisie (DEBOUNCE_DELAY) avant de notifier l'éditeur
    await waitFor(() => expect((latest.light as Record<string, string>).success).toBe("#123456"));
    expect(resolveTheme(latest).light["success-foreground"]).toBeTruthy();
    expect(container.querySelector('[data-extended-color="success"] button[aria-label^="Reset"]')).toBeTruthy();

    fireEvent.click(container.querySelector('[data-extended-color="success"] button[aria-label^="Reset"]')!);
    expect((latest.light as Record<string, string>).success).toBeUndefined();
    expect(container.querySelector('[data-extended-color="success"] button[aria-label^="Reset"]')).toBeNull();
  });

  it("la recherche trouve une couleur étendue", () => {
    render(<Harness initial={clone(stylesOf("default"))} />);
    const input = within(screen.getByTestId("colors")).getByPlaceholderText("Search colors...");
    fireEvent.change(input, { target: { value: "scrollbar" } });
    expect(within(screen.getByTestId("colors")).getAllByText(/Scrollbar thumb/).length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("colors")).queryByText("Primary hover")).toBeNull();
  });
});

describe("onglet Tokens", () => {
  it("expose CHAQUE token du catalogue avec un contrôle (rien d'oublié)", () => {
    const { container } = render(<Harness initial={clone(stylesOf("default"))} />);
    const tokensRoot = screen.getByTestId("tokens");
    // Ouvrir toutes les sections via la recherche vide n'ouvre rien : on lit simplement le DOM (sections repliées visuellement mais rendues)
    for (const def of getTokenDefinitions().filter((d) => d.group !== "palette")) {
      const row = tokensRoot.querySelector(`[data-token="${def.id}"]`);
      expect(row, def.id).toBeTruthy();
      expect(row!.querySelector("input, button[role='combobox'], button[role='switch']"), `${def.id} control`).toBeTruthy();
    }
    expect(container.querySelector('[data-testid="palette-editor"]')).toBeTruthy();
  });

  it("édite un token longueur (valeur + unité), un enum, un booléen et un texte", () => {
    render(<Harness initial={clone(stylesOf("default"))} />);
    const tokens = screen.getByTestId("tokens");

    const width = tokens.querySelector('[data-token="layout.sidebar.width"] input') as HTMLInputElement;
    fireEvent.change(width, { target: { value: "20" } });
    expect(getPath(latest.tokens, ["layout", "sidebar", "width"])).toBe("20rem");

    const sticky = tokens.querySelector('[data-token="layout.header.sticky"] button[role="switch"]') as HTMLElement;
    fireEvent.click(sticky);
    expect(getPath(latest.tokens, ["layout", "header", "sticky"])).toBe(false);

    const duration = tokens.querySelector('[data-token="motion.duration.fast"] input') as HTMLInputElement;
    fireEvent.change(duration, { target: { value: "60" } });
    expect(getPath(latest.tokens, ["motion", "duration", "fast"])).toBe("60ms");

    const family = tokens.querySelector('[data-token="typography.fontFamily.heading"] input') as HTMLInputElement;
    fireEvent.change(family, { target: { value: "Georgia, serif" } });
    expect(getPath(latest.tokens, ["typography", "fontFamily", "heading"])).toBe("Georgia, serif");

    const z = tokens.querySelector('[data-token="zIndex.modal"] input') as HTMLInputElement;
    fireEvent.change(z, { target: { value: "450" } });
    expect(getPath(latest.tokens, ["zIndex", "modal"])).toBe(450); // reste un nombre
  });

  it("un champ vidé n'écrase pas le défaut pendant la saisie ; le reset retire l'override", () => {
    render(<Harness initial={clone(stylesOf("default"))} />);
    const tokens = screen.getByTestId("tokens");
    const input = tokens.querySelector('[data-token="typography.fontFamily.body"] input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Inter" } });
    expect(getPath(latest.tokens, ["typography", "fontFamily", "body"])).toBe("Inter");
    fireEvent.change(input, { target: { value: "" } });
    expect(getPath(latest.tokens, ["typography", "fontFamily", "body"])).toBe("Inter"); // pas encore remis à défaut
    fireEvent.click(tokens.querySelector('[data-token="typography.fontFamily.body"] button[aria-label^="Reset"]')!);
    expect(latest.tokens).toBeUndefined(); // plus aucun override : la clé `tokens` disparaît
  });

  it("l'éditeur de palette crée des overrides par nuance et régénère la rampe", () => {
    const { container } = render(<Harness initial={clone(stylesOf("violet-bloom"))} />);
    const swatch = container.querySelector('[data-palette="primary"] input[aria-label="primary 500"]') as HTMLInputElement;
    fireEvent.change(swatch, { target: { value: "#ff0000" } });
    expect(getPath(latest.tokens, ["palette", "primary", "500"])).toBe("#ff0000");
    fireEvent.click(container.querySelector('[data-palette="primary"] button[aria-label="Reset primary ramp"]')!);
    expect(latest.tokens).toBeUndefined();
  });

  it("la recherche filtre les tokens (id, libellé ou variable CSS)", () => {
    render(<Harness initial={clone(stylesOf("default"))} />);
    const tokens = screen.getByTestId("tokens");
    fireEvent.change(within(tokens).getByLabelText("Search tokens"), { target: { value: "--motion-easing" } });
    expect(tokens.querySelector('[data-token="motion.easing.spring"]')).toBeTruthy();
    expect(tokens.querySelector('[data-token="layout.sidebar.width"]')).toBeNull();
    fireEvent.change(within(tokens).getByLabelText("Search tokens"), { target: { value: "zzzz-nope" } });
    expect(within(tokens).getByText("No tokens found")).toBeTruthy();
  });

  it("l'override d'un token se répercute sur l'aperçu et sur le DOM (bout en bout)", () => {
    const { container } = render(<Harness initial={clone(stylesOf("default"))} />);
    const tokens = screen.getByTestId("tokens");
    fireEvent.change(tokens.querySelector('[data-token="radius.component.card"] input') as HTMLInputElement, { target: { value: "var(--radius-3xl)" } });
    act(() => {
      applyThemeToElement({ ...defaultThemeState, styles: latest }, document.documentElement);
    });
    expect(document.documentElement.style.getPropertyValue(tokenCssVarName(["radius", "component", "card"]))).toBe("var(--radius-3xl)");
    expect(container).toBeTruthy();
  });
});

describe("aperçus", () => {
  it("TokensPreview rend toutes les sections et toutes les entrées d'échelle", () => {
    const { container } = render(<TokensPreview styles={clone(stylesOf("violet-bloom"))} />);
    for (const title of ["Status", "Interactive states", "Surfaces & layout", "Borders & focus", "Typography scale", "Radius", "Shadows", "Motion", "Components", "Palette", "Effects, opacity, z-index & icons"]) {
      expect(container.querySelector(`[data-tokens-section="${title}"]`), title).toBeTruthy();
    }
    expect(container.querySelectorAll("[data-scale]")).toHaveLength(15);
    expect(container.querySelectorAll("[data-ramp]")).toHaveLength(8);
    expect(container.querySelectorAll("[data-status]")).toHaveLength(4);
  });

  it("TokensPreview reflète un token personnalisé (nouvelle entrée d'échelle)", () => {
    const styles = setToken(stylesOf("default"), ["typography", "scale", "hero"], { size: "5rem", weight: "800", lineHeight: "1", letterSpacing: "-0.04em" });
    const { container } = render(<TokensPreview styles={styles} />);
    expect(container.querySelector('[data-scale="hero"]')).toBeTruthy();
  });

  it("ColorPreview affiche les couleurs étendues avec leurs valeurs résolues", () => {
    const { container } = render(
      <Providers>
        <ColorPreview styles={clone(stylesOf("violet-bloom"))} currentMode="dark" />
      </Providers>
    );
    expect(container.querySelectorAll("[data-extended-group]")).toHaveLength(8);
    expect(screen.getAllByText("Success hover").length).toBeGreaterThan(0);
  });
});
