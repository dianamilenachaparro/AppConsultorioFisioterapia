import "server-only";
import type { z } from "zod";
import { hoyBogota, rangoDia } from "@/lib/tiempo";
import { anulacionSchema } from "@/lib/validacion/inventario";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { anularMovimientoFinanciero } from "./anular";
import { puedeAnular } from "./regla-anulacion";

/**
 * Movimientos financieros que registré hoy (Bogotá), sin totales ni sumas (FR-041):
 * la Recepcionista y el Profesional no ven el agregado del día.
 */
export async function listarMisMovimientosHoy(sesion: Sesion, ahora = new Date()) {
  exigirPermiso(sesion, "movimientos:ver_propios_hoy");
  const { desde, hasta } = rangoDia(hoyBogota(ahora));
  const movs = await prisma.movimientoFinanciero.findMany({
    where: { creadoPorId: sesion.usuarioId, creadoEn: { gte: desde, lt: hasta } },
    orderBy: { creadoEn: "desc" },
  });
  return movs.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    subtipo: m.subtipoIngreso,
    descripcion: m.descripcion,
    valor: m.valor,
    medioPago: m.medioPago,
    creadoEn: m.creadoEn,
    anulado: m.anulado,
    motivoAnulacion: m.motivoAnulacion,
    anulable: !m.anulado && puedeAnular(sesion, m, ahora),
  }));
}

/** Anula un movimiento propio: si viene de una venta, revierte también el stock. */
export function anularMiMovimiento(sesion: Sesion, entrada: z.input<typeof anulacionSchema>, ahora = new Date()) {
  return anularMovimientoFinanciero(sesion, entrada, ahora);
}
