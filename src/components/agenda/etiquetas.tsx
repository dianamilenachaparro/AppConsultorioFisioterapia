import { Badge } from "@/components/ui/badge";

export type EstadoCita = "PROGRAMADA" | "ASISTIDA" | "CANCELADA";

export const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  PROGRAMADA: "Programada",
  ASISTIDA: "Asistida",
  CANCELADA: "Cancelada",
};

export function EtiquetaEstado({ estado }: { estado: EstadoCita }) {
  const variante = estado === "CANCELADA" ? "destructive" : estado === "ASISTIDA" ? "default" : "secondary";
  return <Badge variant={variante}>{NOMBRE_ESTADO[estado]}</Badge>;
}

export function EtiquetaRetroactiva() {
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
      Retroactiva
    </Badge>
  );
}
