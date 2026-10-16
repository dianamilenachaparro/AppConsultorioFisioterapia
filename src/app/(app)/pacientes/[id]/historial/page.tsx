import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DetalleAtencion, NotasAclaratorias } from "@/components/atenciones/detalle-atencion";
import { EvolucionDolor, type SerieDolor } from "@/components/graficas/evolucion-dolor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorDominio } from "@/lib/resultado";
import { fechaDeColumnaDate, formatearFecha, formatearFechaHora } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerHistorial } from "@/server/atenciones/historial";
import { DialogoVersiones } from "./dialogo-versiones";

export default async function HistorialPaciente({ params }: PageProps<"/pacientes/[id]/historial">) {
  const sesion = await paginaProtegida(["historial:ver_todos", "historial:ver_propios"]);
  const { id } = await params;
  let historial;
  try {
    historial = await obtenerHistorial(sesion, { pacienteId: id });
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === "SIN_PERMISO") redirect("/prohibido");
    if (e instanceof ErrorDominio && e.codigo === "NO_ENCONTRADO") notFound();
    if (e instanceof Error && e.name === "ZodError") notFound();
    throw e;
  }
  const { paciente, atenciones, serieDolor } = historial;
  const serie: SerieDolor = Object.fromEntries(
    Object.entries(serieDolor).map(([zona, puntos]) => [zona, puntos.map((p) => ({ t: p.fecha.getTime(), dolor: p.dolor }))]),
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Historial de {paciente.nombreCompleto}</h1>
        <p className="text-sm text-muted-foreground">
          Documento {paciente.documento} · Tel. {paciente.telefono} · Nacimiento{" "}
          {formatearFecha(fechaDeColumnaDate(paciente.fechaNacimiento))}
        </p>
        <Link href={`/pacientes/${paciente.id}`} className="text-sm underline-offset-4 hover:underline">
          Datos del paciente
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolución del dolor</CardTitle>
        </CardHeader>
        <CardContent>
          <EvolucionDolor serie={serie} />
        </CardContent>
      </Card>

      <section aria-label="Atenciones" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Atenciones ({atenciones.length})</h2>
        {atenciones.length === 0 && <p className="text-sm text-muted-foreground">Sin atenciones registradas.</p>}
        {atenciones.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row flex-wrap items-center gap-2">
              <CardTitle className="text-base">{formatearFechaHora(a.fecha)}</CardTitle>
              <span className="text-sm text-muted-foreground">{a.profesional}</span>
              {a.editada && <DialogoVersiones atencionId={a.id} />}
              {a.editable && (
                <Link href={`/citas/${a.citaId}/atencion`} className="ml-auto text-sm underline-offset-4 hover:underline">
                  Corregir
                </Link>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <DetalleAtencion atencion={a} />
              <NotasAclaratorias notas={a.notasAclaratorias} />
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
