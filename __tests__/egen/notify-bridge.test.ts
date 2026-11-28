import { afterEach, describe, expect, it, vi } from "vitest";

import { routeToCore, setCoreNotifier, toCoreNotification } from "@/lib/egen/notify-bridge";

afterEach(() => setCoreNotifier(null));

describe("toCoreNotification : toast shadcn → notification du Core", () => {
  it("titre et description deviennent titre et sous-titre", () => {
    expect(toCoreNotification({ title: "Enregistré", description: "Thème « Aube »" })).toEqual({
      kind: "info",
      title: "Enregistré",
      subtitle: "Thème « Aube »",
    });
  });

  it("variante destructive → erreur ; description seule → titre", () => {
    expect(toCoreNotification({ title: "Échec", variant: "destructive" })).toEqual({ kind: "error", title: "Échec" });
    expect(toCoreNotification({ description: "Copié" })).toEqual({ kind: "info", title: "Copié" });
  });

  it("contenu non textuel (nœud React) ou vide : non transmissible", () => {
    expect(toCoreNotification({ title: { type: "span" } })).toBeNull();
    expect(toCoreNotification({ title: "  ", description: "" })).toBeNull();
  });
});

describe("routeToCore : un seul afficheur, jamais de doublon", () => {
  it("sans Core afficheur : le toast reste local", () => {
    expect(routeToCore({ title: "x" })).toBe(false);
  });

  it("avec le Core afficheur : le toast part au Core et n'est pas affiché localement", () => {
    const notifier = vi.fn();
    setCoreNotifier(notifier);
    expect(routeToCore({ title: "Enregistré", variant: "default" })).toBe(true);
    expect(notifier).toHaveBeenCalledWith({ kind: "info", title: "Enregistré" });
  });

  it("toast non transmissible : repli local (rien n'est perdu)", () => {
    const notifier = vi.fn();
    setCoreNotifier(notifier);
    expect(routeToCore({ title: { type: "span" } })).toBe(false);
    expect(notifier).not.toHaveBeenCalled();
  });

  it("débranché : retour à l'affichage local", () => {
    setCoreNotifier(vi.fn());
    setCoreNotifier(null);
    expect(routeToCore({ title: "x" })).toBe(false);
  });
});
