import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonEstado } from "@/components/formularios/boton-estado";
import { DialogoMotivo } from "@/components/formularios/dialogo-motivo";
import { EtiquetaStockBajo } from "@/components/inventario/etiqueta-stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatearCOP } from "@/lib/dinero";
import { ErrorDominio } from "@/lib/resultado";
import { fechaDeColumnaDate, formatearFecha } from "@/lib/tiempo";
import { NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarMovimientosInsumo, obtenerInsumo } from "@/server/inventario/servicio";
import { anularMovimientoInventarioAccion, editarInsumoAccion } from "../acciones";
import { FormularioInsumo } from "../formulario-insumo";

const NOMBRE_TIPO = { AJUSTE_INICIAL: "Stock inicial", VENTA: "Venta", REPOSICION: "Reposición" } as const;

export default async function DetalleInsumo({ params }: PageProps<"/insumos/[id]">) {
  const sesion = await paginaProtegida("inventario:gestionar");
  const { id } = await params;
  let insumo;
  try {
    insumo = await obtenerInsumo(sesion, id);
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === "NO_ENCONTRADO") notFound();
    throw e;
  }
  const movimientos = await listarMovimientosInsumo(sesion, id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/insumos" className="text-sm underline-offset-4 hover:underline">
        ← Insumos
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{insumo.nombre}</h1>
        {insumo.bajoMinimo && insumo.activo && <EtiquetaStockBajo />}
        {!insumo.activo && <Badge variant="secondary">Inactivo</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm tabular-nums">
          Stock actual: <strong>{insumo.stock}</strong> · Mínimo {insumo.stockMinimo}
        </p>
        <Button asChild size="sm">
          <Link href={`/insumos/${id}/reponer`}>Reponer</Link>
        </Button>
        <BotonEstado
          activo={insumo.activo}
          nombre={insumo.nombre}
          cambiar={async (activo) => {
            "use server";
            return editarInsumoAccion(id, { activo });
          }}
        />
      </div>
      <Card>
        <CardContent>
          <FormularioInsumo key={`${insumo.nombre}-${insumo.costo}-${insumo.precioVenta}-${insumo.stockMinimo}`} insumo={insumo} />
        </CardContent>
      </Card>

      <section aria-labelledby="titulo-movimientos" className="flex flex-col gap-2">
        <h2 id="titulo-movimientos" className="font-medium">
          Movimientos
        </h2>
        <ul className="flex flex-col divide-y rounded-lg border bg-background">
          {movimientos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="tabular-nums text-muted-foreground">{formatearFecha(fechaDeColumnaDate(m.fecha))}</span>
              <span className={m.anulado ? "font-medium text-muted-foreground line-through" : "font-medium"}>
                {NOMBRE_TIPO[m.tipo]} {m.tipo === "VENTA" ? "−" : "+"}
                {m.cantidad}
              </span>
              {m.financiero && (
                <span className="tabular-nums">
                  {formatearCOP(m.financiero.valor)} · {NOMBRE_MEDIO_PAGO[m.financiero.medioPago]}
                </span>
              )}
              <span className="text-muted-foreground">{m.creadoPor.nombreCompleto}</span>
              {m.anulado ? (
                <Badge variant="destructive" className="ml-auto" title={m.motivoAnulacion ?? undefined}>
                  Anulado
                </Badge>
              ) : (
                m.tipo !== "AJUSTE_INICIAL" && (
                  <span className="ml-auto">
                    <DialogoMotivo
                      textoBoton="Anular"
                      titulo={`Anular ${NOMBRE_TIPO[m.tipo].toLowerCase()}`}
                      descripcion="Se revierte el stock y se anula el movimiento financiero."
                      textoConfirmar="Anular"
                      variante="destructive"
                      ejecutar={async (motivo) => {
                        "use server";
                        return anularMovimientoInventarioAccion(id, m.id, motivo);
                      }}
                      exito="Movimiento anulado"
                    />
                  </span>
                )
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
