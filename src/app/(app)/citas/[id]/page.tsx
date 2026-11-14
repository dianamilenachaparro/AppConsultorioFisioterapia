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
    <div className="mx-auto grid w-full max-w-5xl items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
        <h1 className="text-2xl font-bold tracking-tight">Cita</h1>
        <EtiquetaEstado estado={cita.estado} />
        {cita.retroactiva && <EtiquetaRetroactiva />}
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:col-start-1">
      <Card>
        <CardHeader>
          <CardTitle className="text-base first-letter:uppercase">
            {formatearFechaLarga(fechaBogota(cita.inicio))} · {formatearHora(cita.inicio)}–
            {formatearHora(cita.fin)}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Paciente: </span>
            <Link
              href={`/pacientes/${cita.paciente.id}`}
              className="hover:text-primary font-semibold underline-offset-4 hover:underline"
            >
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
          <p className="text-muted-foreground text-xs sm:col-span-2">
            Creada por {cita.creadoPor.nombreCompleto} el {formatearFechaHora(cita.creadoEn)}
          </p>
          {cita.estado === "CANCELADA" && (
            <div className="bg-peligro-suave rounded-md p-4 sm:col-span-2">
              <p className="text-peligro font-semibold">Cancelada</p>
              <p>{cita.observacionCancelacion}</p>
              <p className="text-muted-foreground text-xs">
                {cita.canceladaPor?.nombreCompleto} ·{" "}
                {cita.canceladaEn && formatearFechaHora(cita.canceladaEn)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AccionesCita
        id={cita.id}
        estado={cita.estado}
        puedeGestionar={puede(sesion.rol, "citas:gestionar")}
        puedeRevertir={puede(sesion.rol, "citas:revertir_estado")}
      />

      <div className="text-primary flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
        {puede(sesion.rol, "atenciones:registrar") && cita.estado === "ASISTIDA" && (
          <Link href={`/citas/${cita.id}/atencion`} className="underline-offset-4 hover:underline">
            Atención
          </Link>
        )}
        {puede(sesion.rol, "cobro:registrar") && cita.estado === "ASISTIDA" && (
          <Link href={`/citas/${cita.id}/cobro`} className="underline-offset-4 hover:underline">
            Registrar cobro
          </Link>
        )}
        <Link
          href={`/pacientes/${cita.paciente.id}/historial`}
          className="underline-offset-4 hover:underline"
        >
          Ver historial del paciente
        </Link>
      </div>
      </div>

      {cita.estado !== "CANCELADA" && (
        <TiemposCita
          citaId={cita.id}
          fecha={fechaBogota(cita.inicio)}
          tiempos={await obtenerMarcacion(cita.id)}
          puedeCorregir={puede(sesion.rol, "marcaciones:corregir")}
        />
      )}
    </div>
  );
}
