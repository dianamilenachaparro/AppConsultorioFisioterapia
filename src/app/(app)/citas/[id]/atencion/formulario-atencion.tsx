"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Fallo } from "@/lib/resultado";
import type { CamposAtencion } from "@/lib/validacion/atencion";
import { NOMBRE_ZONA, ZONAS } from "@/lib/validacion/cita";
import { editarAtencionAccion, registrarAtencionAccion } from "./acciones";

type Valores = Omit<CamposAtencion, "dolor"> & { dolor: number | null };

/** Escala 0–10 con botones grandes, fáciles de tocar en celular. */
function SelectorDolor({
  valor,
  onChange,
  error,
}: {
  valor: number | null;
  onChange: (v: number) => void;
  error?: string[];
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">Dolor (0 = sin dolor, 10 = máximo)</legend>
      <div role="radiogroup" className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={valor === n}
            onClick={() => onChange(n)}
            className={cn(
              "h-11 rounded-md border text-base font-semibold tabular-nums transition-colors",
              valor === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      {error?.[0] && <p className="text-sm text-destructive">{error[0]}</p>}
    </fieldset>
  );
}

/** Registrar la atención de la cita, o corregirla el mismo día si `atencionId` viene dado. */
export function FormularioAtencion({
  citaId,
  atencionId,
  inicial,
}: {
  citaId: string;
  atencionId?: string;
  inicial: Valores;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [valores, setValores] = useState<Valores>(inicial);
  const [error, setError] = useState<Fallo | null>(null);
  const cambiar = (parcial: Partial<Valores>) => setValores((v) => ({ ...v, ...parcial }));

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const campos = { ...valores, dolor: valores.dolor ?? Number.NaN };
      const r = atencionId
        ? await editarAtencionAccion(citaId, atencionId, campos)
        : await registrarAtencionAccion(citaId, campos);
      if (!r.ok) return setError(r);
      toast.success(atencionId ? "Atención actualizada" : "Atención registrada");
      router.refresh();
    });

  const errores = error?.campos;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="zona" etiqueta="Zona corporal" error={errores?.zonaCorporal}>
        <NativeSelect
          id="zona"
          value={valores.zonaCorporal}
          onChange={(e) => cambiar({ zonaCorporal: e.target.value as Valores["zonaCorporal"] })}
        >
          {ZONAS.map((z) => (
            <option key={z} value={z}>
              {NOMBRE_ZONA[z]}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="motivo" etiqueta="Motivo" error={errores?.motivo}>
        <Textarea id="motivo" rows={2} value={valores.motivo} onChange={(e) => cambiar({ motivo: e.target.value })} />
      </Campo>
      <Campo id="tecnica" etiqueta="Técnica aplicada" error={errores?.tecnica}>
        <Textarea id="tecnica" rows={2} value={valores.tecnica} onChange={(e) => cambiar({ tecnica: e.target.value })} />
      </Campo>
      <SelectorDolor valor={valores.dolor} onChange={(dolor) => cambiar({ dolor })} error={errores?.dolor} />
      <Campo id="notas" etiqueta="Notas de evolución" error={errores?.notasEvolucion}>
        <Textarea
          id="notas"
          rows={4}
          value={valores.notasEvolucion}
          onChange={(e) => cambiar({ notasEvolucion: e.target.value })}
        />
      </Campo>
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente} className="self-start">
        {pendiente ? "Guardando…" : atencionId ? "Guardar cambios" : "Registrar atención"}
      </Button>
    </form>
  );
}
