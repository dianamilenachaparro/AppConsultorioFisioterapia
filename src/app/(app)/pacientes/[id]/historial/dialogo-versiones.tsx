"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatearFechaHora } from "@/lib/tiempo";
import { NOMBRE_ZONA } from "@/lib/validacion/cita";
import type { VersionAtencion } from "@/server/atenciones/servicio";
import { obtenerVersionesAccion } from "./acciones";

const CAMPOS: Record<string, string> = {
  zonaCorporal: "Zona",
  motivo: "Motivo",
  tecnica: "Técnica",
  dolor: "Dolor",
  notasEvolucion: "Evolución",
};

function mostrar(campo: string, valor: unknown) {
  if (campo === "zonaCorporal") return NOMBRE_ZONA[valor as keyof typeof NOMBRE_ZONA] ?? String(valor);
  if (campo === "dolor") return `${valor} / 10`;
  return String(valor ?? "");
}

/** Distintivo "Editada" que abre las versiones anteriores, leídas de la auditoría. */
export function DialogoVersiones({ atencionId }: { atencionId: string }) {
  const [versiones, setVersiones] = useState<VersionAtencion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const cargar = (abierto: boolean) => {
    if (!abierto || versiones) return;
    iniciar(async () => {
      const r = await obtenerVersionesAccion(atencionId);
      if (r.ok) setVersiones(r.data);
      else setError(r.mensaje);
    });
  };

  return (
    <Dialog onOpenChange={cargar}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Editada: ver versiones anteriores">
          <Badge variant="outline" className="cursor-pointer">
            Editada
          </Badge>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cambios de la atención</DialogTitle>
          <DialogDescription>Cada corrección guarda los valores que había antes.</DialogDescription>
        </DialogHeader>
        {pendiente && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <ol className="flex flex-col gap-4">
          {versiones?.map((v, i) => (
            <li key={i} className="flex flex-col gap-2 text-sm">
              <p className="text-xs text-muted-foreground">
                {v.editadoPor} · {formatearFechaHora(new Date(v.editadoEn))}
              </p>
              <dl className="flex flex-col gap-2">
                {Object.keys(v.antes).map((campo) => (
                  <div key={campo}>
                    <dt className="font-medium">{CAMPOS[campo] ?? campo}</dt>
                    <dd className="whitespace-pre-line text-muted-foreground line-through">{mostrar(campo, v.antes[campo])}</dd>
                    <dd className="whitespace-pre-line">{mostrar(campo, v.despues[campo])}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
