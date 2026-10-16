import Link from "next/link";
import { EtiquetaStockBajo } from "@/components/inventario/etiqueta-stock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatearCOP } from "@/lib/dinero";
import { puede } from "@/lib/permisos";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarInsumos } from "@/server/inventario/servicio";

export default async function Insumos() {
  const sesion = await paginaProtegida(["inventario:gestionar", "inventario:vender"]);
  const gestiona = puede(sesion.rol, "inventario:gestionar");
  const insumos = await listarInsumos(sesion);
  const bajos = insumos.filter((i) => i.activo && i.bajoMinimo).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Insumos</h1>
          {bajos > 0 && (
            <p className="text-sm text-muted-foreground">
              {bajos} insumo(s) por debajo del stock mínimo
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/insumos/venta">Vender</Link>
          </Button>
          {gestiona && (
            <Button asChild variant="outline">
              <Link href="/insumos/nuevo">Nuevo insumo</Link>
            </Button>
          )}
        </div>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {insumos.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                {gestiona ? (
                  <Link href={`/insumos/${i.id}`} className="font-medium underline-offset-4 hover:underline">
                    {i.nombre}
                  </Link>
                ) : (
                  <span className="font-medium">{i.nombre}</span>
                )}
                {i.bajoMinimo && i.activo && <EtiquetaStockBajo />}
                {!i.activo && <Badge variant="secondary">Inactivo</Badge>}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatearCOP(i.precioVenta)} · Stock {i.stock} · Mínimo {i.stockMinimo}
              </span>
            </div>
            <div className="flex gap-2">
              {i.activo && i.stock > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/insumos/venta?insumo=${i.id}`}>Vender</Link>
                </Button>
              )}
              {gestiona && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/insumos/${i.id}/reponer`}>Reponer</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
        {insumos.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">Aún no hay insumos registrados</li>
        )}
      </ul>
    </div>
  );
}
