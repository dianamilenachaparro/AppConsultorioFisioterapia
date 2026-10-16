import { NextResponse, type NextRequest } from "next/server";

/**
 * Solo redirige a /login cuando no hay cookie de sesión. No es una barrera de
 * seguridad: la autorización real se verifica en el servidor (src/server/auth/sesion.ts).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("sesion")) return NextResponse.next();
  const url = request.nextUrl.clone();
  const siguiente = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = siguiente === "/" ? "" : `?siguiente=${encodeURIComponent(siguiente)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|api/google/oauth/callback|_next/static|_next/image|favicon.ico).*)",
  ],
};
