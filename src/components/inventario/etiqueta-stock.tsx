import { TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Alerta de stock bajo con ícono y texto, nunca solo color (FR-036). */
export function EtiquetaStockBajo() {
  return (
    <Badge variant="outline" className="gap-1 border-amber-500 text-amber-800 dark:text-amber-300">
      <TriangleAlertIcon aria-hidden className="size-3" />
      Stock bajo
    </Badge>
  );
}
