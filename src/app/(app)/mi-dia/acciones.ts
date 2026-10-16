"use server";

import { revalidatePath } from "next/cache";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { marcarFin, marcarIngreso, marcarLlegada, type Marca } from "@/server/marcaciones/servicio";

const MARCAR = { LLEGADA: marcarLlegada, INGRESO: marcarIngreso, FIN: marcarFin } as const;

export async function marcarAccion(citaId: string, marca: Marca) {
  return accion(async () => {
    const r = await MARCAR[marca](await exigirSesion(), { citaId });
    revalidatePath("/mi-dia");
    return r;
  });
}
