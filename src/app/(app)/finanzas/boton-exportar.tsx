"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Fallo } from "@/lib/resultado";
import { cn } from "@/lib/utils";
import type { FiltroFinanzas } from "@/lib/validacion/finanzas";
import { exportarAccion } from "./acciones";

/** `claro`: botón blanco y textos claros, para ir sobre la tarjeta azul del balance. */
export function BotonExportar({ filtro, claro = false }: { filtro: FiltroFinanzas; claro?: boolean }) {
  const [pendiente, iniciar] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<Fallo | null>(null);

  const exportar = () =>
    iniciar(async () => {
      setUrl(null);
      setError(null);
      const r = await exportarAccion(filtro);
      if (r.ok) setUrl(r.data.urlHoja);
      else setError(r);
    });

  return (
    <div className={cn("flex flex-col items-start gap-1.5", claro && "items-stretch text-white")}>
      <Button
        variant="outline"
        onClick={exportar}
        disabled={pendiente}
        className={cn(claro && "h-12 rounded-md border-0 bg-white text-[#0b4fd6] hover:bg-white/90 hover:text-[#0b4fd6]")}
      >
        {pendiente ? "Exportando…" : "Exportar a Google Sheets"}
      </Button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline-offset-4 hover:underline">
          Abrir hoja ↗
        </a>
      )}
      {error && (
        <p role="alert" className={cn("text-sm", claro ? "font-medium text-white" : "text-destructive")}>
          {error.mensaje}{" "}
          {error.error === "ERROR_GOOGLE" && (
            <Link href="/finanzas/google" className="underline">
              Conexión con Google
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
