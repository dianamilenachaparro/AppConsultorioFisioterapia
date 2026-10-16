import "server-only";
import { ErrorDominio } from "@/lib/resultado";
import { instanteBogota } from "@/lib/tiempo";
import { dentroDeHorario } from "@/lib/validacion/cita";
import type { Tx } from "@/server/db";

/** Calcula inicio/fin y valida el horario 07:30–17:00 (también lo garantiza la BD). */
export function calcularHorario(fecha: string, horaInicio: string, duracionMin: number) {
  if (!dentroDeHorario(horaInicio, duracionMin)) throw new ErrorDominio("FUERA_DE_HORARIO");
  const inicio = instanteBogota(fecha, horaInicio);
  return { inicio, fin: new Date(inicio.getTime() + duracionMin * 60_000) };
}

export async function exigirConsultorioActivo(tx: Tx, consultorioId: string) {
  const c = await tx.consultorio.findUnique({ where: { id: consultorioId }, select: { activo: true } });
  if (!c?.activo) {
    throw new ErrorDominio("VALIDACION", "El consultorio no está disponible para nuevas citas", undefined, {
      consultorioId: ["El consultorio no está activo"],
    });
  }
}

export async function exigirProfesionalAsignable(tx: Tx, profesionalId: string) {
  const u = await tx.usuario.findUnique({
    where: { id: profesionalId },
    select: { activo: true, atiendePacientes: true },
  });
  if (!u?.activo || !u.atiendePacientes) {
    throw new ErrorDominio("VALIDACION", "El profesional seleccionado no puede atender citas", undefined, {
      profesionalId: ["Profesional no disponible"],
    });
  }
}

/** Campos de una cita que se guardan en la auditoría. */
export function valoresCita(c: {
  pacienteId: string;
  profesionalId: string;
  consultorioId: string;
  inicio: Date;
  fin: Date;
  duracionMin: number;
  motivo: string;
  zonaCorporal: string;
  estado: string;
  retroactiva: boolean;
}) {
  return {
    pacienteId: c.pacienteId,
    profesionalId: c.profesionalId,
    consultorioId: c.consultorioId,
    inicio: c.inicio,
    fin: c.fin,
    duracionMin: c.duracionMin,
    motivo: c.motivo,
    zonaCorporal: c.zonaCorporal,
    estado: c.estado,
    retroactiva: c.retroactiva,
  };
}
