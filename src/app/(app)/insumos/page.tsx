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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Insumos</h1>
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
      <section aria-label="Inventario" className="superficie overflow-hidden pt-3">
        <div
          aria-hidden
          className="mx-5 hidden grid-cols-[minmax(0,1fr)_8rem_5rem_5rem_12rem] gap-x-4 border-b py-2.5 text-xs font-medium text-muted-foreground sm:mx-7 md:grid"
        >
          <span>Insumo</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Stock</span>
          <span className="text-right">Mínimo</span>
          <span />
        </div>
        <ul className="flex flex-col px-2 pb-2 sm:px-4">
          {insumos.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md px-3 py-3.5 transition-colors duration-150 not-last:border-b hover:bg-muted/70 md:grid md:grid-cols-[minmax(0,1fr)_8rem_5rem_5rem_12rem]"
            >
              <span className="flex min-w-0 flex-wrap items-center gap-2 max-md:w-full">
                {gestiona ? (
                  <Link href={`/insumos/${i.id}`} className="font-semibold underline-offset-4 hover:text-primary hover:underline">
                    {i.nombre}
                  </Link>
                ) : (
                  <span className="font-semibold">{i.nombre}</span>
                )}
                {i.bajoMinimo && i.activo && <EtiquetaStockBajo />}
                {!i.activo && <Badge variant="secondary">Inactivo</Badge>}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums md:hidden">
                {formatearCOP(i.precioVenta)} · Stock {i.stock} · Mínimo {i.stockMinimo}
              </span>
              <span className="cifra text-right text-sm max-md:hidden">{formatearCOP(i.precioVenta)}</span>
              <span className={`cifra text-right text-sm max-md:hidden ${i.bajoMinimo && i.activo ? "text-aviso" : ""}`}>
                {i.stock}
              </span>
              <span className="text-right text-sm text-muted-foreground tabular-nums max-md:hidden">{i.stockMinimo}</span>
              <span className="flex gap-2 md:justify-end">
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
              </span>
            </li>
          ))}
          {insumos.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">Aún no hay insumos registrados</li>
          )}
        </ul>
      </section>
    </div>
  );
}
