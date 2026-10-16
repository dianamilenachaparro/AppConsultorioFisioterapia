import "server-only";
import { z } from "zod";
import { cedula as esquemaCedula, password as esquemaPassword } from "@/lib/validacion/comunes";
import { ErrorDominio } from "@/lib/resultado";
import { auditar } from "@/server/auditoria/auditar";
import { hashPassword, obtenerHashFicticio, verificarPassword } from "@/server/auth/hash";
import {
  borrarCookieSesion,
  borrarSesionesDeUsuario,
  COOKIE_SESION,
  crearSesionEnBD,
  guardarCookieSesion,
  hashToken,
  type Sesion,
} from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { cookies } from "next/headers";

export const MAX_INTENTOS = 5;
export const BLOQUEO_MS = 15 * 60 * 1000;

const credenciales = z.object({ cedula: z.string(), password: z.string() });

function invalidas() {
  return new ErrorDominio("CREDENCIALES_INVALIDAS");
}

/**
 * Verifica cédula y contraseña. Todos los rechazos (cédula inexistente, contraseña
 * incorrecta, usuario inactivo o bloqueado) usan el mismo error genérico (US1-5).
 */
export async function autenticar(entrada: { cedula: string; password: string }, ahora = new Date()) {
  const { cedula, password } = credenciales.parse(entrada);
  const usuario = esquemaCedula.safeParse(cedula).success
    ? await prisma.usuario.findUnique({ where: { cedula: cedula.trim() } })
    : null;

  if (!usuario) {
    // Igualar tiempos para no revelar si la cédula existe.
    await verificarPassword(await obtenerHashFicticio(), password);
    throw invalidas();
  }

  const bloqueado = usuario.bloqueadoHasta && usuario.bloqueadoHasta > ahora;
  const passwordOk = await verificarPassword(usuario.passwordHash, password);

  if (!usuario.activo || bloqueado) throw invalidas();

  if (!passwordOk) {
    const intentos = usuario.intentosFallidos + 1;
    const bloquear = intentos >= MAX_INTENTOS;
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: usuario.id },
        data: {
          intentosFallidos: bloquear ? 0 : intentos,
          bloqueadoHasta: bloquear ? new Date(ahora.getTime() + BLOQUEO_MS) : usuario.bloqueadoHasta,
        },
      });
      if (bloquear) {
        await auditar(tx, {
          usuarioId: usuario.id,
          accion: "SESION_BLOQUEO",
          entidad: "usuario",
          entidadId: usuario.id,
        });
      }
    });
    throw invalidas();
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { intentosFallidos: 0, bloqueadoHasta: null },
    });
    await auditar(tx, { usuarioId: usuario.id, accion: "SESION_INICIAR", entidad: "usuario", entidadId: usuario.id });
  });
  return usuario;
}

/** Inicia sesión: autentica, crea la sesión en BD y la cookie. Solo en Server Actions. */
export async function iniciarSesion(entrada: { cedula: string; password: string }) {
  const usuario = await autenticar(entrada);
  const token = await crearSesionEnBD(usuario.id);
  await guardarCookieSesion(token);
  return { rol: usuario.rol, debeCambiarPassword: usuario.debeCambiarPassword };
}

export async function cerrarSesion() {
  const token = (await cookies()).get(COOKIE_SESION)?.value;
  if (token) await prisma.sesion.deleteMany({ where: { tokenHash: hashToken(token) } });
  await borrarCookieSesion();
}

export const esquemaCambioPassword = z
  .object({
    actual: z.string().min(1, "Escribe tu contraseña actual"),
    nueva: esquemaPassword,
    confirmacion: z.string(),
  })
  .refine((d) => d.nueva === d.confirmacion, {
    path: ["confirmacion"],
    message: "La confirmación no coincide",
  })
  .refine((d) => d.nueva !== d.actual, {
    path: ["nueva"],
    message: "La nueva contraseña debe ser diferente a la actual",
  });

/** Cambia la contraseña propia y cierra las demás sesiones del usuario. */
export async function cambiarPassword(sesion: Sesion, entrada: z.input<typeof esquemaCambioPassword>) {
  const datos = esquemaCambioPassword.parse(entrada);
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: sesion.usuarioId } });
  if (!(await verificarPassword(usuario.passwordHash, datos.actual))) {
    throw new ErrorDominio("VALIDACION", "La contraseña actual no es correcta", undefined, {
      actual: ["La contraseña actual no es correcta"],
    });
  }
  const passwordHash = await hashPassword(datos.nueva);
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash, debeCambiarPassword: false },
    });
    await borrarSesionesDeUsuario(tx, usuario.id, sesion.id);
    await auditar(tx, {
      usuarioId: usuario.id,
      accion: "USUARIO_CAMBIAR_PASSWORD",
      entidad: "usuario",
      entidadId: usuario.id,
    });
  });
}
