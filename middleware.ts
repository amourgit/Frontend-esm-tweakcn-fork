import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { frameAncestorsHeader } from "./lib/frame-ancestors";
import { API_AUTH_PREFIX, DEFAULT_LOGIN_REDIRECT } from "./routes";

const PROTECTED = /^\/(editor\/theme\/[^/]+|settings(\/.*)?)$/;

function withEmbedding(response: NextResponse): NextResponse {
  // EGEN : autorise l'affichage dans le Core (iframe) si EGEN_FRAME_ANCESTORS est défini (lu à l'exécution).
  const csp = frameAncestorsHeader(process.env.EGEN_FRAME_ANCESTORS);
  if (csp) response.headers.set("Content-Security-Policy", csp);
  return response;
}

/**
 * Garde légère (runtime Edge, sans accès base) : sans cookie de session, retour à l'éditeur.
 * La validité réelle de la session est vérifiée côté serveur (pages /settings, server actions).
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith(API_AUTH_PREFIX) || !PROTECTED.test(pathname)) {
    return withEmbedding(NextResponse.next());
  }

  if (!getSessionCookie(request)) {
    return withEmbedding(NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, request.url)));
  }

  // Redirige /settings (racine) vers /settings/themes
  if (pathname === "/settings") {
    return withEmbedding(NextResponse.redirect(new URL("/settings/themes", request.url)));
  }

  return withEmbedding(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)"],
};
