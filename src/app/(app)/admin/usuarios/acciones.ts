"use server";

import { revalidatePath } from "next/cache";
import type { CrearUsuarioEntrada } from "@/lib/validacion/admin";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { cambiarEstadoUsuario, crearUsuario, editarUsuario, restablecerPassword } from "@/server/usuarios/servicio";

export async function crearUsuarioAccion(datos: CrearUsuarioEntrada) {
  return accion(async () => {
    const u = await crearUsuario(await exigirSesion(), datos);
    revalidatePath("/admin/usuarios");
    return { id: u.id };
  });
}

export async function editarUsuarioAccion(datos: {
  id: string;
  nombreCompleto: string;
  rol: CrearUsuarioEntrada["rol"];
  atiendePacientes: boolean;
}) {
  return accion(async () => {
    await editarUsuario(await exigirSesion(), datos);
    revalidatePath("/admin/usuarios");
  });
}

export async function cambiarEstadoUsuarioAccion(id: string, activo: boolean, confirmar: boolean) {
  return accion(async () => {
    await cambiarEstadoUsuario(await exigirSesion(), { id, activo, confirmar });
    revalidatePath("/admin/usuarios");
  });
}

export async function restablecerPasswordAccion(id: string, passwordNueva: string) {
  return accion(async () => {
    await restablecerPassword(await exigirSesion(), { id, passwordNueva });
  });
}
