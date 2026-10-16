"use server";

import { revalidatePath } from "next/cache";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { registrarEgreso } from "@/server/finanzas/egresos";

export async function registrarEgresoAccion(datos: {
  categoriaId: string;
  fecha: string;
  valor: string;
  medioPago: "EFECTIVO" | "TRANSFERENCIA";
  descripcion: string;
}) {
  return accion(async () => {
    const r = await registrarEgreso(await exigirSesion(), datos);
    revalidatePath("/finanzas");
    return r;
  });
}
