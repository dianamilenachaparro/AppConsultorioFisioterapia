"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { Fallo } from "@/lib/resultado";
import type { FiltroFinanzas } from "@/lib/validacion/finanzas";
import { exportarAccion } from "./acciones";

export function BotonExportar({ filtro }: { filtro: FiltroFinanzas }) {
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
    <div className="flex flex-col items-start gap-1">
      <Button variant="outline" onClick={exportar} disabled={pendiente}>
        {pendiente ? "Exportando…" : "Exportar a Google Sheets"}
      </Button>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline-offset-4 hover:underline">
          Abrir hoja ↗
        </a>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
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
