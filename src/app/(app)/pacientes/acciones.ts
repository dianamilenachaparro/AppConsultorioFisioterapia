"use server";

import { revalidatePath } from "next/cache";
import type { PacienteEntrada } from "@/lib/validacion/paciente";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { crearPaciente, editarPaciente } from "@/server/pacientes/servicio";

export async function crearPacienteAccion(datos: PacienteEntrada) {
  return accion(async () => crearPaciente(await exigirSesion(), datos));
}

export async function editarPacienteAccion(id: string, datos: Partial<PacienteEntrada>) {
  return accion(async () => {
    const r = await editarPaciente(await exigirSesion(), { id, ...datos });
    revalidatePath(`/pacientes/${id}`);
    return r;
  });
}
