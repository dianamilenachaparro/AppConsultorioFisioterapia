import "server-only";
import { ErrorDominio } from "@/lib/resultado";
import { auditar } from "@/server/auditoria/auditar";
import type { Sesion } from "@/server/auth/sesion";
import type { Tx } from "@/server/db";
import { veredictoAnulacion } from "./regla-anulacion";

export { puedeAnular } from "./regla-anulacion";

export const MENSAJE_FUERA_DE_VENTANA = "Solo puedes anular movimientos registrados hoy. Solicítalo al Dueño";

/** Bloquea el movimiento financiero y lo devuelve; `NO_ENCONTRADO` si no existe. */
export async function bloquearFinanciero(tx: Tx, id: string) {
  const filas = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM movimiento_financiero WHERE id = ${id}::uuid FOR UPDATE`;
  if (filas.length === 0) throw new ErrorDominio("NO_ENCONTRADO", "Movimiento no encontrado");
  return tx.movimientoFinanciero.findUniqueOrThrow({ where: { id } });
}

/** Aplica la regla de anulación y lanza el error que corresponda. */
export function exigirAnulable(
  sesion: Sesion,
  mov: Parameters<typeof veredictoAnulacion>[1] & { anulado: boolean },
  ahora: Date,
) {
  const v = veredictoAnulacion(sesion, mov, ahora);
  if (v === "SIN_PERMISO") throw new ErrorDominio("SIN_PERMISO");
  if (v === "FUERA_DE_VENTANA") throw new ErrorDominio("FUERA_DE_VENTANA", MENSAJE_FUERA_DE_VENTANA);
  if (mov.anulado) throw new ErrorDominio("ESTADO_INVALIDO", "El movimiento ya está anulado");
}

/** Anula un movimiento financiero sin inventario enlazado (cobros, egresos), dentro de `tx`. */
export async function anularFinancieroEnTx(tx: Tx, sesion: Sesion, id: string, motivo: string, ahora: Date) {
  const mov = await bloquearFinanciero(tx, id);
  if (mov.movimientoInventarioId) {
    throw new ErrorDominio("ESTADO_INVALIDO", "Este movimiento se anula desde su movimiento de inventario");
  }
  exigirAnulable(sesion, mov, ahora);
  await tx.movimientoFinanciero.update({
    where: { id },
    data: { anulado: true, anuladoPorId: sesion.usuarioId, anuladoEn: ahora, motivoAnulacion: motivo },
  });
  await auditar(tx, {
    usuarioId: sesion.usuarioId,
    accion: "MOVIMIENTO_ANULAR",
    entidad: "movimiento_financiero",
    entidadId: id,
    antes: { anulado: false },
    despues: { anulado: true },
    motivo,
  });
}
