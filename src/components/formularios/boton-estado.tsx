"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Resultado } from "@/lib/resultado";
import { formatearFechaHora } from "@/lib/tiempo";

type CitaPendiente = { id: string; inicio: Date; paciente: string; consultorio: string; profesional: string };

/**
 * Activar / desactivar. Si el servidor responde REQUIERE_CONFIRMACION, muestra las citas
 * futuras afectadas y vuelve a enviar con `confirmar = true`.
 */
export function BotonEstado({
  activo,
  nombre,
  cambiar,
}: {
  activo: boolean;
  nombre: string;
  cambiar: (activo: boolean, confirmar: boolean) => Promise<Resultado<unknown>>;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ mensaje: string; citas: CitaPendiente[] } | null>(null);

  const enviar = (confirmar: boolean) =>
    iniciar(async () => {
      const r = await cambiar(!activo, confirmar);
      if (r.ok) {
        setAviso(null);
        toast.success(activo ? `${nombre} desactivado` : `${nombre} activado`);
        router.refresh();
      } else if (r.error === "REQUIERE_CONFIRMACION") {
        setAviso({ mensaje: r.mensaje, citas: (r.data as CitaPendiente[]) ?? [] });
      } else {
        toast.error(r.mensaje);
      }
    });

  return (
    <>
      <Button variant={activo ? "outline" : "default"} size="sm" disabled={pendiente} onClick={() => enviar(false)}>
        {activo ? "Desactivar" : "Activar"}
      </Button>
      <Dialog open={!!aviso} onOpenChange={(v) => !v && setAviso(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>¿Desactivar {nombre}?</DialogTitle>
            <DialogDescription>{aviso?.mensaje}</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col divide-y rounded-md border text-sm">
            {aviso?.citas.map((c) => (
              <li key={c.id} className="flex flex-col px-3 py-2">
                <span className="font-medium">{formatearFechaHora(new Date(c.inicio))}</span>
                <span className="text-muted-foreground">
                  {c.paciente} · {c.profesional} · {c.consultorio}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAviso(null)}>
              No desactivar
            </Button>
            <Button variant="destructive" disabled={pendiente} onClick={() => enviar(true)}>
              {pendiente ? "Guardando…" : "Desactivar de todos modos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
