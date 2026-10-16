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
import { registrarCobroAccion } from "./acciones";

type MedioPago = (typeof MEDIOS_PAGO)[number];

/** Cobro (abono) de terapia; tras guardar solo muestra la confirmación (FR-037). */
export function FormularioCobro({ citaId, enlaceMovimientos }: { citaId: string; enlaceMovimientos: string }) {
  const router = useRouter();
  const [valor, setValor] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("EFECTIVO");
  const [error, setError] = useState<Fallo | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const numero = /^\d+$/.test(valor.trim()) ? Number(valor) : null;

  if (hecho) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="font-medium">Cobro registrado: {hecho}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setHecho(null)}>
            Registrar otro abono
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
      const r = await registrarCobroAccion({ citaId, valor, medioPago });
      if (!r.ok) return setError(r);
      setHecho(`${formatearCOP(Number(valor))} en ${NOMBRE_MEDIO_PAGO[medioPago].toLowerCase()}`);
      setValor("");
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="valor" etiqueta="Valor (COP)" error={error?.campos?.valor}>
        <Input id="valor" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} />
      </Campo>
      {numero !== null && <p className="text-sm text-muted-foreground tabular-nums">{formatearCOP(numero)}</p>}
      <Campo id="medio" etiqueta="Medio de pago" error={error?.campos?.medioPago}>
        <NativeSelect id="medio" value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
          {MEDIOS_PAGO.map((m) => (
            <option key={m} value={m}>
              {NOMBRE_MEDIO_PAGO[m]}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pendiente || !numero} className="self-start">
        {pendiente ? "Guardando…" : "Registrar cobro"}
      </Button>
    </form>
  );
}
