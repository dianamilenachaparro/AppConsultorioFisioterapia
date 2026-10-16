import Link from "next/link";
import { formatearHora } from "@/lib/tiempo";
import type { Bloque } from "@/server/citas/grilla";
import { EtiquetaEstado, EtiquetaRetroactiva } from "./etiquetas";

/** Lista vertical de los 19 bloques: legible a 360 px sin desplazamiento horizontal. */
export function Grilla({
  bloques,
  consultorioId,
  fecha,
  puedeCrear,
}: {
  bloques: Bloque[];
  consultorioId: string;
  fecha: string;
  puedeCrear: boolean;
}) {
  return (
    <ol className="flex flex-col divide-y rounded-lg border bg-background" aria-label="Bloques del día">
      {bloques.map((b) => (
        <li key={b.hora} className="flex min-h-12 items-stretch gap-3 px-3 py-2">
          <span className="w-12 shrink-0 pt-1 font-mono text-sm tabular-nums text-muted-foreground">{b.hora}</span>
          {b.estado === "DISPONIBLE" ? (
            puedeCrear ? (
              <Link
                href={`/agenda/nueva?consultorio=${consultorioId}&fecha=${fecha}&hora=${b.hora}`}
                className="flex flex-1 items-center rounded-md border border-dashed px-3 text-sm text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                Disponible
              </Link>
            ) : (
              <span className="flex flex-1 items-center px-3 text-sm text-emerald-700">Disponible</span>
            )
          ) : (
            <Link
              href={`/citas/${b.cita!.id}`}
              className="flex min-w-0 flex-1 flex-col gap-1 rounded-md bg-muted px-3 py-1.5 hover:bg-accent"
            >
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Ocupado
                {!b.cita!.esInicio && ` · continúa desde ${formatearHora(b.cita!.inicio)}`}
              </span>
              {b.cita!.esInicio && (
                <>
                  <span className="truncate text-sm font-medium">{b.cita!.paciente}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {b.cita!.profesional} · hasta {formatearHora(b.cita!.fin)}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    <EtiquetaEstado estado={b.cita!.estado} />
                    {b.cita!.retroactiva && <EtiquetaRetroactiva />}
                  </span>
                </>
              )}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
