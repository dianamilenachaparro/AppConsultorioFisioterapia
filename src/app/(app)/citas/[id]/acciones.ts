"use server";

import { revalidatePath } from "next/cache";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { cancelarCita, marcarAsistida, revertirEstadoCita } from "@/server/citas/estados";
import { reprogramarCita } from "@/server/citas/reprogramar";

export async function marcarAsistidaAccion(id: string) {
  return accion(async () => {
    await marcarAsistida(await exigirSesion(), { id });
    revalidatePath(`/citas/${id}`);
  });
}

export async function cancelarCitaAccion(id: string, observacion: string) {
  return accion(async () => {
    await cancelarCita(await exigirSesion(), { id, observacion });
    revalidatePath(`/citas/${id}`);
  });
}

export async function revertirEstadoAccion(id: string, motivo: string) {
  return accion(async () => {
    await revertirEstadoCita(await exigirSesion(), { id, motivo });
    revalidatePath(`/citas/${id}`);
  });
}

export async function reprogramarCitaAccion(datos: {
  id: string;
  consultorioId: string;
  profesionalId: string;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
}) {
  return accion(async () => {
    const r = await reprogramarCita(await exigirSesion(), datos);
    revalidatePath(`/citas/${datos.id}`);
    return r;
  });
}
