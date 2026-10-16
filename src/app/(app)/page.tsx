import { redirect } from "next/navigation";
import { paginaProtegida } from "@/server/auth/paginas";

export default async function Inicio() {
  const sesion = await paginaProtegida();
  redirect(sesion.rol === "PROFESIONAL" ? "/mi-dia" : "/agenda");
}
