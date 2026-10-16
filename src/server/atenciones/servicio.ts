import "server-only";
import { z } from "zod";
import type { Atencion } from "@/generated/prisma/client";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { esMismoDiaBogota } from "@/lib/tiempo";
import { uuid } from "@/lib/validacion/comunes";
import {
  editarAtencionSchema,
  notaAclaratoriaSchema,
  registrarAtencionSchema,
} from "@/lib/validacion/atencion";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma, type Tx } from "@/server/db";
import { esEditable, exigirAccesoHistorial } from "./historial";

/** Campos clínicos que se guardan en la auditoría (versiones). */
function valoresAtencion(a: Pick<Atencion, "zonaCorporal" | "motivo" | "tecnica" | "dolor" | "notasEvolucion">) {
  return {
    zonaCorporal: a.zonaCorporal,
    motivo: a.motivo,
    tecnica: a.tecnica,
    dolor: a.dolor,
    notasEvolucion: a.notasEvolucion,
  };
}

/** Editar y agregar notas: el autor de la atención o el Dueño. */
function exigirAutorODueno(sesion: Sesion, atencion: Pick<Atencion, "creadoPorId">) {
  if (sesion.rol !== "DUENO" && atencion.creadoPorId !== sesion.usuarioId) throw new ErrorDominio("SIN_PERMISO");
}

async function bloquearAtencion(tx: Tx, id: string) {
  const filas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM atencion WHERE id = ${id}::uuid FOR UPDATE`;
  if (filas.length === 0) throw new ErrorDominio("NO_ENCONTRADO", "Atención no encontrada");
  return tx.atencion.findUniqueOrThrow({ where: { id } });
}

/** Registra la atención de una cita ASISTIDA; Profesional solo en sus citas (FR-024). */
export async function registrarAtencion(sesion: Sesion, entrada: z.input<typeof registrarAtencionSchema>) {
  exigirPermiso(sesion, "atenciones:registrar");
  const { citaId, ...campos } = registrarAtencionSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM cita WHERE id = ${citaId}::uuid FOR UPDATE`;
      if (filas.length === 0) throw new ErrorDominio("NO_ENCONTRADO", "Cita no encontrada");
      const cita = await tx.cita.findUniqueOrThrow({ where: { id: citaId }, include: { atencion: { select: { id: true } } } });
      if (sesion.rol === "PROFESIONAL" && cita.profesionalId !== sesion.usuarioId) throw new ErrorDominio("SIN_PERMISO");
      if (cita.estado !== "ASISTIDA") {
        throw new ErrorDominio("ESTADO_INVALIDO", "Solo se registra la atención de una cita Asistida");
      }
      if (cita.atencion) throw new ErrorDominio("DUPLICADO", "Esta cita ya tiene una atención registrada");
      const atencion = await tx.atencion.create({
        data: {
          ...campos,
          citaId,
          pacienteId: cita.pacienteId,
          profesionalId: cita.profesionalId,
          fecha: cita.inicio,
          creadoPorId: sesion.usuarioId,
        },
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "ATENCION_CREAR",
        entidad: "atencion",
        entidadId: atencion.id,
        despues: { citaId, ...valoresAtencion(atencion) },
      });
      return { id: atencion.id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/** Corrige una atención solo el día en que se registró (Bogotá); guarda la versión anterior en la auditoría. */
export async function editarAtencion(sesion: Sesion, entrada: z.input<typeof editarAtencionSchema>, ahora = new Date()) {
  exigirPermiso(sesion, "atenciones:registrar");
  const { id, ...campos } = editarAtencionSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await bloquearAtencion(tx, id);
      exigirAutorODueno(sesion, actual);
      if (!esMismoDiaBogota(actual.creadoEn, ahora)) {
        throw new ErrorDominio(
          "FUERA_DE_VENTANA",
          "La atención solo se puede editar el mismo día; agrega una nota aclaratoria",
        );
      }
      const nueva = await tx.atencion.update({
        where: { id },
        data: { ...campos, actualizadoPorId: sesion.usuarioId, actualizadoEn: ahora },
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "ATENCION_EDITAR",
        entidad: "atencion",
        entidadId: id,
        antes: valoresAtencion(actual),
        despues: valoresAtencion(nueva),
      });
      return { id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/** Agrega una nota aclaratoria (solo inserción) en cualquier momento (FR-025b). */
export async function agregarNotaAclaratoria(sesion: Sesion, entrada: z.input<typeof notaAclaratoriaSchema>) {
  exigirPermiso(sesion, "atenciones:registrar");
  const { atencionId, texto } = notaAclaratoriaSchema.parse(entrada);
  return prisma.$transaction(async (tx) => {
    const atencion = await tx.atencion.findUnique({ where: { id: atencionId }, select: { creadoPorId: true } });
    if (!atencion) throw new ErrorDominio("NO_ENCONTRADO", "Atención no encontrada");
    exigirAutorODueno(sesion, atencion);
    const nota = await tx.notaAclaratoria.create({ data: { atencionId, texto, creadoPorId: sesion.usuarioId } });
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "ATENCION_NOTA_AGREGAR",
      entidad: "atencion",
      entidadId: atencionId,
      despues: { notaId: nota.id, texto },
    });
    return { id: nota.id };
  });
}

export type VersionAtencion = {
  editadoPor: string;
  editadoEn: Date;
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
};

/** Ediciones de una atención, de la más reciente a la más antigua, leídas de la auditoría. */
export async function obtenerVersionesAtencion(sesion: Sesion, atencionId: string): Promise<VersionAtencion[]> {
  const id = uuid.parse(atencionId);
  const atencion = await prisma.atencion.findUnique({ where: { id }, select: { pacienteId: true } });
  if (!atencion) throw new ErrorDominio("NO_ENCONTRADO", "Atención no encontrada");
  await exigirAccesoHistorial(sesion, atencion.pacienteId);
  const filas = await prisma.registroAuditoria.findMany({
    where: { entidad: "atencion", entidadId: id, accion: "ATENCION_EDITAR" },
    orderBy: { creadoEn: "desc" },
    include: { usuario: { select: { nombreCompleto: true } } },
  });
  return filas.map((f) => ({
    editadoPor: f.usuario.nombreCompleto,
    editadoEn: f.creadoEn,
    antes: (f.antes ?? {}) as Record<string, unknown>,
    despues: (f.despues ?? {}) as Record<string, unknown>,
  }));
}

/** Atención de una cita para la pantalla de registro, con sus notas y si se puede editar. */
export async function obtenerAtencionDeCita(sesion: Sesion, citaId: string, ahora = new Date()) {
  exigirPermiso(sesion, "atenciones:registrar");
  const atencion = await prisma.atencion.findUnique({
    where: { citaId: uuid.parse(citaId) },
    include: {
      notasAclaratorias: { orderBy: { creadoEn: "asc" }, include: { creadoPor: { select: { nombreCompleto: true } } } },
    },
  });
  if (!atencion) return null;
  return {
    ...atencion,
    editable: esEditable(sesion, atencion, ahora),
    puedeAgregarNota: sesion.rol === "DUENO" || atencion.creadoPorId === sesion.usuarioId,
  };
}
