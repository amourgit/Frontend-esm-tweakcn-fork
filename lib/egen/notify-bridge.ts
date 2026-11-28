import type { NotificationInput } from "@egen-civitas/esm-embed-client";

/** Notification locale de l'app (forme des toasts shadcn de `hooks/use-toast`). */
export interface LocalToast {
  title?: unknown;
  description?: unknown;
  variant?: string | null;
}

type CoreNotifier = (toast: NotificationInput) => void;

let coreNotifier: CoreNotifier | null = null;

/**
 * Branche (ou débranche, avec `null`) l'affichage des toasts par le Core. Tant qu'il est branché, l'app n'affiche PAS
 * ses propres toasts : un seul afficheur, jamais de doublon (docs/integration-apps/17, toasts partagés).
 */
export function setCoreNotifier(notifier: CoreNotifier | null): void {
  coreNotifier = notifier;
}

const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** Traduit un toast shadcn en notification du Core. `null` si le toast n'a pas de contenu textuel transmissible. */
export function toCoreNotification(toast: LocalToast): NotificationInput | null {
  const title = asText(toast.title) ?? asText(toast.description);
  if (!title) return null;
  const subtitle = asText(toast.title) ? asText(toast.description) : undefined;
  return { kind: toast.variant === "destructive" ? "error" : "info", title, ...(subtitle ? { subtitle } : {}) };
}

/** Confie le toast au Core s'il est l'afficheur. `true` : pris en charge (ne pas l'afficher localement). */
export function routeToCore(toast: LocalToast): boolean {
  if (!coreNotifier) return false;
  const notification = toCoreNotification(toast);
  if (!notification) return false;
  coreNotifier(notification);
  return true;
}
