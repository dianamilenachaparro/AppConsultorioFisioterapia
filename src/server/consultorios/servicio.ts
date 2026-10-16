import "server-only";
import type { z } from "zod";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { cambiarEstadoSchema, consultorioSchema, editarConsultorioSchema } from "@/lib/validacion/admin";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma, type Tx } from "@/server/db";
import { citasPendientes } from "@/server/usuarios/servicio";

const nombreDuplicado = () =>
  new ErrorDominio("DUPLICADO", "Ya existe un consultorio con ese nombre", undefined, { nombre: ["Nombre en uso"] });

/** Nombre único sin distinguir mayúsculas ni espacios extremos. */
async function exigirNombreLibre(tx: Tx, nombre: string, exceptoId?: string) {
  const otro = await tx.consultorio.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) },
    select: { id: true },
  });
  if (otro) throw nombreDuplicado();
}

export async function listarConsultorios(sesion: Sesion) {
  exigirPermiso(sesion, "admin:consultorios");
  return prisma.consultorio.findMany({
    select: { id: true, nombre: true, orden: true, activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
}

export async function crearConsultorio(sesion: Sesion, entrada: z.input<typeof consultorioSchema>) {
  exigirPermiso(sesion, "admin:consultorios");
  const d = consultorioSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      await exigirNombreLibre(tx, d.nombre);
      const orden = d.orden ?? ((await tx.consultorio.aggregate({ _max: { orden: true } }))._max.orden ?? 0) + 1;
      const c = await tx.consultorio.create({ data: { nombre: d.nombre, orden } });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "CONSULTORIO_CREAR",
        entidad: "consultorio",
        entidadId: c.id,
        despues: { nombre: c.nombre, orden: c.orden },
      });
      return { id: c.id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

export async function editarConsultorio(sesion: Sesion, entrada: z.input<typeof editarConsultorioSchema>) {
  exigirPermiso(sesion, "admin:consultorios");
  const { id, ...cambios } = editarConsultorioSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.consultorio.findUnique({ where: { id } });
      if (!actual) throw new ErrorDominio("NO_ENCONTRADO", "Consultorio no encontrado");
      if (cambios.nombre) await exigirNombreLibre(tx, cambios.nombre, id);
      const nuevo = await tx.consultorio.update({ where: { id }, data: cambios });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "CONSULTORIO_EDITAR",
        entidad: "consultorio",
        entidadId: id,
        antes: { nombre: actual.nombre, orden: actual.orden },
        despues: { nombre: nuevo.nombre, orden: nuevo.orden },
      });
      return { id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/** Igual que con usuarios: avisa de las citas futuras PROGRAMADAS, que se conservan. */
export async function cambiarEstadoConsultorio(
  sesion: Sesion,
  entrada: z.input<typeof cambiarEstadoSchema>,
  ahora = new Date(),
) {
  exigirPermiso(sesion, "admin:consultorios");
  const { id, activo, confirmar } = cambiarEstadoSchema.parse(entrada);
  return prisma.$transaction(async (tx) => {
    const actual = await tx.consultorio.findUnique({ where: { id }, select: { activo: true } });
    if (!actual) throw new ErrorDominio("NO_ENCONTRADO", "Consultorio no encontrado");
    if (actual.activo === activo) return { id, activo };
    if (!activo) {
      const pendientes = await citasPendientes(tx, { consultorioId: id }, ahora);
      if (pendientes.length > 0 && !confirmar) {
        throw new ErrorDominio(
          "REQUIERE_CONFIRMACION",
          `Tiene ${pendientes.length} cita(s) programada(s) desde hoy. Se conservarán; revisa si debes reubicarlas.`,
          pendientes,
        );
      }
    }
    await tx.consultorio.update({ where: { id }, data: { activo } });
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: activo ? "CONSULTORIO_ACTIVAR" : "CONSULTORIO_DESACTIVAR",
      entidad: "consultorio",
      entidadId: id,
      antes: { activo: actual.activo },
      despues: { activo },
    });
    return { id, activo };
  });
}
