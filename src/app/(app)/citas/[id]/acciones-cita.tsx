"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { DialogoMotivo } from "@/components/formularios/dialogo-motivo";
import { Button } from "@/components/ui/button";
import { cancelarCitaAccion, marcarAsistidaAccion, revertirEstadoAccion } from "./acciones";

export function AccionesCita({
  id,
  estado,
  puedeGestionar,
  puedeRevertir,
}: {
  id: string;
  estado: "PROGRAMADA" | "ASISTIDA" | "CANCELADA";
  puedeGestionar: boolean;
  puedeRevertir: boolean;
}) {
  const [pendiente, iniciar] = useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      {puedeGestionar && estado === "PROGRAMADA" && (
        <>
          <Button
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await marcarAsistidaAccion(id);
                if (r.ok) toast.success("Cita marcada como asistida");
                else toast.error(r.mensaje);
              })
            }
          >
            Marcar asistida
          </Button>
          <Button asChild variant="outline">
            <Link href={`/citas/${id}/reprogramar`}>Reprogramar</Link>
          </Button>
          <DialogoMotivo
            textoBoton="Cancelar cita"
            titulo="Cancelar cita"
            descripcion="Los bloques quedarán disponibles para otra cita."
            etiqueta="Observación (obligatoria)"
            textoConfirmar="Cancelar cita"
            variante="destructive"
            ejecutar={(obs) => cancelarCitaAccion(id, obs)}
            exito="Cita cancelada"
          />
        </>
      )}
      {puedeRevertir && estado !== "PROGRAMADA" && (
        <DialogoMotivo
          textoBoton="Revertir a Programada"
          titulo="Revertir a Programada"
          descripcion="Se dejará registro del cambio. Si el horario ya fue tomado, no será posible."
          ejecutar={(motivo) => revertirEstadoAccion(id, motivo)}
          exito="La cita volvió a Programada"
        />
      )}
    </div>
  );
}
