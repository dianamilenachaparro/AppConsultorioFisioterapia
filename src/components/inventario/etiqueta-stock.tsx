import { TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Alerta de stock bajo con ícono y texto, nunca solo color (FR-036). */
export function EtiquetaStockBajo() {
  return (
    <Badge variant="aviso">
      <TriangleAlertIcon aria-hidden />
      Stock bajo
    </Badge>
  );
}
