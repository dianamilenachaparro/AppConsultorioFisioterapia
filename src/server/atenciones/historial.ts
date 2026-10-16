import "server-only";
import type { ZonaCorporal } from "@/generated/prisma/client";
import { ErrorDominio } from "@/lib/resultado";
import { esMismoDiaBogota } from "@/lib/tiempo";
import { uuid } from "@/lib/validacion/comunes";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

/**
 * Dueño y Recepcionista ven todos los historiales; el Profesional solo los de
 * pacientes con al menos una cita suya, en cualquier estado.
 */
export async function exigirAccesoHistorial(sesion: Sesion, pacienteId: string) {
  exigirPermiso(sesion, ["historial:ver_todos", "historial:ver_propios"]);
  if (sesion.rol !== "PROFESIONAL") return;
  const cita = await prisma.cita.findFirst({
    where: { pacienteId, profesionalId: sesion.usuarioId },
    select: { id: true },
  });
  if (!cita) throw new ErrorDominio("SIN_PERMISO");
}

/** Editable por su autor o el Dueño, solo el día en que se registró (Bogotá) (FR-025a). */
export function esEditable(
  sesion: Sesion,
  atencion: { creadoPorId: string; creadoEn: Date },
  ahora = new Date(),
) {
  const autorizado = sesion.rol === "DUENO" || atencion.creadoPorId === sesion.usuarioId;
  return autorizado && esMismoDiaBogota(atencion.creadoEn, ahora);
}

export type PuntoDolor = { fecha: Date; dolor: number };

/** Historial clínico del paciente con la serie de dolor por zona (FR-026, FR-027). */
export async function obtenerHistorial(sesion: Sesion, entrada: { pacienteId: string }, ahora = new Date()) {
  exigirPermiso(sesion, ["historial:ver_todos", "historial:ver_propios"]);
  const pacienteId = uuid.parse(entrada.pacienteId);

  // 1) Paciente + comprobación de acceso del Profesional en la misma consulta.
  const paciente = await prisma.paciente.findUnique({
    where: { id: pacienteId },
    select: {
      id: true,
      documento: true,
      nombreCompleto: true,
      telefono: true,
      fechaNacimiento: true,
      ...(sesion.rol === "PROFESIONAL"
        ? { citas: { where: { profesionalId: sesion.usuarioId }, select: { id: true }, take: 1 } }
        : {}),
    },
  });
  if (!paciente) throw new ErrorDominio("NO_ENCONTRADO", "Paciente no encontrado");
  if (sesion.rol === "PROFESIONAL" && !("citas" in paciente && paciente.citas.length > 0)) {
    throw new ErrorDominio("SIN_PERMISO");
  }

  // 2) Atenciones con profesional y notas.
  const filas = await prisma.atencion.findMany({
    where: { pacienteId },
    orderBy: { fecha: "desc" },
    include: {
      profesional: { select: { nombreCompleto: true } },
      notasAclaratorias: {
        orderBy: { creadoEn: "asc" },
        include: { creadoPor: { select: { nombreCompleto: true } } },
      },
    },
  });

  const atenciones = filas.map((a) => ({
    id: a.id,
    citaId: a.citaId,
    fecha: a.fecha,
    profesional: a.profesional.nombreCompleto,
    zonaCorporal: a.zonaCorporal,
    motivo: a.motivo,
    tecnica: a.tecnica,
    dolor: a.dolor,
    notasEvolucion: a.notasEvolucion,
    editada: a.actualizadoEn !== null,
    editable: esEditable(sesion, a, ahora),
    notasAclaratorias: a.notasAclaratorias.map((n) => ({
      id: n.id,
      texto: n.texto,
      autor: n.creadoPor.nombreCompleto,
      creadoEn: n.creadoEn,
    })),
  }));

  const serieDolor: Partial<Record<ZonaCorporal, PuntoDolor[]>> = {};
  for (const a of [...atenciones].reverse()) {
    (serieDolor[a.zonaCorporal] ??= []).push({ fecha: a.fecha, dolor: a.dolor });
  }

  const { id, documento, nombreCompleto, telefono, fechaNacimiento } = paciente;
  return { paciente: { id, documento, nombreCompleto, telefono, fechaNacimiento }, atenciones, serieDolor };
}

export type Historial = Awaited<ReturnType<typeof obtenerHistorial>>;
