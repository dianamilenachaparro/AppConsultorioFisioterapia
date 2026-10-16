"use server";

import { redirect } from "next/navigation";
import { aFallo, type Fallo } from "@/lib/resultado";
import { registrarError } from "@/lib/log";
import { iniciarSesion } from "@/server/auth/login";

export type EstadoLogin = Fallo | null;

/** Solo rutas internas: evita redirecciones abiertas a otros sitios. */
function destinoSeguro(valor: FormDataEntryValue | null) {
  const s = typeof valor === "string" ? valor : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/login") ? s : "/";
}

export async function iniciarSesionAccion(_previo: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  let resultado: { debeCambiarPassword: boolean };
  try {
    resultado = await iniciarSesion({
      cedula: String(formData.get("cedula") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  } catch (e) {
    const f = aFallo(e);
    if (f.error === "ERROR_INTERNO") registrarError("login", e);
    return f;
  }
  redirect(resultado.debeCambiarPassword ? "/cambiar-password" : destinoSeguro(formData.get("siguiente")));
}
