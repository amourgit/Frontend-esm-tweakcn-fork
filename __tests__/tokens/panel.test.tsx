// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import ThemeControlPanel from "@/components/editor/theme-control-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { defaultThemeState } from "@/config/theme";
import { useEditorStore } from "@/store/editor-store";
import { getPath } from "@/utils/tokens/object-path";
import { resolveTheme } from "@/utils/tokens/resolve";

afterEach(cleanup);

/** Le vrai panneau, branché sur le vrai store (comme dans l'éditeur). */
function Panel() {
  const { themeState, setThemeState } = useEditorStore();
  return (
    <ThemeControlPanel
      styles={themeState.styles}
      currentMode={themeState.currentMode}
      onChange={(styles) => setThemeState({ ...themeState, styles })}
    />
  );
}

const mount = (tab: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NuqsTestingAdapter searchParams={`?tab=${tab}`}>
        <TooltipProvider>
          <Panel />
        </TooltipProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>
  );

describe("ThemeControlPanel (vrai store)", () => {
  it("onglet Tokens : l'édition met à jour le store et le thème résolu", async () => {
    useEditorStore.setState({ themeState: { ...defaultThemeState } });
    const { container } = mount("tokens");
    const input = await waitFor(() => {
      const el = container.querySelector('[data-token="layout.sidebar.width"] input') as HTMLInputElement | null;
      expect(el).toBeTruthy();
      return el!;
    });
    fireEvent.change(input, { target: { value: "19" } });
    await waitFor(() => expect(getPath(useEditorStore.getState().themeState.styles.tokens, ["layout", "sidebar", "width"])).toBe("19rem"));
    expect(getPath(resolveTheme(useEditorStore.getState().themeState.styles).tokens, ["layout", "sidebar", "width"])).toBe("19rem");
    // le reset retire l'override
    fireEvent.click(container.querySelector('[data-token="layout.sidebar.width"] button[aria-label^="Reset"]')!);
    await waitFor(() => expect(useEditorStore.getState().themeState.styles.tokens).toBeUndefined());
  });

  it("onglet Couleurs : une couleur étendue modifiée est stockée comme override du mode courant", async () => {
    useEditorStore.setState({ themeState: { ...defaultThemeState, currentMode: "dark" } });
    const { container } = mount("colors");
    const row = await waitFor(() => {
      const el = container.querySelector('[data-extended-color="info"]');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    fireEvent.change(row.querySelector('input[type="text"]') as HTMLInputElement, { target: { value: "#0044ff" } });
    await waitFor(() => expect((useEditorStore.getState().themeState.styles.dark as Record<string, string>).info).toBe("#0044ff"));
    expect((useEditorStore.getState().themeState.styles.light as Record<string, string>).info).toBeUndefined();
    expect(within(row).getByText("Custom")).toBeTruthy();
  });

  it("l'onglet Tokens est présent dans la barre d'onglets", async () => {
    useEditorStore.setState({ themeState: { ...defaultThemeState } });
    mount("colors");
    expect(await screen.findByRole("tab", { name: "Tokens" })).toBeTruthy();
  });
});
