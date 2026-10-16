import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatearCOP } from "@/lib/dinero";
import { ErrorDominio } from "@/lib/resultado";
import { fechaBogota, formatearFecha, formatearFechaLarga, formatearHora } from "@/lib/tiempo";
import { NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { paginaProtegida } from "@/server/auth/paginas";
import { citaParaPagina } from "@/server/citas/pagina";
import { obtenerCobrosCita } from "@/server/finanzas/cobros";
import { FormularioCobro } from "./formulario-cobro";

export default async function CobroCita({ params }: PageProps<"/citas/[id]/cobro">) {
  const sesion = await paginaProtegida("cobro:registrar");
  const { id } = await params;
  const cita = await citaParaPagina(sesion, id);
  let previos;
  try {
    previos = await obtenerCobrosCita(sesion, { citaId: id });
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === "SIN_PERMISO") redirect("/prohibido");
    throw e;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <Link href={`/citas/${id}`} className="text-sm underline-offset-4 hover:underline">
        ← Volver a la cita
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Registrar cobro</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {cita.paciente.nombreCompleto} · {formatearFechaLarga(fechaBogota(cita.inicio))} · {formatearHora(cita.inicio)}
        </p>
      </div>

      {/* Los cobros previos se muestran antes del formulario para evitar dobles registros. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cobros ya registrados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {previos.cobros.length === 0 ? (
            <p className="text-muted-foreground">Esta cita aún no tiene cobros.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {previos.cobros.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 tabular-nums">
                    <span className={c.anulado ? "text-muted-foreground line-through" : ""}>
                      {formatearCOP(c.valor)} · {NOMBRE_MEDIO_PAGO[c.medioPago]} · {formatearFecha(c.fecha)}
                    </span>
                    {c.anulado && <Badge variant="destructive">Anulado</Badge>}
                  </li>
                ))}
              </ul>
              <p className="font-medium tabular-nums">Suma vigente: {formatearCOP(previos.sumaVigente)}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {cita.estado === "ASISTIDA" ? (
            <FormularioCobro citaId={id} enlaceMovimientos={sesion.rol === "DUENO" ? "/finanzas" : "/mis-movimientos"} />
          ) : (
            <p className="text-sm">
              Solo se cobran citas marcadas como <strong>Asistidas</strong>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
