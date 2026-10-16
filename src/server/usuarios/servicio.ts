import "server-only";
import type { z } from "zod";
import type { Rol } from "@/lib/permisos";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import {
  cambiarEstadoSchema,
  crearUsuarioSchema,
  editarUsuarioSchema,
  restablecerPasswordSchema,
} from "@/lib/validacion/admin";
import { uuid } from "@/lib/validacion/comunes";
import { auditar } from "@/server/auditoria/auditar";
import { hashPassword } from "@/server/auth/hash";
import { borrarSesionesDeUsuario, exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma, type Tx } from "@/server/db";

const vista = {
  id: true,
  cedula: true,
  nombreCompleto: true,
  rol: true,
  atiendePacientes: true,
  activo: true,
  debeCambiarPassword: true,
  bloqueadoHasta: true,
  creadoEn: true,
} as const;

export type CitaPendiente = { id: string; inicio: Date; paciente: string; consultorio: string; profesional: string };

/** Citas PROGRAMADAS desde ahora que se verían afectadas por una desactivación. */
export async function citasPendientes(
  tx: Tx,
  filtro: { profesionalId?: string; consultorioId?: string },
  ahora = new Date(),
): Promise<CitaPendiente[]> {
  const citas = await tx.cita.findMany({
    where: { ...filtro, estado: "PROGRAMADA", inicio: { gte: ahora } },
    orderBy: { inicio: "asc" },
    select: {
      id: true,
      inicio: true,
      paciente: { select: { nombreCompleto: true } },
      consultorio: { select: { nombre: true } },
      profesional: { select: { nombreCompleto: true } },
    },
  });
  return citas.map((c) => ({
    id: c.id,
    inicio: c.inicio,
    paciente: c.paciente.nombreCompleto,
    consultorio: c.consultorio.nombre,
    profesional: c.profesional.nombreCompleto,
  }));
}

/** Recepcionista nunca atiende; Profesional atiende salvo que se diga lo contrario; Dueño solo si se indica. */
function atiendeSegunRol(rol: Rol, pedido: boolean | undefined) {
  if (rol === "RECEPCIONISTA") {
    if (pedido) {
      throw new ErrorDominio("VALIDACION", "Una Recepcionista no puede atender pacientes", undefined, {
        atiendePacientes: ["No aplica para Recepcionista"],
      });
    }
    return false;
  }
  return pedido ?? rol === "PROFESIONAL";
}

/**
 * Impide quedarse sin Dueño activo. Bloquea las filas de los Dueños activos para que
 * dos cambios simultáneos no puedan dejar el sistema sin ninguno.
 */
async function exigirOtroDuenoActivo(tx: Tx, usuarioId: string) {
  const duenos = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM usuario WHERE rol = 'DUENO' AND activo FOR UPDATE`;
  if (duenos.every((d) => d.id === usuarioId)) {
    throw new ErrorDominio("VALIDACION", "Debe quedar al menos un Dueño activo");
  }
}

export async function listarUsuarios(sesion: Sesion) {
  exigirPermiso(sesion, "admin:usuarios");
  return prisma.usuario.findMany({ select: vista, orderBy: [{ activo: "desc" }, { nombreCompleto: "asc" }] });
}

export async function obtenerUsuario(sesion: Sesion, id: string) {
  exigirPermiso(sesion, "admin:usuarios");
  const u = uuid.safeParse(id).success ? await prisma.usuario.findUnique({ where: { id }, select: vista }) : null;
  if (!u) throw new ErrorDominio("NO_ENCONTRADO", "Usuario no encontrado");
  return u;
}

/** Crea un usuario con contraseña inicial que deberá cambiar al entrar (FR-003). */
export async function crearUsuario(sesion: Sesion, entrada: z.input<typeof crearUsuarioSchema>) {
  exigirPermiso(sesion, "admin:usuarios");
  const d = crearUsuarioSchema.parse(entrada);
  const atiendePacientes = atiendeSegunRol(d.rol, d.atiendePacientes);
  const passwordHash = await hashPassword(d.passwordInicial);
  try {
    return await prisma.$transaction(async (tx) => {
      if (await tx.usuario.findUnique({ where: { cedula: d.cedula }, select: { id: true } })) {
        throw new ErrorDominio("DUPLICADO", "Ya existe un usuario con esa cédula", undefined, {
          cedula: ["Cédula ya registrada"],
        });
      }
      const u = await tx.usuario.create({
        data: {
          cedula: d.cedula,
          nombreCompleto: d.nombreCompleto,
          rol: d.rol,
          atiendePacientes,
          passwordHash,
          debeCambiarPassword: true,
        },
        select: vista,
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "USUARIO_CREAR",
        entidad: "usuario",
        entidadId: u.id,
        despues: { cedula: u.cedula, nombreCompleto: u.nombreCompleto, rol: u.rol, atiendePacientes },
      });
      return u;
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

export async function editarUsuario(sesion: Sesion, entrada: z.input<typeof editarUsuarioSchema>) {
  exigirPermiso(sesion, "admin:usuarios");
  const { id, ...cambios } = editarUsuarioSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.usuario.findUnique({ where: { id }, select: vista });
      if (!actual) throw new ErrorDominio("NO_ENCONTRADO", "Usuario no encontrado");
      const rol = cambios.rol ?? actual.rol;
      if (actual.rol === "DUENO" && rol !== "DUENO" && actual.activo) await exigirOtroDuenoActivo(tx, id);
      // Si cambia el rol y no se indica, se aplica el valor por defecto del nuevo rol.
      const pedido = cambios.atiendePacientes ?? (rol === actual.rol ? actual.atiendePacientes : undefined);
      const atiendePacientes = atiendeSegunRol(rol, rol === "RECEPCIONISTA" ? cambios.atiendePacientes : pedido);
      const nuevo = await tx.usuario.update({
        where: { id },
        data: { nombreCompleto: cambios.nombreCompleto ?? actual.nombreCompleto, rol, atiendePacientes },
        select: vista,
      });
      // Un cambio de rol cambia los permisos: se cierran sus sesiones para que entren con el nuevo.
      if (rol !== actual.rol) await borrarSesionesDeUsuario(tx, id);
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "USUARIO_EDITAR",
        entidad: "usuario",
        entidadId: id,
        antes: { nombreCompleto: actual.nombreCompleto, rol: actual.rol, atiendePacientes: actual.atiendePacientes },
        despues: { nombreCompleto: nuevo.nombreCompleto, rol: nuevo.rol, atiendePacientes: nuevo.atiendePacientes },
      });
      return nuevo;
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/**
 * Activa o desactiva. Si al desactivar tiene citas futuras PROGRAMADAS, pide confirmación
 * devolviéndolas; las citas se conservan. Desactivar cierra sus sesiones (FR-003, FR-004).
 */
export async function cambiarEstadoUsuario(sesion: Sesion, entrada: z.input<typeof cambiarEstadoSchema>, ahora = new Date()) {
  exigirPermiso(sesion, "admin:usuarios");
  const { id, activo, confirmar } = cambiarEstadoSchema.parse(entrada);
  return prisma.$transaction(async (tx) => {
    const actual = await tx.usuario.findUnique({ where: { id }, select: { rol: true, activo: true } });
    if (!actual) throw new ErrorDominio("NO_ENCONTRADO", "Usuario no encontrado");
    if (actual.activo === activo) return { id, activo };
    if (!activo) {
      if (actual.rol === "DUENO") await exigirOtroDuenoActivo(tx, id);
      const pendientes = await citasPendientes(tx, { profesionalId: id }, ahora);
      if (pendientes.length > 0 && !confirmar) {
        throw new ErrorDominio(
          "REQUIERE_CONFIRMACION",
          `Tiene ${pendientes.length} cita(s) programada(s) desde hoy. Se conservarán; revisa si debes reasignarlas.`,
          pendientes,
        );
      }
      await borrarSesionesDeUsuario(tx, id);
    }
    await tx.usuario.update({ where: { id }, data: { activo } });
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: activo ? "USUARIO_ACTIVAR" : "USUARIO_DESACTIVAR",
      entidad: "usuario",
      entidadId: id,
      antes: { activo: actual.activo },
      despues: { activo },
    });
    return { id, activo };
  });
}

/** Fija una contraseña temporal: cierra sus sesiones, exige cambiarla y quita el bloqueo. */
export async function restablecerPassword(sesion: Sesion, entrada: z.input<typeof restablecerPasswordSchema>) {
  exigirPermiso(sesion, "admin:usuarios");
  const { id, passwordNueva } = restablecerPasswordSchema.parse(entrada);
  const passwordHash = await hashPassword(passwordNueva);
  return prisma.$transaction(async (tx) => {
    const existe = await tx.usuario.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new ErrorDominio("NO_ENCONTRADO", "Usuario no encontrado");
    await tx.usuario.update({
      where: { id },
      data: { passwordHash, debeCambiarPassword: true, intentosFallidos: 0, bloqueadoHasta: null },
    });
    await borrarSesionesDeUsuario(tx, id);
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "USUARIO_RESTABLECER_PASSWORD",
      entidad: "usuario",
      entidadId: id,
    });
    return { id };
  });
}
