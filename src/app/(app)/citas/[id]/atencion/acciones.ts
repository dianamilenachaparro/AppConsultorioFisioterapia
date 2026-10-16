"use server";

import { revalidatePath } from "next/cache";
import type { CamposAtencion } from "@/lib/validacion/atencion";
import { accion } from "@/server/accion";
import { agregarNotaAclaratoria, editarAtencion, registrarAtencion } from "@/server/atenciones/servicio";
import { exigirSesion } from "@/server/auth/sesion";

export async function registrarAtencionAccion(citaId: string, campos: CamposAtencion) {
  return accion(async () => {
    const r = await registrarAtencion(await exigirSesion(), { citaId, ...campos });
    revalidatePath(`/citas/${citaId}`);
    return r;
  });
}

export async function editarAtencionAccion(citaId: string, id: string, campos: CamposAtencion) {
  return accion(async () => {
    const r = await editarAtencion(await exigirSesion(), { id, ...campos });
    revalidatePath(`/citas/${citaId}/atencion`);
    return r;
  });
}

export async function agregarNotaAccion(citaId: string, atencionId: string, texto: string) {
  return accion(async () => {
    const r = await agregarNotaAclaratoria(await exigirSesion(), { atencionId, texto });
    revalidatePath(`/citas/${citaId}/atencion`);
    return r;
  });
}
