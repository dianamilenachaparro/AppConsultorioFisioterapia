import "server-only";
import type { z } from "zod";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { columnaDateDeFecha, fechaBogota, fechaDeColumnaDate, hoyBogota } from "@/lib/tiempo";
import { uuid } from "@/lib/validacion/comunes";
import { cobroSchema } from "@/lib/validacion/finanzas";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma, type Tx } from "@/server/db";

/** La cita existe y, si es Profesional, es suya (FR-037). */
async function citaParaCobro(db: Tx | typeof prisma, sesion: Sesion, citaId: string) {
  const cita = await db.cita.findUnique({
    where: { id: citaId },
    select: { id: true, estado: true, inicio: true, profesionalId: true, paciente: { select: { nombreCompleto: true } } },
  });
  if (!cita) throw new ErrorDominio("NO_ENCONTRADO", "Cita no encontrada");
  if (sesion.rol === "PROFESIONAL" && cita.profesionalId !== sesion.usuarioId) throw new ErrorDominio("SIN_PERMISO");
  return cita;
}

/** Cobros previos de la cita y su suma vigente, para evitar dobles registros. */
export async function obtenerCobrosCita(sesion: Sesion, { citaId }: { citaId: string }) {
  exigirPermiso(sesion, "cobro:registrar");
  const id = uuid.parse(citaId);
  await citaParaCobro(prisma, sesion, id);
  const filas = await prisma.movimientoFinanciero.findMany({
    where: { citaId: id, subtipoIngreso: "TERAPIA" },
    orderBy: { creadoEn: "asc" },
    select: { id: true, valor: true, medioPago: true, fecha: true, anulado: true },
  });
  const cobros = filas.map((c) => ({ ...c, fecha: fechaDeColumnaDate(c.fecha) }));
  return { cobros, sumaVigente: cobros.filter((c) => !c.anulado).reduce((s, c) => s + c.valor, 0) };
}

/**
 * Registra un cobro (abono) de terapia en una cita ASISTIDA; una cita admite varios.
 * Recepcionista y Profesional solo reciben la confirmación, no totales.
 */
export async function registrarCobroTerapia(sesion: Sesion, entrada: z.input<typeof cobroSchema>, ahora = new Date()) {
  exigirPermiso(sesion, "cobro:registrar");
  const d = cobroSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      // Bloquea la cita para que no se revierta mientras se cobra.
      await tx.$queryRaw`SELECT id FROM cita WHERE id = ${d.citaId}::uuid FOR UPDATE`;
      const cita = await citaParaCobro(tx, sesion, d.citaId);
      if (cita.estado !== "ASISTIDA") {
        throw new ErrorDominio("ESTADO_INVALIDO", "Solo se cobran citas marcadas como Asistidas");
      }
      const mov = await tx.movimientoFinanciero.create({
        data: {
          tipo: "INGRESO",
          subtipoIngreso: "TERAPIA",
          fecha: columnaDateDeFecha(d.fecha ?? hoyBogota(ahora)),
          valor: d.valor,
          medioPago: d.medioPago,
          descripcion: `Terapia – ${cita.paciente.nombreCompleto} – ${fechaBogota(cita.inicio)}`,
          citaId: cita.id,
          creadoPorId: sesion.usuarioId,
        },
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "COBRO_CREAR",
        entidad: "movimiento_financiero",
        entidadId: mov.id,
        despues: { citaId: cita.id, valor: d.valor, medioPago: d.medioPago },
      });
      return { id: mov.id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}
