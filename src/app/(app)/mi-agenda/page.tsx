import Link from "next/link";
import { EtiquetaEstado } from "@/components/agenda/etiquetas";
import { FiltroAgenda } from "@/components/agenda/filtro-agenda";
import { formatearFechaLarga, formatearHora, hoyBogota } from "@/lib/tiempo";
import { NOMBRE_ZONA } from "@/lib/validacion/cita";
import { fechaISO } from "@/lib/validacion/comunes";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerMiAgenda } from "@/server/citas/listar";

export default async function MiAgenda({ searchParams }: PageProps<"/mi-agenda">) {
  const sesion = await paginaProtegida("agenda:ver_propia");
  const params = await searchParams;
  const hoy = hoyBogota();
  const fecha = fechaISO.safeParse(params.fecha).success ? (params.fecha as string) : hoy;
  const citas = await obtenerMiAgenda(sesion, { fecha });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Mi agenda</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{formatearFechaLarga(fecha)}</p>
      </div>
      <FiltroAgenda fecha={fecha} hoy={hoy} />
      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {citas.map((c) => (
          <li key={c.id}>
            <Link href={`/citas/${c.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-accent">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium tabular-nums">
                  {formatearHora(c.inicio)}–{formatearHora(c.fin)}
                </span>
                <EtiquetaEstado estado={c.estado} />
              </span>
              <span>{c.paciente.nombreCompleto}</span>
              <span className="text-sm text-muted-foreground">
                {c.consultorio.nombre} · {NOMBRE_ZONA[c.zonaCorporal]} · {c.motivo}
              </span>
            </Link>
          </li>
        ))}
        {citas.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin citas este día</li>}
      </ul>
    </div>
  );
}
