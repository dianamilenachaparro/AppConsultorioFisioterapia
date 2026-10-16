"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BotonEstado } from "@/components/formularios/boton-estado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cambiarEstadoConsultorioAccion, crearConsultorioAccion, editarConsultorioAccion } from "./acciones";

/** Nombre y orden editables en línea, más activar/desactivar. */
export function FilaConsultorio({ c }: { c: { id: string; nombre: string; orden: number; activo: boolean } }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(c.nombre);
  const [orden, setOrden] = useState(String(c.orden));
  const [pendiente, iniciar] = useTransition();
  const cambiado = nombre.trim() !== c.nombre || Number(orden) !== c.orden;

  const guardar = () =>
    iniciar(async () => {
      const r = await editarConsultorioAccion(c.id, { nombre, orden: Number(orden) });
      if (!r.ok) return void toast.error(r.mensaje);
      toast.success("Consultorio actualizado");
      router.refresh();
    });

  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-3">
      <Input
        aria-label="Orden"
        type="number"
        min={0}
        className="w-16"
        value={orden}
        onChange={(e) => setOrden(e.target.value)}
      />
      <Input aria-label="Nombre" className="min-w-40 flex-1" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      {!c.activo && <Badge variant="destructive">Inactivo</Badge>}
      {cambiado && (
        <Button size="sm" disabled={pendiente} onClick={guardar}>
          Guardar
        </Button>
      )}
      <BotonEstado
        activo={c.activo}
        nombre={c.nombre}
        cambiar={(activo, confirmar) => cambiarEstadoConsultorioAccion(c.id, activo, confirmar)}
      />
    </li>
  );
}

export function NuevoConsultorio() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const crear = () =>
    iniciar(async () => {
      setError(null);
      const r = await crearConsultorioAccion(nombre);
      if (!r.ok) return setError(r.mensaje);
      toast.success("Consultorio creado");
      setNombre("");
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        crear();
      }}
    >
      <div className="flex gap-2">
        <Input aria-label="Nombre del nuevo consultorio" placeholder="Nombre del nuevo consultorio" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Button type="submit" disabled={pendiente || !nombre.trim()}>
          Agregar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
