"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatearCOP } from "@/lib/dinero";
import type { Fallo } from "@/lib/resultado";
import { MEDIOS_PAGO, NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { registrarEgresoAccion } from "./acciones";

type MedioPago = (typeof MEDIOS_PAGO)[number];

/** Todos los campos son obligatorios (FR-039). */
export function FormularioEgreso({ categorias, hoy }: { categorias: { id: string; nombre: string }[]; hoy: string }) {
  const router = useRouter();
  const [v, setV] = useState({ categoriaId: "", fecha: hoy, valor: "", medioPago: "EFECTIVO" as MedioPago, descripcion: "" });
  const [error, setError] = useState<Fallo | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cambiar = (p: Partial<typeof v>) => setV((x) => ({ ...x, ...p }));
  const numero = /^\d+$/.test(v.valor.trim()) ? Number(v.valor) : null;

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await registrarEgresoAccion(v);
      if (!r.ok) return setError(r);
      toast.success("Egreso registrado");
      router.push("/finanzas");
    });

  const errores = error?.campos;
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="categoria" etiqueta="Categoría" error={errores?.categoriaId}>
        <NativeSelect id="categoria" value={v.categoriaId} onChange={(e) => cambiar({ categoriaId: e.target.value })}>
          <option value="">Elige una categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="fecha" etiqueta="Fecha" error={errores?.fecha}>
        <Input id="fecha" type="date" value={v.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} />
      </Campo>
      <Campo id="valor" etiqueta="Valor (COP)" error={errores?.valor}>
        <Input id="valor" inputMode="numeric" value={v.valor} onChange={(e) => cambiar({ valor: e.target.value })} />
        {numero !== null && <p className="text-sm text-muted-foreground tabular-nums">{formatearCOP(numero)}</p>}
      </Campo>
      <Campo id="medio" etiqueta="Medio de pago" error={errores?.medioPago}>
        <NativeSelect id="medio" value={v.medioPago} onChange={(e) => cambiar({ medioPago: e.target.value as MedioPago })}>
          {MEDIOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {NOMBRE_MEDIO_PAGO[m]}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="descripcion" etiqueta="Descripción" error={errores?.descripcion} className="sm:col-span-2">
        <Textarea id="descripcion" rows={2} value={v.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} />
      </Campo>
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente} className="justify-self-start">
        {pendiente ? "Guardando…" : "Registrar egreso"}
      </Button>
    </form>
  );
}
