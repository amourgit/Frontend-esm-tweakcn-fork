/**
 * Identité et URL publique du service (source unique).
 * NEXT_PUBLIC_APP_URL fixe l'URL publique au build/déploiement ; à défaut, l'origine du navigateur.
 */
export const PRODUCT_NAME = "EGEN Theme Studio";
export const PUBLISHER_NAME = "CIVITAS";
export const PUBLISHER_URL = "https://civitas-africa.vercel.app/";

export function getBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}
