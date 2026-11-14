"use client";

import { DoorOpenIcon, FlagIcon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LineaTiempo } from "@/components/ui/linea-tiempo";
import { Textarea } from "@/components/ui/textarea";
import { formatearHora, horaBogota } from "@/lib/tiempo";
import { corregirMarcacionAccion } from "./acciones";

type Tiempos = { llegadaEn: Date | null; ingresoEn: Date | null; finEn: Date | null };

const FILAS = [
  ["llegada", "llegadaEn", "Llegada"],
  ["ingreso", "ingresoEn", "Ingreso a terapia"],
  ["fin", "finEn", "Fin de terapia"],
] as const;

const ICONO = { llegada: DoorOpenIcon, ingreso: PlayIcon, fin: FlagIcon } as const;
const TONO = { llegada: "info", ingreso: "aviso", fin: "exito" } as const;

/** Sección "Tiempos" de la cita; el Dueño puede corregirlos con motivo (FR-030). */
export function TiemposCita({
  citaId,
  fecha,
  tiempos,
  puedeCorregir,
}: {
  citaId: string;
  fecha: string;
  tiempos: Tiempos;
  puedeCorregir: boolean;
}) {
  const router = useRouter();
  const inicial = () => ({
    llegada: tiempos.llegadaEn ? horaBogota(tiempos.llegadaEn) : "",
    ingreso: tiempos.ingresoEn ? horaBogota(tiempos.ingresoEn) : "",
    fin: tiempos.finEn ? horaBogota(tiempos.finEn) : "",
  });
  const [abierto, setAbierto] = useState(false);
  const [horas, setHoras] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = await corregirMarcacionAccion(citaId, fecha, horas, motivo);
      if (!r.ok) return setError(r.mensaje);
      toast.success("Tiempos corregidos");
      setMotivo("");
      setAbierto(false);
      router.refresh();
    });

  return (
    <section aria-labelledby="titulo-tiempos" className="superficie flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 id="titulo-tiempos" className="font-semibold">
          Tiempos
        </h2>
        {puedeCorregir && (
          <Dialog
            open={abierto}
            onOpenChange={(v) => {
              setAbierto(v);
              if (v) setHoras(inicial());
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Corregir marcación
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Corregir marcación</DialogTitle>
                <DialogDescription>Deja vacía una hora para borrarla. Se guardan los valores anteriores.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-2">
                {FILAS.map(([clave, , texto]) => (
                  <Campo key={clave} id={`hora-${clave}`} etiqueta={texto}>
                    <Input
                      id={`hora-${clave}`}
                      type="time"
                      value={horas[clave]}
                      onChange={(e) => setHoras((h) => ({ ...h, [clave]: e.target.value }))}
                    />
                  </Campo>
                ))}
              </div>
              <Campo id="motivo-correccion" etiqueta="Motivo (obligatorio)">
                <Textarea id="motivo-correccion" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </Campo>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button onClick={guardar} disabled={pendiente || motivo.trim().length < 5}>
                  {pendiente ? "Guardando…" : "Guardar corrección"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <LineaTiempo
        eventos={FILAS.map(([clave, campo, texto]) => {
          const hora = tiempos[campo];
          return {
            clave,
            titulo: texto,
            detalle: hora ? formatearHora(hora) : "Sin marcar",
            icono: ICONO[clave],
            tono: TONO[clave],
            hecho: !!hora,
          };
        })}
      />
    </section>
  );
}
