"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { instanteBogota } from "@/lib/tiempo";
import { fechaISO } from "@/lib/validacion/comunes";
import { corregirMarcacion } from "@/server/marcaciones/servicio";
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

const horaMarca = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^$/, "Hora inválida");

/** Horas `HH:MM` del día de la cita; vacío borra esa marca. */
export async function corregirMarcacionAccion(
  id: string,
  fecha: string,
  horas: { llegada: string; ingreso: string; fin: string },
  motivo: string,
) {
  return accion(async () => {
    const dia = fechaISO.parse(fecha);
    const instante = (h: string) => (horaMarca.parse(h) ? instanteBogota(dia, h) : null);
    await corregirMarcacion(await exigirSesion(), {
      citaId: id,
      llegadaEn: instante(horas.llegada),
      ingresoEn: instante(horas.ingreso),
      finEn: instante(horas.fin),
      motivo,
    });
    revalidatePath(`/citas/${id}`);
  });
}
