import Link from "next/link";
import { DetalleAtencion, NotasAclaratorias } from "@/components/atenciones/detalle-atencion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaBogota, formatearFechaLarga, formatearHora } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerAtencionDeCita } from "@/server/atenciones/servicio";
import { citaParaPagina } from "@/server/citas/pagina";
import { FormularioAtencion } from "./formulario-atencion";
import { FormularioNota } from "./formulario-nota";

export default async function AtencionCita({ params }: PageProps<"/citas/[id]/atencion">) {
  const sesion = await paginaProtegida("atenciones:registrar");
  const { id } = await params;
  const cita = await citaParaPagina(sesion, id);
  const atencion = await obtenerAtencionDeCita(sesion, id);

  const notas =
    atencion?.notasAclaratorias.map((n) => ({
      id: n.id,
      texto: n.texto,
      autor: n.creadoPor.nombreCompleto,
      creadoEn: n.creadoEn,
    })) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Atención</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {cita.paciente.nombreCompleto} · {formatearFechaLarga(fechaBogota(cita.inicio))} ·{" "}
          {formatearHora(cita.inicio)}
        </p>
      </div>

      {!atencion && cita.estado !== "ASISTIDA" ? (
        <Card>
          <CardContent className="text-sm">
            La atención se registra cuando la cita está marcada como <strong>Asistida</strong>.
          </CardContent>
        </Card>
      ) : !atencion ? (
        <Card>
          <CardContent>
            <FormularioAtencion
              citaId={id}
              inicial={{ zonaCorporal: cita.zonaCorporal, motivo: cita.motivo, tecnica: "", dolor: null, notasEvolucion: "" }}
            />
          </CardContent>
        </Card>
      ) : atencion.editable ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Corregir atención</CardTitle>
            <p className="text-sm text-muted-foreground">
              Puedes corregirla hasta el final de hoy. Después solo se podrán agregar notas aclaratorias.
            </p>
          </CardHeader>
          <CardContent>
            <FormularioAtencion
              citaId={id}
              atencionId={atencion.id}
              inicial={{
                zonaCorporal: atencion.zonaCorporal,
                motivo: atencion.motivo,
                tecnica: atencion.tecnica,
                dolor: atencion.dolor,
                notasEvolucion: atencion.notasEvolucion,
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <DetalleAtencion atencion={atencion} />
          </CardContent>
        </Card>
      )}

      {atencion && (
        <>
          <NotasAclaratorias notas={notas} />
          {atencion.puedeAgregarNota && <FormularioNota citaId={id} atencionId={atencion.id} />}
        </>
      )}

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href={`/citas/${id}`} className="underline-offset-4 hover:underline">
          Volver a la cita
        </Link>
        <Link href={`/pacientes/${cita.paciente.id}/historial`} className="underline-offset-4 hover:underline">
          Ver historial del paciente
        </Link>
      </div>
    </div>
  );
}
