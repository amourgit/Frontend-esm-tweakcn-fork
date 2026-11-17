/**
 * Identité et URL publique du service (source unique).
 * NEXT_PUBLIC_APP_URL fixe l'URL publique au build/déploiement ; à défaut, l'origine du navigateur.
 */
export const PRODUCT_NAME = "EGEN Theme Studio";
export const PRODUCT_SHORT_NAME = "Theme Studio";
export const PUBLISHER_NAME = "CIVITAS";
export const PRODUCT_DESCRIPTION =
  "Éditeur de thèmes de l'écosystème EGEN : personnalisez les thèmes (shadcn/ui, Tailwind CSS v4), prévisualisez en direct et exportez le code.";

export function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}
