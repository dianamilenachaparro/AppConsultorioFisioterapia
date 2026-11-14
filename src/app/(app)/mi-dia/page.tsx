import Link from "next/link";
import { BotonesMarcacion } from "@/components/agenda/botones-marcacion";
import { EtiquetaEstado } from "@/components/agenda/etiquetas";
import { formatearFechaLarga, formatearHora, hoyBogota } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerMiDia } from "@/server/marcaciones/servicio";

export default async function MiDia() {
  const sesion = await paginaProtegida("marcaciones:registrar");
  const citas = await obtenerMiDia(sesion);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi día</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{formatearFechaLarga(hoyBogota())}</p>
      </div>
      <ul className="flex flex-col gap-4">
        {citas.map((c) => (
          <li key={c.id} className="superficie flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="cifra text-lg">
                  {formatearHora(c.inicio)}–{formatearHora(c.fin)}
                </span>
                <EtiquetaEstado estado={c.estado} />
              </span>
              <Link href={`/citas/${c.id}`} className="font-semibold underline-offset-4 hover:text-primary hover:underline">
                {c.paciente.nombreCompleto}
              </Link>
              <span className="text-sm text-muted-foreground">
                {c.consultorio.nombre} · {c.motivo}
              </span>
            </div>
            <BotonesMarcacion
              citaId={c.id}
              inicial={c.tiempos}
              asistida={c.estado === "ASISTIDA"}
              tieneAtencion={c.tieneAtencion}
            />
          </li>
        ))}
        {citas.length === 0 && (
          <li className="superficie px-4 py-10 text-center text-sm text-muted-foreground">No tienes citas hoy</li>
        )}
      </ul>
    </div>
  );
}
