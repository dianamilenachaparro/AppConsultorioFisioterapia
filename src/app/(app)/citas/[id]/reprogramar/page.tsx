import { redirect } from "next/navigation";
import { fechaBogota, horaBogota } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { citaParaPagina } from "@/server/citas/pagina";
import { listarConsultoriosActivos } from "@/server/consultorios/consulta";
import { listarProfesionalesAsignables } from "@/server/usuarios/profesionales";
import { FormularioReprogramar } from "./formulario";

export default async function Reprogramar({ params }: PageProps<"/citas/[id]/reprogramar">) {
  const sesion = await paginaProtegida("citas:gestionar");
  const { id } = await params;
  const cita = await citaParaPagina(sesion, id);
  if (cita.estado !== "PROGRAMADA") redirect(`/citas/${id}`);
  const [consultorios, profesionales] = await Promise.all([
    listarConsultoriosActivos(),
    listarProfesionalesAsignables(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Reprogramar cita</h1>
        <p className="text-sm text-muted-foreground">{cita.paciente.nombreCompleto}</p>
      </div>
      <FormularioReprogramar
        id={id}
        consultorios={consultorios}
        profesionales={profesionales}
        inicial={{
          consultorioId: cita.consultorio.id,
          profesionalId: cita.profesional.id,
          fecha: fechaBogota(cita.inicio),
          horaInicio: horaBogota(cita.inicio),
          duracionMin: cita.duracionMin,
        }}
      />
    </div>
  );
}
