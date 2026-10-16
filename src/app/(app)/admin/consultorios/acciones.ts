"use server";

import { revalidatePath } from "next/cache";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { cambiarEstadoConsultorio, crearConsultorio, editarConsultorio } from "@/server/consultorios/servicio";

export async function crearConsultorioAccion(nombre: string) {
  return accion(async () => {
    const r = await crearConsultorio(await exigirSesion(), { nombre });
    revalidatePath("/admin/consultorios");
    return r;
  });
}

export async function editarConsultorioAccion(id: string, datos: { nombre: string; orden: number }) {
  return accion(async () => {
    await editarConsultorio(await exigirSesion(), { id, ...datos });
    revalidatePath("/admin/consultorios");
  });
}

export async function cambiarEstadoConsultorioAccion(id: string, activo: boolean, confirmar: boolean) {
  return accion(async () => {
    await cambiarEstadoConsultorio(await exigirSesion(), { id, activo, confirmar });
    revalidatePath("/admin/consultorios");
  });
}
