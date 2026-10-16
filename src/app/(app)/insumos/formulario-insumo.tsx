"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import type { Fallo } from "@/lib/resultado";
import { crearInsumoAccion, editarInsumoAccion } from "./acciones";

type Valores = { nombre: string; costo: string; precioVenta: string; stockMinimo: string; stockInicial: string };

/** Crear insumo, o editarlo cuando llega `insumo` (el stock no se edita: solo cambia con movimientos). */
export function FormularioInsumo({
  insumo,
}: {
  insumo?: { id: string; nombre: string; costo: number; precioVenta: number; stockMinimo: number };
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState<Valores>(
    insumo
      ? {
          nombre: insumo.nombre,
          costo: String(insumo.costo),
          precioVenta: String(insumo.precioVenta),
          stockMinimo: String(insumo.stockMinimo),
          stockInicial: "0",
        }
      : { nombre: "", costo: "", precioVenta: "", stockMinimo: "0", stockInicial: "0" },
  );
  const [error, setError] = useState<Fallo | null>(null);
  const cambiar = (p: Partial<Valores>) => setV((x) => ({ ...x, ...p }));

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const { stockInicial, ...datos } = v;
      const r = insumo ? await editarInsumoAccion(insumo.id, datos) : await crearInsumoAccion({ ...datos, stockInicial });
      if (!r.ok) return setError(r);
      toast.success(insumo ? "Insumo actualizado" : "Insumo creado");
      if (insumo) router.refresh();
      else router.push("/insumos");
    });

  const errores = error?.campos;
  const numero = (campo: keyof Valores, etiqueta: string) => (
    <Campo id={campo} etiqueta={etiqueta} error={errores?.[campo]}>
      <Input id={campo} inputMode="numeric" value={v[campo]} onChange={(e) => cambiar({ [campo]: e.target.value })} />
    </Campo>
  );

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="nombre" etiqueta="Nombre" error={errores?.nombre} className="sm:col-span-2">
        <Input id="nombre" value={v.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
      </Campo>
      {numero("costo", "Costo (COP)")}
      {numero("precioVenta", "Precio de venta (COP)")}
      {!insumo && numero("stockInicial", "Stock inicial")}
      {numero("stockMinimo", "Stock mínimo")}
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente} className="justify-self-start">
        {pendiente ? "Guardando…" : insumo ? "Guardar cambios" : "Crear insumo"}
      </Button>
    </form>
  );
}
