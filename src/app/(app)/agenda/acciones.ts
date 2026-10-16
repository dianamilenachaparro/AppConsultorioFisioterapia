"use server";

import type { CrearCitaEntrada } from "@/lib/validacion/cita";
import type { PacienteEntrada } from "@/lib/validacion/paciente";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import { crearCita } from "@/server/citas/crear";
import { buscarPacientePorDocumento, crearPaciente } from "@/server/pacientes/servicio";

export async function buscarPacientePorDocumentoAccion(documento: string) {
  return accion(async () => buscarPacientePorDocumento(await exigirSesion(), documento));
}

export async function crearPacienteAccion(datos: PacienteEntrada) {
  return accion(async () => crearPaciente(await exigirSesion(), datos));
}

export async function crearCitaAccion(datos: CrearCitaEntrada) {
  return accion(async () => crearCita(await exigirSesion(), datos));
}
