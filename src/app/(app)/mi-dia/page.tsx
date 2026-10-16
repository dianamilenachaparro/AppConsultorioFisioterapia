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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Mi día</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{formatearFechaLarga(hoyBogota())}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {citas.map((c) => (
          <li key={c.id} className="flex flex-col gap-3 rounded-lg border bg-background p-4">
            <div className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium tabular-nums">
                  {formatearHora(c.inicio)}–{formatearHora(c.fin)}
                </span>
                <EtiquetaEstado estado={c.estado} />
              </span>
              <Link href={`/citas/${c.id}`} className="font-medium underline-offset-4 hover:underline">
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
          <li className="rounded-lg border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
            No tienes citas hoy
          </li>
        )}
      </ul>
    </div>
  );
}
