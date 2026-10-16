"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { marcarAccion } from "@/app/(app)/mi-dia/acciones";
import { Button } from "@/components/ui/button";
import { formatearHora } from "@/lib/tiempo";

type Marca = "LLEGADA" | "INGRESO" | "FIN";
type Tiempos = { llegadaEn: Date | null; ingresoEn: Date | null; finEn: Date | null };

const TEXTO: Record<Marca, string> = { LLEGADA: "Llegada", INGRESO: "Ingreso a terapia", FIN: "Fin de terapia" };
const CAMPO: Record<Marca, keyof Tiempos> = { LLEGADA: "llegadaEn", INGRESO: "ingresoEn", FIN: "finEn" };

function siguiente(t: Tiempos): Marca | null {
  if (!t.llegadaEn) return "LLEGADA";
  if (!t.ingresoEn) return "INGRESO";
  if (!t.finEn) return "FIN";
  return null;
}

/**
 * Un solo botón grande con la siguiente marca (SC-004): se muestra marcada al instante
 * y vuelve atrás con un mensaje si el servidor la rechaza.
 */
export function BotonesMarcacion({
  citaId,
  inicial,
  asistida,
  tieneAtencion,
}: {
  citaId: string;
  inicial: Tiempos;
  asistida: boolean;
  tieneAtencion: boolean;
}) {
  const [tiempos, setTiempos] = useState(inicial);
  const [optimista, aplicar] = useOptimistic(tiempos, (t: Tiempos, marca: Marca) => ({
    ...t,
    [CAMPO[marca]]: new Date(),
  }));
  const [pendiente, iniciar] = useTransition();
  const proxima = siguiente(optimista);

  const marcar = (marca: Marca) =>
    iniciar(async () => {
      aplicar(marca);
      const r = await marcarAccion(citaId, marca);
      // Las actualizaciones después de un await deben volver a marcarse como transición.
      if (r.ok) iniciar(() => setTiempos(r.data.marcacion));
      else toast.error(r.mensaje);
    });

  const marcadas = (Object.keys(TEXTO) as Marca[]).filter((m) => optimista[CAMPO[m]]);
  return (
    <div className="flex flex-col gap-2">
      {proxima ? (
        <Button
          size="lg"
          className="h-12 w-full text-base sm:w-auto sm:min-w-56"
          disabled={pendiente}
          onClick={() => marcar(proxima)}
        >
          {TEXTO[proxima]}
        </Button>
      ) : (
        <p className="text-sm font-medium">Terapia terminada</p>
      )}
      {marcadas.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {marcadas.map((m) => `${TEXTO[m]} ${formatearHora(optimista[CAMPO[m]]!)}`).join(" · ")}
        </p>
      )}
      {(asistida || optimista.ingresoEn) && (
        <span className="flex flex-wrap gap-4 text-sm font-medium">
          <Link href={`/citas/${citaId}/atencion`} className="underline-offset-4 hover:underline">
            {tieneAtencion ? "Ver atención" : "Registrar atención"}
          </Link>
          <Link href={`/citas/${citaId}/cobro`} className="underline-offset-4 hover:underline">
            Registrar cobro
          </Link>
        </span>
      )}
    </div>
  );
}
