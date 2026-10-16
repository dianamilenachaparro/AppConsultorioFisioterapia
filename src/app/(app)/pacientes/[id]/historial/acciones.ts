"use server";

import { accion } from "@/server/accion";
import { obtenerVersionesAtencion } from "@/server/atenciones/servicio";
import { exigirSesion } from "@/server/auth/sesion";

export async function obtenerVersionesAccion(atencionId: string) {
  return accion(async () => obtenerVersionesAtencion(await exigirSesion(), atencionId));
}
