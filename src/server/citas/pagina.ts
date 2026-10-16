import "server-only";
import { notFound, redirect } from "next/navigation";
import { ErrorDominio } from "@/lib/resultado";
import type { Sesion } from "@/server/auth/sesion";
import { obtenerCita } from "./listar";

/** Para páginas: carga la cita o redirige a 404 / prohibido. */
export async function citaParaPagina(sesion: Sesion, id: string) {
  try {
    return await obtenerCita(sesion, id);
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === "SIN_PERMISO") redirect("/prohibido");
    if (e instanceof ErrorDominio && e.codigo === "NO_ENCONTRADO") notFound();
    throw e;
  }
}
