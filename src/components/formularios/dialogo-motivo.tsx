"use client";

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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Resultado } from "@/lib/resultado";

/** Botón que abre un diálogo pidiendo un motivo obligatorio (≥ 5 caracteres) antes de ejecutar. */
export function DialogoMotivo({
  textoBoton,
  titulo,
  descripcion,
  etiqueta = "Motivo",
  textoConfirmar = "Confirmar",
  variante = "outline",
  ejecutar,
  exito,
}: {
  textoBoton: string;
  titulo: string;
  descripcion?: string;
  etiqueta?: string;
  textoConfirmar?: string;
  variante?: "outline" | "destructive" | "default" | "secondary";
  ejecutar: (motivo: string) => Promise<Resultado<unknown>>;
  exito: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const confirmar = () =>
    iniciar(async () => {
      setError(null);
      const r = await ejecutar(motivo);
      if (!r.ok) return setError(r.mensaje);
      toast.success(exito);
      setMotivo("");
      setAbierto(false);
    });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant={variante}>{textoBoton}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo-dialogo">{etiqueta}</Label>
          <Textarea id="motivo-dialogo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant={variante === "destructive" ? "destructive" : "default"}
            onClick={confirmar}
            disabled={pendiente || motivo.trim().length < 5}
          >
            {pendiente ? "Guardando…" : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
