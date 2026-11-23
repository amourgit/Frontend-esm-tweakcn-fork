"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type EgenBridge = { onGoto: (fn: (path: string) => boolean | void) => () => void };

/**
 * Intégration EGEN : quand le Core demande une page (retour/avance, lien), navigue en douce avec le routeur Next
 * (sans recharger l'iframe). Sans effet hors iframe (le script /egen-bridge.js ne s'active que dans une iframe).
 */
export function EgenNavSync() {
  const router = useRouter();

  useEffect(() => {
    let off: (() => void) | undefined;
    const register = () => {
      const bridge = (window as unknown as { EgenBridge?: EgenBridge }).EgenBridge;
      if (!bridge || off) return;
      off = bridge.onGoto((path) => {
        router.push(path);
        return true;
      });
    };
    register();
    document.addEventListener("egen-bridge:ready", register);
    return () => {
      document.removeEventListener("egen-bridge:ready", register);
      off?.();
    };
  }, [router]);

  return null;
}
