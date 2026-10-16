"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Textarea } from "@/components/ui/textarea";
import { agregarNotaAccion } from "./acciones";

/** Nota aclaratoria: se agrega debajo de la atención sin modificar el registro original (FR-025b). */
export function FormularioNota({ citaId, atencionId }: { citaId: string; atencionId: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await agregarNotaAccion(citaId, atencionId, texto);
      if (!r.ok) return setError(r.mensaje);
      toast.success("Nota aclaratoria agregada");
      setTexto("");
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="nota" etiqueta="Agregar nota aclaratoria" error={error ? [error] : undefined}>
        <Textarea id="nota" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
      </Campo>
      <Button type="submit" variant="outline" disabled={pendiente || texto.trim().length < 5} className="self-start">
        {pendiente ? "Guardando…" : "Agregar nota"}
      </Button>
    </form>
  );
}
