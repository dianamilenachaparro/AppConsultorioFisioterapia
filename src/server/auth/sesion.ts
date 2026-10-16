import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { puede, puedeAlguna, type Accion, type Rol } from "@/lib/permisos";
import { ErrorDominio } from "@/lib/resultado";
import { prisma, type Tx } from "@/server/db";

export const COOKIE_SESION = "sesion";
export const INACTIVIDAD_MS = 30 * 60 * 1000;
export const VIDA_ABSOLUTA_MS = 12 * 60 * 60 * 1000;
const RENOVACION_MS = 60 * 1000;

/** Lo único que el resto del sistema sabe de quien está conectado. */
export type Sesion = {
  id: string;
  usuarioId: string;
  rol: Rol;
  nombre: string;
  atiendePacientes: boolean;
  debeCambiarPassword: boolean;
};

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Crea la fila de sesión y devuelve el token en claro (solo va a la cookie). */
export async function crearSesionEnBD(usuarioId: string, ahora = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await prisma.sesion.create({
    data: { usuarioId, tokenHash: hashToken(token), creadaEn: ahora, ultimaActividad: ahora },
  });
  return token;
}

/**
 * Valida un token: existe, el usuario está activo, no superó 30 min de inactividad
 * ni 12 h de vida. Renueva `ultima_actividad` como máximo una vez por minuto.
 */
export async function validarToken(token: string, ahora = new Date()): Promise<Sesion | null> {
  const fila = await prisma.sesion.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: true },
  });
  if (!fila) return null;
  const inactiva = ahora.getTime() - fila.ultimaActividad.getTime() > INACTIVIDAD_MS;
  const vencida = ahora.getTime() - fila.creadaEn.getTime() > VIDA_ABSOLUTA_MS;
  if (inactiva || vencida || !fila.usuario.activo) {
    await prisma.sesion.deleteMany({ where: { id: fila.id } });
    return null;
  }
  if (ahora.getTime() - fila.ultimaActividad.getTime() > RENOVACION_MS) {
    await prisma.sesion.updateMany({ where: { id: fila.id }, data: { ultimaActividad: ahora } });
  }
  return {
    id: fila.id,
    usuarioId: fila.usuarioId,
    rol: fila.usuario.rol,
    nombre: fila.usuario.nombreCompleto,
    atiendePacientes: fila.usuario.atiendePacientes,
    debeCambiarPassword: fila.usuario.debeCambiarPassword,
  };
}

export async function guardarCookieSesion(token: string) {
  (await cookies()).set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VIDA_ABSOLUTA_MS / 1000,
  });
}

export async function borrarCookieSesion() {
  (await cookies()).delete(COOKIE_SESION);
}

/** Sesión de la solicitud actual, o `null`. */
export async function obtenerSesion(ahora = new Date()): Promise<Sesion | null> {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (!token) return null;
  return validarToken(token, ahora);
}

export async function exigirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion();
  if (!sesion) throw new ErrorDominio("NO_AUTENTICADO");
  return sesion;
}

/** Autorización real: se llama en cada servicio antes de tocar datos. */
export function exigirPermiso(sesion: Sesion, accion: Accion | readonly Accion[]) {
  const acciones = typeof accion === "string" ? [accion] : accion;
  const permitido = acciones.length === 1 ? puede(sesion.rol, acciones[0]) : puedeAlguna(sesion.rol, acciones);
  if (!permitido) throw new ErrorDominio("SIN_PERMISO");
}

export async function borrarSesionesDeUsuario(tx: Tx, usuarioId: string, exceptoId?: string) {
  await tx.sesion.deleteMany({
    where: { usuarioId, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) },
  });
}
