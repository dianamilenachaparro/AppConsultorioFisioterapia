"use server";

import { revalidatePath } from "next/cache";
import type { FiltroFinanzas } from "@/lib/validacion/finanzas";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { anularMovimientoFinanciero } from "@/server/finanzas/anular";
import { exportarFinanzasAGoogle } from "@/server/google/exportar";

export async function anularMovimientoAccion(id: string, motivo: string) {
  return accion(async () => {
    await anularMovimientoFinanciero(await exigirSesion(), { id, motivo });
    revalidatePath("/finanzas");
  });
}

/** Recibe el mismo filtro que la pantalla, para que la hoja coincida con lo que se ve (SC-008). */
export async function exportarAccion(filtro: FiltroFinanzas) {
  return accion(async () => exportarFinanzasAGoogle(await exigirSesion(), filtro));
}
