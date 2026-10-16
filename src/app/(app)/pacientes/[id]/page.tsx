import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { puede } from "@/lib/permisos";
import { ErrorDominio } from "@/lib/resultado";
import { formatearFecha } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerPaciente } from "@/server/pacientes/servicio";
import { FormularioPaciente } from "../formulario-paciente";

export default async function DetallePaciente({ params }: PageProps<"/pacientes/[id]">) {
  const sesion = await paginaProtegida(["pacientes:gestionar", "pacientes:consultar_propios"]);
  const { id } = await params;
  let paciente;
  try {
    paciente = await obtenerPaciente(sesion, id);
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === "SIN_PERMISO") redirect("/prohibido");
    if (e instanceof ErrorDominio && e.codigo === "NO_ENCONTRADO") notFound();
    throw e;
  }
  const editable = puede(sesion.rol, "pacientes:gestionar");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{paciente.nombreCompleto}</h1>
        <Button asChild variant="outline">
          <Link href={`/pacientes/${id}/historial`}>Ver historial</Link>
        </Button>
      </div>
      {editable ? (
        <FormularioPaciente paciente={paciente} puedeCambiarDocumento={sesion.rol === "DUENO"} />
      ) : (
        <Card>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>Documento: {paciente.documento}</p>
            <p>Teléfono: {paciente.telefono}</p>
            <p>Nacimiento: {formatearFecha(paciente.fechaNacimiento)}</p>
            <p>
              {paciente.direccion}, {paciente.barrio}, {paciente.ciudad} ({paciente.departamento})
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
