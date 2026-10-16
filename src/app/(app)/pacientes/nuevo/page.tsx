import { paginaProtegida } from "@/server/auth/paginas";
import { FormularioPaciente } from "../formulario-paciente";

export default async function NuevoPaciente() {
  await paginaProtegida("pacientes:gestionar");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Registrar paciente</h1>
      <FormularioPaciente />
    </div>
  );
}
