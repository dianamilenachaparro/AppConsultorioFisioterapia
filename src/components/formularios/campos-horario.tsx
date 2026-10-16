"use client";

import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { BLOQUES } from "@/lib/tiempo";
import { CIERRE_MIN } from "@/lib/validacion/cita";

export type DatosHorario = {
  consultorioId: string;
  profesionalId: string;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
};

type Opcion = { id: string; nombre?: string; nombreCompleto?: string };

function duracionesPosibles(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  const maximo = CIERRE_MIN - (h * 60 + m);
  const opciones: number[] = [];
  for (let d = 30; d <= Math.min(maximo, 570); d += 30) opciones.push(d);
  return opciones;
}

function textoDuracion(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** Consultorio, profesional, fecha, hora de inicio y duración (sin pasar de las 5:00 p.m.). */
export function CamposHorario({
  valores,
  onChange,
  consultorios,
  profesionales,
  errores,
}: {
  valores: DatosHorario;
  onChange: (v: DatosHorario) => void;
  consultorios: Opcion[];
  profesionales: Opcion[];
  errores?: Record<string, string[]>;
}) {
  const duraciones = valores.horaInicio ? duracionesPosibles(valores.horaInicio) : [30];
  const cambiar = (parcial: Partial<DatosHorario>) => {
    const nuevo = { ...valores, ...parcial };
    // Si la nueva hora no admite la duración elegida, ajustarla a la máxima posible.
    const posibles = duracionesPosibles(nuevo.horaInicio);
    if (!posibles.includes(nuevo.duracionMin)) nuevo.duracionMin = posibles.at(-1) ?? 30;
    onChange(nuevo);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo id="c-consultorio" etiqueta="Consultorio" error={errores?.consultorioId}>
        <NativeSelect
          id="c-consultorio"
          value={valores.consultorioId}
          onChange={(e) => cambiar({ consultorioId: e.target.value })}
          required
        >
          <option value="">Selecciona…</option>
          {consultorios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="c-profesional" etiqueta="Profesional" error={errores?.profesionalId}>
        <NativeSelect
          id="c-profesional"
          value={valores.profesionalId}
          onChange={(e) => cambiar({ profesionalId: e.target.value })}
          required
        >
          <option value="">Selecciona…</option>
          {profesionales.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombreCompleto}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      <Campo id="c-fecha" etiqueta="Fecha" error={errores?.fecha}>
        <Input id="c-fecha" type="date" value={valores.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="c-hora" etiqueta="Hora de inicio" error={errores?.horaInicio}>
          <NativeSelect id="c-hora" value={valores.horaInicio} onChange={(e) => cambiar({ horaInicio: e.target.value })}>
            {BLOQUES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </NativeSelect>
        </Campo>
        <Campo id="c-duracion" etiqueta="Duración" error={errores?.duracionMin}>
          <NativeSelect
            id="c-duracion"
            value={valores.duracionMin}
            onChange={(e) => cambiar({ duracionMin: Number(e.target.value) })}
          >
            {duraciones.map((d) => (
              <option key={d} value={d}>
                {textoDuracion(d)}
              </option>
            ))}
          </NativeSelect>
        </Campo>
      </div>
    </div>
  );
}
