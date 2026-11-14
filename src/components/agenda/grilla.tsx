import { PlusIcon } from "lucide-react";
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
    <ol className="superficie flex flex-col p-2 sm:p-3" aria-label="Bloques del día">
      {bloques.map((b) => (
        <li key={b.hora} className="flex min-h-14 items-stretch gap-3 border-border px-2 py-1.5 not-last:border-b sm:gap-4 sm:px-3">
          <span className="w-12 shrink-0 pt-2.5 text-sm font-semibold tabular-nums text-muted-foreground">{b.hora}</span>
          {b.estado === "DISPONIBLE" ? (
            puedeCrear ? (
              <Link
                href={`/agenda/nueva?consultorio=${consultorioId}&fecha=${fecha}&hora=${b.hora}`}
                className="group flex flex-1 items-center gap-2 rounded-md border border-dashed border-exito/30 px-3 text-sm font-semibold text-exito transition-colors duration-200 hover:border-exito/60 hover:bg-exito-suave"
              >
                <PlusIcon aria-hidden className="size-4 opacity-60 transition-opacity duration-200 group-hover:opacity-100" />
                Disponible
              </Link>
            ) : (
              <span className="flex flex-1 items-center px-3 text-sm font-semibold text-exito">Disponible</span>
            )
          ) : (
            <Link
              href={`/citas/${b.cita!.id}`}
              className="flex min-w-0 flex-1 flex-col gap-1 rounded-md bg-muted px-4 py-2.5 transition-colors duration-200 hover:bg-accent"
            >
              <span className="text-xs font-medium text-muted-foreground">
                Ocupado
                {!b.cita!.esInicio && ` · continúa desde ${formatearHora(b.cita!.inicio)}`}
              </span>
              {b.cita!.esInicio && (
                <>
                  <span className="truncate text-sm font-semibold">{b.cita!.paciente}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {b.cita!.profesional} · hasta {formatearHora(b.cita!.fin)}
                  </span>
                  <span className="flex flex-wrap gap-1 pt-0.5">
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
