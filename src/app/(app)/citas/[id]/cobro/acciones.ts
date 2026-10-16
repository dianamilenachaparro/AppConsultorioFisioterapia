"use server";

import { revalidatePath } from "next/cache";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { registrarCobroTerapia } from "@/server/finanzas/cobros";

export async function registrarCobroAccion(datos: {
  citaId: string;
  valor: string;
  medioPago: "EFECTIVO" | "TRANSFERENCIA";
}) {
  return accion(async () => {
    const r = await registrarCobroTerapia(await exigirSesion(), datos);
    revalidatePath(`/citas/${datos.citaId}/cobro`);
    return r;
  });
}
