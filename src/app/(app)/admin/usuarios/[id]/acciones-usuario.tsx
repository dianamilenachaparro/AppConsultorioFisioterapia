"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BotonEstado } from "@/components/formularios/boton-estado";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cambiarEstadoUsuarioAccion, restablecerPasswordAccion } from "../acciones";

export function AccionesUsuario({ id, nombre, activo }: { id: string; nombre: string; activo: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const restablecer = () =>
    iniciar(async () => {
      setError(null);
      const r = await restablecerPasswordAccion(id, clave);
      if (!r.ok) return setError(r.mensaje);
      toast.success("Contraseña restablecida. Deberá cambiarla al entrar.");
      setClave("");
      setAbierto(false);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <BotonEstado
        activo={activo}
        nombre={nombre}
        cambiar={(nuevo, confirmar) => cambiarEstadoUsuarioAccion(id, nuevo, confirmar)}
      />
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Restablecer contraseña
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              Se cerrarán sus sesiones abiertas y deberá cambiar esta contraseña temporal al entrar.
            </DialogDescription>
          </DialogHeader>
          <Campo id="clave-temporal" etiqueta="Contraseña temporal (mín. 8 caracteres)" error={error ? [error] : undefined}>
            <Input id="clave-temporal" type="text" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} />
          </Campo>
          <DialogFooter>
            <Button onClick={restablecer} disabled={pendiente || clave.length < 8}>
              {pendiente ? "Guardando…" : "Restablecer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
