"use client";

import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DEPARTAMENTOS } from "@/lib/departamentos";

export type DatosPaciente = {
  documento: string;
  nombreCompleto: string;
  telefono: string;
  fechaNacimiento: string;
  direccion: string;
  departamento: string;
  ciudad: string;
  barrio: string;
};

export const PACIENTE_VACIO: DatosPaciente = {
  documento: "",
  nombreCompleto: "",
  telefono: "",
  fechaNacimiento: "",
  direccion: "",
  departamento: "",
  ciudad: "",
  barrio: "",
};

/** Los 8 campos del paciente, controlados por el componente padre (FR-011). */
export function CamposPaciente({
  valores,
  onChange,
  errores,
  documentoBloqueado,
}: {
  valores: DatosPaciente;
  onChange: (v: DatosPaciente) => void;
  errores?: Record<string, string[]>;
  documentoBloqueado?: boolean;
}) {
  const set = (campo: keyof DatosPaciente) => (e: { target: { value: string } }) =>
    onChange({ ...valores, [campo]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo id="p-documento" etiqueta="Documento" error={errores?.documento}>
        <Input
          id="p-documento"
          value={valores.documento}
          onChange={set("documento")}
          disabled={documentoBloqueado}
          required
        />
      </Campo>
      <Campo id="p-nombre" etiqueta="Nombre completo" error={errores?.nombreCompleto}>
        <Input id="p-nombre" value={valores.nombreCompleto} onChange={set("nombreCompleto")} required />
      </Campo>
      <Campo id="p-telefono" etiqueta="Teléfono" error={errores?.telefono}>
        <Input id="p-telefono" type="tel" inputMode="tel" value={valores.telefono} onChange={set("telefono")} required />
      </Campo>
      <Campo id="p-nacimiento" etiqueta="Fecha de nacimiento" error={errores?.fechaNacimiento}>
        <Input id="p-nacimiento" type="date" value={valores.fechaNacimiento} onChange={set("fechaNacimiento")} required />
      </Campo>
      <Campo id="p-direccion" etiqueta="Dirección" error={errores?.direccion} className="sm:col-span-2">
        <Input id="p-direccion" value={valores.direccion} onChange={set("direccion")} required />
      </Campo>
      <Campo id="p-departamento" etiqueta="Departamento" error={errores?.departamento}>
        <NativeSelect id="p-departamento" value={valores.departamento} onChange={set("departamento")} required>
          <option value="">Selecciona…</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="p-ciudad" etiqueta="Ciudad" error={errores?.ciudad}>
        <Input id="p-ciudad" value={valores.ciudad} onChange={set("ciudad")} required />
      </Campo>
      <Campo id="p-barrio" etiqueta="Barrio" error={errores?.barrio}>
        <Input id="p-barrio" value={valores.barrio} onChange={set("barrio")} required />
      </Campo>
    </div>
  );
}
