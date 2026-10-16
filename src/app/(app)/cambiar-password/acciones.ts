"use server";

import { redirect } from "next/navigation";
import type { Fallo } from "@/lib/resultado";
import { accion } from "@/server/accion";
import { cambiarPassword } from "@/server/auth/login";
import { exigirSesion } from "@/server/auth/sesion";

export async function cambiarPasswordAccion(_previo: Fallo | null, formData: FormData): Promise<Fallo | null> {
  const r = await accion(async () => {
    const sesion = await exigirSesion();
    await cambiarPassword(sesion, {
      actual: String(formData.get("actual") ?? ""),
      nueva: String(formData.get("nueva") ?? ""),
      confirmacion: String(formData.get("confirmacion") ?? ""),
    });
  });
  if (!r.ok) return r;
  redirect("/");
}
