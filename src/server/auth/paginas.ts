import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { puedeAlguna, type Accion } from "@/lib/permisos";
import { obtenerSesion, type Sesion } from "@/server/auth/sesion";

/** Una sola lectura de la sesión por solicitud, aunque la pidan layout y página. */
export const sesionDeSolicitud = cache(() => obtenerSesion());

/**
 * Protege una página (Server Component): sin sesión → /login; contraseña pendiente
 * de cambio → /cambiar-password; sin permiso (basta uno de la lista) → /prohibido.
 */
export async function paginaProtegida(accion?: Accion | readonly Accion[]): Promise<Sesion> {
  const sesion = await sesionDeSolicitud();
  if (!sesion) redirect("/login");
  if (sesion.debeCambiarPassword) redirect("/cambiar-password");
  if (accion) {
    const acciones = typeof accion === "string" ? [accion] : accion;
    if (!puedeAlguna(sesion.rol, acciones)) redirect("/prohibido");
  }
  return sesion;
}
