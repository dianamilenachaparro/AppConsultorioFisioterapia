"use server";

import { revalidatePath } from "next/cache";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { anularMiMovimiento } from "@/server/finanzas/mis-movimientos";

export async function anularMiMovimientoAccion(id: string, motivo: string) {
  return accion(async () => {
    await anularMiMovimiento(await exigirSesion(), { id, motivo });
    revalidatePath("/mis-movimientos");
  });
}
