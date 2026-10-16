"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

function moverDia(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function FiltroAgenda({
  consultorios,
  consultorioId,
  fecha,
  hoy,
}: {
  consultorios?: { id: string; nombre: string }[];
  consultorioId?: string;
  fecha: string;
  hoy: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const ir = (cambios: { consultorio?: string; fecha?: string }) => {
    const p = new URLSearchParams();
    const c = cambios.consultorio ?? consultorioId;
    if (c) p.set("consultorio", c);
    p.set("fecha", cambios.fecha ?? fecha);
    router.push(`${ruta}?${p.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {consultorios && (
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label htmlFor="consultorio">Consultorio</Label>
          <NativeSelect id="consultorio" value={consultorioId} onChange={(e) => ir({ consultorio: e.target.value })}>
            {consultorios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fecha">Fecha</Label>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Día anterior" onClick={() => ir({ fecha: moverDia(fecha, -1) })}>
            <ChevronLeftIcon />
          </Button>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && ir({ fecha: e.target.value })}
            className="w-40"
          />
          <Button variant="outline" size="icon" aria-label="Día siguiente" onClick={() => ir({ fecha: moverDia(fecha, 1) })}>
            <ChevronRightIcon />
          </Button>
          {fecha !== hoy && (
            <Button variant="ghost" onClick={() => ir({ fecha: hoy })}>
              Hoy
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
