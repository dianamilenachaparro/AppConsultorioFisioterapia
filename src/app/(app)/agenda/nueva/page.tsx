import { FormCita } from "@/components/formularios/form-cita";
import { BLOQUES, hoyBogota } from "@/lib/tiempo";
import { fechaISO } from "@/lib/validacion/comunes";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarConsultoriosActivos } from "@/server/consultorios/consulta";
import { listarProfesionalesAsignables } from "@/server/usuarios/profesionales";

export default async function NuevaCita({ searchParams }: PageProps<"/agenda/nueva">) {
  await paginaProtegida("citas:gestionar");
  const params = await searchParams;
  const [consultorios, profesionales] = await Promise.all([
    listarConsultoriosActivos(),
    listarProfesionalesAsignables(),
  ]);
  const consultorioId =
    consultorios.find((c) => c.id === params.consultorio)?.id ?? consultorios[0]?.id ?? "";
  const fecha = fechaISO.safeParse(params.fecha).success ? (params.fecha as string) : hoyBogota();
  const hora = BLOQUES.includes(params.hora as string) ? (params.hora as string) : BLOQUES[0];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Nueva cita</h1>
      <FormCita
        consultorios={consultorios}
        profesionales={profesionales}
        inicial={{
          consultorioId,
          profesionalId: profesionales.length === 1 ? profesionales[0].id : "",
          fecha,
          horaInicio: hora,
          duracionMin: 30,
        }}
      />
    </div>
  );
}
