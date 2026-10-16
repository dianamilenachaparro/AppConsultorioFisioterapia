import "server-only";
import { z } from "zod";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { motivo, uuid } from "@/lib/validacion/comunes";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma, type Tx } from "@/server/db";

/** Bloquea la fila de la cita para el resto de la transacción. */
export async function bloquearCita(tx: Tx, id: string) {
  const filas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM cita WHERE id = ${id}::uuid FOR UPDATE`;
  if (filas.length === 0) throw new ErrorDominio("NO_ENCONTRADO", "Cita no encontrada");
  return tx.cita.findUniqueOrThrow({ where: { id } });
}

/**
 * Reglas adicionales para revertir una cita a PROGRAMADA. US4 agrega "sin atención
 * registrada" y US8 "sin cobros vigentes".
 */
async function validarReversion(tx: Tx, citaId: string) {
  const atencion = await tx.atencion.findUnique({ where: { citaId }, select: { id: true } });
  if (atencion) throw new ErrorDominio("ESTADO_INVALIDO", "La cita tiene una atención registrada");
  const cobros = await tx.movimientoFinanciero.count({ where: { citaId, subtipoIngreso: "TERAPIA", anulado: false } });
  if (cobros > 0) throw new ErrorDominio("ESTADO_INVALIDO", "La cita tiene cobros registrados");
}

export async function marcarAsistida(sesion: Sesion, entrada: { id: string }) {
  exigirPermiso(sesion, "citas:gestionar");
  const { id } = z.object({ id: uuid }).parse(entrada);
  return prisma.$transaction(async (tx) => {
    const cita = await bloquearCita(tx, id);
    if (cita.estado !== "PROGRAMADA") throw new ErrorDominio("ESTADO_INVALIDO", "Solo una cita Programada se puede marcar como asistida");
    await tx.cita.update({ where: { id }, data: { estado: "ASISTIDA", actualizadoPorId: sesion.usuarioId } });
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "CITA_MARCAR_ASISTIDA",
      entidad: "cita",
      entidadId: id,
      antes: { estado: cita.estado },
      despues: { estado: "ASISTIDA" },
    });
  });
}

export const cancelarSchema = z.object({
  id: uuid,
  observacion: z.string().trim().min(5, "La observación es obligatoria (mínimo 5 caracteres)").max(500),
});

/** Cancela con observación obligatoria; el EXCLUDE ignora canceladas, así que libera los bloques (FR-020). */
export async function cancelarCita(sesion: Sesion, entrada: z.input<typeof cancelarSchema>) {
  exigirPermiso(sesion, "citas:gestionar");
  const { id, observacion } = cancelarSchema.parse(entrada);
  return prisma.$transaction(async (tx) => {
    const cita = await bloquearCita(tx, id);
    if (cita.estado !== "PROGRAMADA") throw new ErrorDominio("ESTADO_INVALIDO", "Solo una cita Programada se puede cancelar");
    const ahora = new Date();
    await tx.cita.update({
      where: { id },
      data: {
        estado: "CANCELADA",
        observacionCancelacion: observacion,
        canceladaPorId: sesion.usuarioId,
        canceladaEn: ahora,
        actualizadoPorId: sesion.usuarioId,
      },
    });
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "CITA_CANCELAR",
      entidad: "cita",
      entidadId: id,
      antes: { estado: cita.estado },
      despues: { estado: "CANCELADA", observacionCancelacion: observacion },
      motivo: observacion,
    });
  });
}

export const revertirSchema = z.object({ id: uuid, motivo });

/** Solo el Dueño: ASISTIDA/CANCELADA → PROGRAMADA. Las restricciones EXCLUDE re-validan choques. */
export async function revertirEstadoCita(sesion: Sesion, entrada: z.input<typeof revertirSchema>) {
  exigirPermiso(sesion, "citas:revertir_estado");
  const datos = revertirSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const cita = await bloquearCita(tx, datos.id);
      if (cita.estado === "PROGRAMADA") throw new ErrorDominio("ESTADO_INVALIDO", "La cita ya está Programada");
      await validarReversion(tx, cita.id);
      await tx.cita.update({
        where: { id: cita.id },
        data: {
          estado: "PROGRAMADA",
          observacionCancelacion: null,
          canceladaPorId: null,
          canceladaEn: null,
          actualizadoPorId: sesion.usuarioId,
        },
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "CITA_REVERTIR_ESTADO",
        entidad: "cita",
        entidadId: cita.id,
        antes: { estado: cita.estado, observacionCancelacion: cita.observacionCancelacion },
        despues: { estado: "PROGRAMADA", observacionCancelacion: null },
        motivo: datos.motivo,
      });
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}
