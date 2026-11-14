import { Badge } from "@/components/ui/badge";

export type EstadoCita = "PROGRAMADA" | "ASISTIDA" | "CANCELADA";

export const NOMBRE_ESTADO: Record<EstadoCita, string> = {
  PROGRAMADA: "Programada",
  ASISTIDA: "Asistida",
  CANCELADA: "Cancelada",
};

const TONO = { PROGRAMADA: "info", ASISTIDA: "exito", CANCELADA: "peligro" } as const;

export function EtiquetaEstado({ estado }: { estado: EstadoCita }) {
  return <Badge variant={TONO[estado]}>{NOMBRE_ESTADO[estado]}</Badge>;
}

export function EtiquetaRetroactiva() {
  return <Badge variant="aviso">Retroactiva</Badge>;
}
