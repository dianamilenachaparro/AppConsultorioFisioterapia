"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CamposHorario, type DatosHorario } from "@/components/formularios/campos-horario";
import { Button } from "@/components/ui/button";
import type { Fallo } from "@/lib/resultado";
import { reprogramarCitaAccion } from "../acciones";

export function FormularioReprogramar({
  id,
  inicial,
  consultorios,
  profesionales,
}: {
  id: string;
  inicial: DatosHorario;
  consultorios: { id: string; nombre: string }[];
  profesionales: { id: string; nombreCompleto: string }[];
}) {
  const router = useRouter();
  const [valores, setValores] = useState(inicial);
  const [error, setError] = useState<Fallo | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          setError(null);
          const r = await reprogramarCitaAccion({ id, ...valores });
          if (!r.ok) return setError(r);
          toast.success("Cita reprogramada");
          router.push(`/citas/${id}`);
        });
      }}
    >
      <CamposHorario
        valores={valores}
        onChange={setValores}
        consultorios={consultorios}
        profesionales={profesionales}
        errores={error?.campos}
      />
      {error && !error.campos && (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
