import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type EventoLinea = {
  clave: string;
  titulo: string;
  detalle: string;
  icono: LucideIcon;
  /** Color del círculo cuando el evento ya ocurrió. */
  tono: "info" | "exito" | "aviso" | "peligro";
  hecho: boolean;
};

const CIRCULO = {
  info: "bg-primary text-primary-foreground",
  exito: "bg-exito text-white",
  aviso: "bg-[var(--serie-4)] text-white",
  peligro: "bg-peligro text-white",
} as const;

/** Eventos en orden, unidos por una línea vertical; los pendientes quedan en gris. */
export function LineaTiempo({ eventos, className, ...props }: { eventos: EventoLinea[] } & React.ComponentProps<"ol">) {
  return (
    <ol className={cn("flex flex-col", className)} {...props}>
      {eventos.map((e, i) => (
        <li key={e.clave} className="relative flex gap-3 pb-4 last:pb-0">
          {i < eventos.length - 1 && (
            <span aria-hidden className="absolute top-9 bottom-1 left-[1.0625rem] w-px bg-border" />
          )}
          <span
            aria-hidden
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-200",
              e.hecho ? CIRCULO[e.tono] : "border border-dashed border-input bg-card text-muted-foreground",
            )}
          >
            <e.icono className="size-4" strokeWidth={2.2} />
          </span>
          <div className="flex min-w-0 flex-col justify-center gap-0.5 pt-0.5">
            <p className={cn("text-sm font-semibold", !e.hecho && "text-muted-foreground")}>{e.titulo}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{e.detalle}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
