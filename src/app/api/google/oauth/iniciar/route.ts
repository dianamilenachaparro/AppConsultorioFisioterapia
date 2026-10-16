import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/server/auth/sesion";
import { COOKIE_ESTADO_OAUTH, iniciarConexion, VIDA_ESTADO_S } from "@/server/google/oauth";

/** Paso 1 de la conexión con Google: solo el Dueño; guarda el `state` firmado 10 min. */
export async function GET(request: NextRequest) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.redirect(new URL("/login?siguiente=/finanzas/google", request.url));
  if (sesion.rol !== "DUENO") return NextResponse.redirect(new URL("/prohibido", request.url));
  const { url, cookie } = iniciarConexion(sesion);
  const respuesta = NextResponse.redirect(url);
  respuesta.cookies.set(COOKIE_ESTADO_OAUTH, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google/oauth",
    maxAge: VIDA_ESTADO_S,
  });
  return respuesta;
}
