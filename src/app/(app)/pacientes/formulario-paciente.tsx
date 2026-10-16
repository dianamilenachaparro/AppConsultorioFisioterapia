"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CamposPaciente, PACIENTE_VACIO, type DatosPaciente } from "@/components/formularios/form-paciente";
import { Button } from "@/components/ui/button";
import type { Fallo } from "@/lib/resultado";
import { crearPacienteAccion, editarPacienteAccion } from "./acciones";

export function FormularioPaciente({
  paciente,
  puedeCambiarDocumento,
}: {
  paciente?: DatosPaciente & { id: string };
  puedeCambiarDocumento?: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [valores, setValores] = useState<DatosPaciente>(paciente ?? PACIENTE_VACIO);
  const [error, setError] = useState<Fallo | null>(null);

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = paciente ? await editarPacienteAccion(paciente.id, valores) : await crearPacienteAccion(valores);
      if (r.ok) {
        toast.success(paciente ? "Datos actualizados" : "Paciente registrado");
        router.push(`/pacientes/${r.data.id}`);
        router.refresh();
      } else if (r.error === "DUPLICADO" && r.data) {
        toast.info(r.mensaje);
        router.push(`/pacientes/${(r.data as { id: string }).id}`);
      } else {
        setError(r);
      }
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <CamposPaciente
        valores={valores}
        onChange={setValores}
        errores={error?.campos}
        documentoBloqueado={!!paciente && !puedeCambiarDocumento}
      />
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : paciente ? "Guardar cambios" : "Registrar paciente"}
      </Button>
    </form>
  );
}
