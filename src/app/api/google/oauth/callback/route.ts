import { NextResponse, type NextRequest } from "next/server";
import { registrarError } from "@/lib/log";
import { ErrorDominio } from "@/lib/resultado";
import { obtenerSesion } from "@/server/auth/sesion";
import { completarConexion, COOKIE_ESTADO_OAUTH } from "@/server/google/oauth";

/** Paso 2: Google vuelve aquí con `code` y `state`; se valida y se guarda la conexión. */
export async function GET(request: NextRequest) {
  const destino = new URL("/finanzas/google", request.url);
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.redirect(new URL("/login?siguiente=/finanzas/google", request.url));
  if (sesion.rol !== "DUENO") return NextResponse.redirect(new URL("/prohibido", request.url));

  const p = request.nextUrl.searchParams;
  if (p.get("error")) {
    destino.searchParams.set("error", "cancelado");
  } else {
    try {
      await completarConexion(sesion, {
        code: p.get("code"),
        state: p.get("state"),
        cookie: request.cookies.get(COOKIE_ESTADO_OAUTH)?.value,
      });
      destino.searchParams.set("conectado", "1");
    } catch (e) {
      if (!(e instanceof ErrorDominio)) registrarError("google-callback", e);
      destino.searchParams.set("error", e instanceof ErrorDominio ? "estado" : "google");
    }
  }
  const respuesta = NextResponse.redirect(destino);
  respuesta.cookies.delete({ name: COOKIE_ESTADO_OAUTH, path: "/api/google/oauth" });
  return respuesta;
}
