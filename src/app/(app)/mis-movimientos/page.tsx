import { redirect } from "next/navigation";
import { DialogoMotivo } from "@/components/formularios/dialogo-motivo";
import { Badge } from "@/components/ui/badge";
import { formatearCOP } from "@/lib/dinero";
import { formatearFechaLarga, formatearHora, hoyBogota } from "@/lib/tiempo";
import { NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarMisMovimientosHoy } from "@/server/finanzas/mis-movimientos";
import { anularMiMovimientoAccion } from "./acciones";

const NOMBRE_SUBTIPO = { TERAPIA: "Cobro de terapia", VENTA_INSUMOS: "Venta de insumos" } as const;

/** Lo que registré hoy, sin totales ni sumas (FR-041). El Dueño usa /finanzas. */
export default async function MisMovimientos() {
  const sesion = await paginaProtegida(["movimientos:ver_propios_hoy", "finanzas:ver"]);
  if (sesion.rol === "DUENO") redirect("/finanzas");
  const movimientos = await listarMisMovimientosHoy(sesion);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Mis movimientos de hoy</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{formatearFechaLarga(hoyBogota())}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Puedes anular lo que registraste hoy. Para corregir algo de otro día, solicítalo al Dueño.
      </p>
      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {movimientos.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className={m.anulado ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                  {m.subtipo ? NOMBRE_SUBTIPO[m.subtipo] : "Egreso"}
                </span>
                {m.anulado && <Badge variant="destructive">Anulado</Badge>}
              </span>
              <span className="text-sm">{m.descripcion}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatearHora(m.creadoEn)} · {formatearCOP(m.valor)} · {NOMBRE_MEDIO_PAGO[m.medioPago]}
              </span>
              {m.anulado && m.motivoAnulacion && (
                <span className="text-xs text-muted-foreground">Motivo: {m.motivoAnulacion}</span>
              )}
            </div>
            {m.anulable && (
              <DialogoMotivo
                textoBoton="Anular"
                titulo="Anular movimiento"
                descripcion="Si es una venta, el stock del insumo se repone."
                textoConfirmar="Anular"
                variante="destructive"
                ejecutar={async (motivo) => {
                  "use server";
                  return anularMiMovimientoAccion(m.id, motivo);
                }}
                exito="Movimiento anulado"
              />
            )}
          </li>
        ))}
        {movimientos.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Hoy no has registrado cobros ni ventas</li>
        )}
      </ul>
    </div>
  );
}
