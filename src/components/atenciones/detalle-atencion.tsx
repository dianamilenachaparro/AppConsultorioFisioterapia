import { formatearFechaHora } from "@/lib/tiempo";
import { NOMBRE_ZONA } from "@/lib/validacion/cita";

type Zona = keyof typeof NOMBRE_ZONA;

export function DetalleAtencion({
  atencion,
}: {
  atencion: { zonaCorporal: Zona; motivo: string; tecnica: string; dolor: number; notasEvolucion: string };
}) {
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-muted-foreground">Zona</dt>
      <dd>{NOMBRE_ZONA[atencion.zonaCorporal]}</dd>
      <dt className="text-muted-foreground">Dolor</dt>
      <dd className="tabular-nums">{atencion.dolor} / 10</dd>
      <dt className="text-muted-foreground">Motivo</dt>
      <dd className="whitespace-pre-line">{atencion.motivo}</dd>
      <dt className="text-muted-foreground">Técnica</dt>
      <dd className="whitespace-pre-line">{atencion.tecnica}</dd>
      <dt className="text-muted-foreground">Evolución</dt>
      <dd className="whitespace-pre-line">{atencion.notasEvolucion}</dd>
    </dl>
  );
}

export function NotasAclaratorias({
  notas,
}: {
  notas: { id: string; texto: string; autor: string; creadoEn: Date }[];
}) {
  if (notas.length === 0) return null;
  return (
    <section aria-label="Notas aclaratorias" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Notas aclaratorias</h3>
      <ul className="flex flex-col gap-2">
        {notas.map((n) => (
          <li key={n.id} className="rounded-md border-l-4 border-muted-foreground/40 bg-muted/50 px-3 py-2 text-sm">
            <p className="whitespace-pre-line">{n.texto}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {n.autor} · {formatearFechaHora(n.creadoEn)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
