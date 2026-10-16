import Link from "next/link";
import { EtiquetaEstado, EtiquetaRetroactiva } from "@/components/agenda/etiquetas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { puede } from "@/lib/permisos";
import { formatearFechaHora, formatearFechaLarga, fechaBogota, formatearHora } from "@/lib/tiempo";
import { NOMBRE_ZONA } from "@/lib/validacion/cita";
import { paginaProtegida } from "@/server/auth/paginas";
import { citaParaPagina } from "@/server/citas/pagina";
import { obtenerMarcacion } from "@/server/marcaciones/servicio";
import { AccionesCita } from "./acciones-cita";
import { TiemposCita } from "./tiempos";

export default async function DetalleCita({ params }: PageProps<"/citas/[id]">) {
  const sesion = await paginaProtegida("citas:listar");
  const { id } = await params;
  const cita = await citaParaPagina(sesion, id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Cita</h1>
        <EtiquetaEstado estado={cita.estado} />
        {cita.retroactiva && <EtiquetaRetroactiva />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base first-letter:uppercase">
            {formatearFechaLarga(fechaBogota(cita.inicio))} · {formatearHora(cita.inicio)}–{formatearHora(cita.fin)}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Paciente: </span>
            <Link href={`/pacientes/${cita.paciente.id}`} className="font-medium underline-offset-4 hover:underline">
              {cita.paciente.nombreCompleto}
            </Link>{" "}
            ({cita.paciente.documento})
          </p>
          <p>
            <span className="text-muted-foreground">Profesional: </span>
            {cita.profesional.nombreCompleto}
          </p>
          <p>
            <span className="text-muted-foreground">Consultorio: </span>
            {cita.consultorio.nombre}
          </p>
          <p>
            <span className="text-muted-foreground">Zona: </span>
            {NOMBRE_ZONA[cita.zonaCorporal]}
          </p>
          <p className="sm:col-span-2">
            <span className="text-muted-foreground">Motivo: </span>
            {cita.motivo}
          </p>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Creada por {cita.creadoPor.nombreCompleto} el {formatearFechaHora(cita.creadoEn)}
          </p>
          {cita.estado === "CANCELADA" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:col-span-2">
              <p className="font-medium">Cancelada</p>
              <p>{cita.observacionCancelacion}</p>
              <p className="text-xs text-muted-foreground">
                {cita.canceladaPor?.nombreCompleto} · {cita.canceladaEn && formatearFechaHora(cita.canceladaEn)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {cita.estado !== "CANCELADA" && (
        <TiemposCita
          citaId={cita.id}
          fecha={fechaBogota(cita.inicio)}
          tiempos={await obtenerMarcacion(cita.id)}
          puedeCorregir={puede(sesion.rol, "marcaciones:corregir")}
        />
      )}

      <AccionesCita
        id={cita.id}
        estado={cita.estado}
        puedeGestionar={puede(sesion.rol, "citas:gestionar")}
        puedeRevertir={puede(sesion.rol, "citas:revertir_estado")}
      />

      <div className="flex flex-wrap gap-4 text-sm">
        {puede(sesion.rol, "atenciones:registrar") && cita.estado === "ASISTIDA" && (
          <Link href={`/citas/${cita.id}/atencion`} className="font-medium underline-offset-4 hover:underline">
            Atención
          </Link>
        )}
        {puede(sesion.rol, "cobro:registrar") && cita.estado === "ASISTIDA" && (
          <Link href={`/citas/${cita.id}/cobro`} className="font-medium underline-offset-4 hover:underline">
            Registrar cobro
          </Link>
        )}
        <Link href={`/pacientes/${cita.paciente.id}/historial`} className="underline-offset-4 hover:underline">
          Ver historial del paciente
        </Link>
      </div>
    </div>
  );
}
