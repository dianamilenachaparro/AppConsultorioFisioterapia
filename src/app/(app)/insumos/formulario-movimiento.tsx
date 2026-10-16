"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatearCOP } from "@/lib/dinero";
import type { Fallo } from "@/lib/resultado";
import { MEDIOS_PAGO, NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { registrarReposicionAccion, registrarVentaAccion } from "./acciones";

type MedioPago = (typeof MEDIOS_PAGO)[number];
type InsumoVenta = { id: string; nombre: string; precioVenta: number; stock: number };

function SelectorMedio({ valor, onChange, error }: { valor: MedioPago; onChange: (m: MedioPago) => void; error?: string[] }) {
  return (
    <Campo id="medio" etiqueta="Medio de pago" error={error}>
      <NativeSelect id="medio" value={valor} onChange={(e) => onChange(e.target.value as MedioPago)}>
        {MEDIOS_PAGO.map((m) => (
          <option key={m} value={m}>
            {NOMBRE_MEDIO_PAGO[m]}
          </option>
        ))}
      </NativeSelect>
    </Campo>
  );
}

function Total({ valor }: { valor: number | null }) {
  return (
    <p className="text-lg">
      Total: <strong className="tabular-nums">{valor === null ? "—" : formatearCOP(valor)}</strong>
    </p>
  );
}

const entero = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : null);

/** Venta (D, R): tras guardar solo muestra la confirmación y el enlace a "Mis movimientos". */
export function FormularioVenta({
  insumos,
  inicial,
  enlaceMovimientos,
}: {
  insumos: InsumoVenta[];
  inicial?: string;
  enlaceMovimientos: string;
}) {
  const refrescar = useRouter();
  const [insumoId, setInsumoId] = useState(inicial ?? insumos[0]?.id ?? "");
  const [cantidad, setCantidad] = useState("1");
  const [medioPago, setMedioPago] = useState<MedioPago>("EFECTIVO");
  const [error, setError] = useState<Fallo | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const insumo = insumos.find((i) => i.id === insumoId);
  const n = entero(cantidad);
  const total = insumo && n ? n * insumo.precioVenta : null;

  if (hecho) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="font-medium">Venta registrada: {hecho}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setHecho(null);
              setCantidad("1");
            }}
          >
            Registrar otra venta
          </Button>
          <Button asChild variant="outline">
            <Link href={enlaceMovimientos}>Ver mis movimientos</Link>
          </Button>
        </div>
      </div>
    );
  }

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await registrarVentaAccion({ insumoId, cantidad, medioPago });
      if (!r.ok) return setError(r);
      setHecho(`${cantidad} × ${insumo?.nombre} por ${r.data.total}`);
      refrescar.refresh(); // stock actualizado en el selector para la siguiente venta
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="insumo" etiqueta="Insumo" error={error?.campos?.insumoId}>
        <NativeSelect id="insumo" value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} — {formatearCOP(i.precioVenta)} (quedan {i.stock})
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="cantidad" etiqueta="Cantidad" error={error?.campos?.cantidad}>
        <Input id="cantidad" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      </Campo>
      <SelectorMedio valor={medioPago} onChange={setMedioPago} error={error?.campos?.medioPago} />
      <Total valor={total} />
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pendiente || !insumo} className="self-start">
        {pendiente ? "Guardando…" : "Registrar venta"}
      </Button>
    </form>
  );
}

/** Reposición (solo Dueño): suma stock y registra el egreso "Compra de insumos". */
export function FormularioReposicion({ insumo }: { insumo: { id: string; nombre: string; costo: number } }) {
  const router = useRouter();
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState(String(insumo.costo));
  const [medioPago, setMedioPago] = useState<MedioPago>("EFECTIVO");
  const [error, setError] = useState<Fallo | null>(null);
  const [pendiente, iniciar] = useTransition();
  const n = entero(cantidad);
  const c = entero(costoUnitario);
  const total = n !== null && c !== null ? n * c : null;

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await registrarReposicionAccion({ insumoId: insumo.id, cantidad, costoUnitario, medioPago });
      if (!r.ok) return setError(r);
      router.push(`/insumos/${insumo.id}`);
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="cantidad" etiqueta="Cantidad comprada" error={error?.campos?.cantidad}>
        <Input id="cantidad" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
      </Campo>
      <Campo id="costo" etiqueta="Costo unitario pagado (COP)" error={error?.campos?.costoUnitario}>
        <Input id="costo" inputMode="numeric" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} />
      </Campo>
      <SelectorMedio valor={medioPago} onChange={setMedioPago} error={error?.campos?.medioPago} />
      <Total valor={total} />
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : "Registrar reposición"}
      </Button>
    </form>
  );
}
