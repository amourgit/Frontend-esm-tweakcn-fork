"use client";

import { connectToEgen, type EgenClient } from "@egen-civitas/esm-embed-client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { EGEN_MODULE_NAME } from "@/lib/egen/manifest";
import { currentPath, safeGotoPath } from "@/lib/egen/navigation";
import { setCoreNotifier } from "@/lib/egen/notify-bridge";

/** Capacités demandées au Core (l'opérateur approuve le plafond ; le refus est géré sans erreur). */
const CAPABILITIES = ["locale", "navigation", "notifications", "events"] as const;

async function loadHostOrigins(): Promise<string[]> {
  try {
    const response = await fetch("/api/egen/host-origins", { cache: "no-store" });
    const body = (await response.json()) as { hostOrigins?: unknown };
    return Array.isArray(body.hostOrigins) ? body.hostOrigins.filter((o): o is string => typeof o === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Intégration au Core EGEN via le SDK `esm-embed-client` (protocole v2). Ne rend rien ; sans effet hors iframe.
 * - navigation partagée : annonce la page courante, applique les `goto` du Core avec le routeur Next ;
 * - langue : suit la langue de l'interface du Core ;
 * - notifications : le Core est l'afficheur (un seul toast, jamais de doublon).
 */
export function EgenIntegration() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const clientRef = useRef<EgenClient | null>(null);

  useEffect(() => {
    if (window.self === window.top) return; // hors du Core : mode autonome, rien à connecter
    let cancelled = false;
    const offs: Array<() => void> = [];
    // `onChange` / `onGoto` renvoient une promesse de désabonnement : on la résout au nettoyage.
    const track = (unsubscribe: Promise<() => void>) => {
      offs.push(() => void unsubscribe.then((off) => off(), () => undefined));
    };

    void (async () => {
      const hostOrigins = await loadHostOrigins();
      if (cancelled || hostOrigins.length === 0) return;
      const egen = await connectToEgen({ moduleName: EGEN_MODULE_NAME, hostOrigins, capabilities: [...CAPABILITIES] });
      if (cancelled) {
        egen.close();
        return;
      }
      clientRef.current = egen;
      if (!egen.connected) return;

      if (egen.coreDisplaysNotifications) {
        setCoreNotifier((toast) => void egen.notify(toast).catch(() => undefined));
      }
      if (egen.has("locale")) {
        const apply = (locale: string) => {
          if (locale) document.documentElement.lang = locale;
        };
        void egen.locale.get().then(apply, () => undefined);
        track(egen.locale.onChange(apply));
      }
      if (egen.has("navigation")) {
        track(
          egen.navigation.onGoto(({ path }) => {
            const target = safeGotoPath(path);
            if (target) router.push(target);
          })
        );
        void egen.navigation.report(currentPath(window.location.pathname, window.location.search), { replace: true }).catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
      setCoreNotifier(null);
      offs.forEach((off) => off());
      clientRef.current?.close();
      clientRef.current = null;
    };
  }, [router]);

  // Page courante → Core (à chaque changement de route côté app).
  useEffect(() => {
    const egen = clientRef.current;
    if (!egen?.connected || !egen.has("navigation")) return;
    void egen.navigation.report(currentPath(pathname, search)).catch(() => undefined);
  }, [pathname, search]);

  return null;
}
