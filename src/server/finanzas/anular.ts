import "server-only";
import type { z } from "zod";
import { traducirErrorBD } from "@/lib/resultado";
import { anulacionSchema } from "@/lib/validacion/inventario";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { anularMovimientoInventario } from "@/server/inventario/servicio";
import { anularFinancieroEnTx } from "./anulacion";

/**
 * Anula cualquier movimiento financiero aplicando la regla de anulación (FR-044). Si viene
 * de una venta o reposición, delega en el inventario para revertir también el stock.
 */
export async function anularMovimientoFinanciero(
  sesion: Sesion,
  entrada: z.input<typeof anulacionSchema>,
  ahora = new Date(),
) {
  exigirPermiso(sesion, ["movimientos:anular_propios_hoy", "movimientos:anular_todos"]);
  const { id, motivo } = anulacionSchema.parse(entrada);
  const mov = await prisma.movimientoFinanciero.findUnique({ where: { id }, select: { movimientoInventarioId: true } });
  if (mov?.movimientoInventarioId) {
    return anularMovimientoInventario(sesion, { id: mov.movimientoInventarioId, motivo }, ahora);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      await anularFinancieroEnTx(tx, sesion, id, motivo, ahora);
      return { id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}
