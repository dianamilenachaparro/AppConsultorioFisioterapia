import "server-only";
import { z } from "zod";
import type { Marcacion } from "@/generated/prisma/client";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { esMismoDiaBogota, fechaBogota, rangoDia } from "@/lib/tiempo";
import { motivo, uuid } from "@/lib/validacion/comunes";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma, type Tx } from "@/server/db";
import { bloquearCita } from "@/server/citas/estados";

export type Marca = "LLEGADA" | "INGRESO" | "FIN";

export type TiemposMarcacion = { llegadaEn: Date | null; ingresoEn: Date | null; finEn: Date | null };

/** La siguiente marca que falta, en orden llegada → ingreso → fin. */
export function siguienteMarca(m: TiemposMarcacion | null): Marca | null {
  if (!m?.llegadaEn) return "LLEGADA";
  if (!m.ingresoEn) return "INGRESO";
  if (!m.finEn) return "FIN";
  return null;
}

const NOMBRE_MARCA: Record<Marca, string> = { LLEGADA: "la llegada", INGRESO: "el ingreso", FIN: "el fin" };

function tiempos(m: Pick<Marcacion, "llegadaEn" | "ingresoEn" | "finEn"> | null): TiemposMarcacion {
  return { llegadaEn: m?.llegadaEn ?? null, ingresoEn: m?.ingresoEn ?? null, finEn: m?.finEn ?? null };
}

/**
 * Registra una marca con la hora del servidor: solo el profesional asignado, solo citas
 * de hoy (Bogotá) no canceladas, cada marca una vez y en orden. El ingreso deja la cita
 * ASISTIDA en la misma transacción (FR-028, FR-029).
 */
async function marcar(sesion: Sesion, citaId: string, marca: Marca, ahora = new Date()) {
  exigirPermiso(sesion, "marcaciones:registrar");
  const id = uuid.parse(citaId);
  try {
    return await prisma.$transaction(async (tx) => {
      const cita = await bloquearCita(tx, id);
      if (cita.profesionalId !== sesion.usuarioId) throw new ErrorDominio("SIN_PERMISO");
      if (cita.estado === "CANCELADA") throw new ErrorDominio("ESTADO_INVALIDO", "La cita está cancelada");
      if (!esMismoDiaBogota(cita.inicio, ahora)) {
        throw new ErrorDominio("ESTADO_INVALIDO", "Solo se marcan tiempos de las citas de hoy");
      }
      const actual = await tx.marcacion.findUnique({ where: { citaId: id } });
      const siguiente = siguienteMarca(actual);
      if (siguiente !== marca) {
        throw new ErrorDominio(
          "ESTADO_INVALIDO",
          siguiente ? `Primero marca ${NOMBRE_MARCA[siguiente]}` : "La cita ya tiene todos los tiempos marcados",
        );
      }
      const datos =
        marca === "LLEGADA"
          ? { llegadaEn: ahora, llegadaPorId: sesion.usuarioId }
          : marca === "INGRESO"
            ? { ingresoEn: ahora, ingresoPorId: sesion.usuarioId }
            : { finEn: ahora, finPorId: sesion.usuarioId };
      // Sin upsert: PostgreSQL valida el CHECK de orden sobre la fila del INSERT propuesto,
      // y un ingreso suelto lo violaría aunque terminara siendo un UPDATE.
      const marcacion = actual
        ? await tx.marcacion.update({ where: { citaId: id }, data: datos })
        : await tx.marcacion.create({ data: { citaId: id, ...datos } });
      if (marca === "INGRESO" && cita.estado === "PROGRAMADA") {
        await tx.cita.update({ where: { id }, data: { estado: "ASISTIDA", actualizadoPorId: sesion.usuarioId } });
      }
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "MARCACION_REGISTRAR",
        entidad: "marcacion",
        entidadId: id,
        despues: { marca, hora: ahora },
      });
      return { marcacion: tiempos(marcacion), siguiente: siguienteMarca(marcacion) };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

export const marcarLlegada = (sesion: Sesion, { citaId }: { citaId: string }, ahora?: Date) =>
  marcar(sesion, citaId, "LLEGADA", ahora);
export const marcarIngreso = (sesion: Sesion, { citaId }: { citaId: string }, ahora?: Date) =>
  marcar(sesion, citaId, "INGRESO", ahora);
export const marcarFin = (sesion: Sesion, { citaId }: { citaId: string }, ahora?: Date) =>
  marcar(sesion, citaId, "FIN", ahora);

const instanteOpcional = z.coerce.date({ error: "Hora inválida" }).nullable().optional();

export const corregirMarcacionSchema = z.object({
  citaId: uuid,
  llegadaEn: instanteOpcional,
  ingresoEn: instanteOpcional,
  finEn: instanteOpcional,
  motivo,
});

/**
 * Solo el Dueño: fija cualquier marca (o la borra con `null`) respetando el orden;
 * los campos omitidos no cambian. Audita antes/después con el motivo (FR-030).
 */
export async function corregirMarcacion(sesion: Sesion, entrada: z.input<typeof corregirMarcacionSchema>) {
  exigirPermiso(sesion, "marcaciones:corregir");
  const { citaId, motivo: razon, ...cambios } = corregirMarcacionSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx: Tx) => {
      const cita = await bloquearCita(tx, citaId);
      if (cita.estado === "CANCELADA") throw new ErrorDominio("ESTADO_INVALIDO", "La cita está cancelada");
      const fila = await tx.marcacion.findUnique({ where: { citaId } });
      const actual = tiempos(fila);
      const nuevo: TiemposMarcacion = {
        llegadaEn: cambios.llegadaEn === undefined ? actual.llegadaEn : cambios.llegadaEn,
        ingresoEn: cambios.ingresoEn === undefined ? actual.ingresoEn : cambios.ingresoEn,
        finEn: cambios.finEn === undefined ? actual.finEn : cambios.finEn,
      };
      validarOrden(nuevo);
      const porQuien = (antes: Date | null, despues: Date | null) =>
        antes?.getTime() === despues?.getTime() ? undefined : despues ? sesion.usuarioId : null;
      const quien = {
        llegadaPorId: porQuien(actual.llegadaEn, nuevo.llegadaEn),
        ingresoPorId: porQuien(actual.ingresoEn, nuevo.ingresoEn),
        finPorId: porQuien(actual.finEn, nuevo.finEn),
      };
      if (fila) await tx.marcacion.update({ where: { citaId }, data: { ...nuevo, ...quien } });
      else await tx.marcacion.create({ data: { citaId, ...nuevo, ...quien } });
      if (nuevo.ingresoEn && cita.estado === "PROGRAMADA") {
        await tx.cita.update({ where: { id: citaId }, data: { estado: "ASISTIDA", actualizadoPorId: sesion.usuarioId } });
      }
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "MARCACION_CORREGIR",
        entidad: "marcacion",
        entidadId: citaId,
        antes: actual,
        despues: nuevo,
        motivo: razon,
      });
      return { marcacion: nuevo, siguiente: siguienteMarca(nuevo) };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

function validarOrden(t: TiemposMarcacion) {
  const error = (mensaje: string) => new ErrorDominio("VALIDACION", mensaje);
  if (t.ingresoEn && !t.llegadaEn) throw error("El ingreso requiere una hora de llegada");
  if (t.finEn && !t.ingresoEn) throw error("El fin requiere una hora de ingreso");
  if (t.ingresoEn && t.llegadaEn && t.ingresoEn < t.llegadaEn) throw error("El ingreso no puede ser antes de la llegada");
  if (t.finEn && t.ingresoEn && t.finEn < t.ingresoEn) throw error("El fin no puede ser antes del ingreso");
}

/** Citas de hoy del profesional en sesión, en todos los consultorios, con sus tiempos. */
export async function obtenerMiDia(sesion: Sesion, ahora = new Date()) {
  exigirPermiso(sesion, "marcaciones:registrar");
  const { desde, hasta } = rangoDia(fechaBogota(ahora));
  const citas = await prisma.cita.findMany({
    where: { profesionalId: sesion.usuarioId, inicio: { gte: desde, lt: hasta }, estado: { not: "CANCELADA" } },
    orderBy: { inicio: "asc" },
    select: {
      id: true,
      inicio: true,
      fin: true,
      estado: true,
      motivo: true,
      paciente: { select: { nombreCompleto: true } },
      consultorio: { select: { nombre: true } },
      marcacion: { select: { llegadaEn: true, ingresoEn: true, finEn: true } },
      atencion: { select: { id: true } },
    },
  });
  return citas.map(({ marcacion, atencion, ...c }) => ({ ...c, tiempos: tiempos(marcacion), tieneAtencion: !!atencion }));
}

/** Tiempos de una cita para su detalle. */
export async function obtenerMarcacion(citaId: string) {
  return tiempos(await prisma.marcacion.findUnique({ where: { citaId: uuid.parse(citaId) } }));
}
