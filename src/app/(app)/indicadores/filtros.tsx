"use client";

import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type Opcion = { id: string; nombre: string };
export type Filtro = { periodo: string; fecha: string; profesional?: string; consultorio?: string };

/** Filtros en una sola fila, guardados en la URL. */
export function FiltrosIndicadores({
  filtro,
  profesionales,
  consultorios,
}: {
  filtro: Filtro;
  profesionales?: Opcion[];
  consultorios: Opcion[];
}) {
  const router = useRouter();
  const ruta = usePathname();
  const cambiar = (cambios: Partial<Filtro>) => {
    const nuevo = { ...filtro, ...cambios };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(nuevo)) if (v) p.set(k, v);
    router.push(`${ruta}?${p.toString()}`);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div className="flex flex-col gap-1.5 sm:w-36">
        <Label htmlFor="periodo">Periodo</Label>
        <NativeSelect id="periodo" value={filtro.periodo} onChange={(e) => cambiar({ periodo: e.target.value })}>
          <option value="DIA">Día</option>
          <option value="SEMANA">Semana</option>
          <option value="MES">Mes</option>
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5 sm:w-44">
        <Label htmlFor="fecha">Fecha</Label>
        <Input id="fecha" type="date" value={filtro.fecha} onChange={(e) => e.target.value && cambiar({ fecha: e.target.value })} />
      </div>
      {profesionales && (
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label htmlFor="profesional">Profesional</Label>
          <NativeSelect id="profesional" value={filtro.profesional ?? ""} onChange={(e) => cambiar({ profesional: e.target.value })}>
            <option value="">Todos</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="flex flex-col gap-1.5 sm:w-48">
        <Label htmlFor="consultorio">Consultorio</Label>
        <NativeSelect id="consultorio" value={filtro.consultorio ?? ""} onChange={(e) => cambiar({ consultorio: e.target.value })}>
          <option value="">Todos</option>
          {consultorios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
