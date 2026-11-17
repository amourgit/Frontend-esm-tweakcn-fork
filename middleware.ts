import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { API_AUTH_PREFIX, DEFAULT_LOGIN_REDIRECT } from "./routes";

/**
 * Garde légère (runtime Edge, sans accès base) : sans cookie de session, retour à l'éditeur.
 * La validité réelle de la session est vérifiée côté serveur (pages /settings, server actions).
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith(API_AUTH_PREFIX)) {
    return NextResponse.next();
  }

  const hasSessionCookie = !!getSessionCookie(request);

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, request.url));
  }

  // Redirige /settings (racine) vers /settings/themes
  if (pathname === "/settings") {
    return NextResponse.redirect(new URL("/settings/themes", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/editor/theme/:themeId", "/settings/:path*"],
};
