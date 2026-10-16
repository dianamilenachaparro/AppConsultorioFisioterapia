import { Card, CardContent } from "@/components/ui/card";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarInsumos } from "@/server/inventario/servicio";
import { FormularioVenta } from "../formulario-movimiento";

export default async function VentaInsumo({ searchParams }: PageProps<"/insumos/venta">) {
  const sesion = await paginaProtegida("inventario:vender");
  const { insumo } = await searchParams;
  const disponibles = (await listarInsumos(sesion)).filter((i) => i.activo && i.stock > 0);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <h1 className="text-xl font-semibold">Vender insumo</h1>
      <Card>
        <CardContent>
          {disponibles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay insumos con stock disponible.</p>
          ) : (
            <FormularioVenta
              insumos={disponibles}
              inicial={typeof insumo === "string" && disponibles.some((i) => i.id === insumo) ? insumo : undefined}
              enlaceMovimientos={sesion.rol === "DUENO" ? "/finanzas" : "/mis-movimientos"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
