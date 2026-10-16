import { Card, CardContent } from "@/components/ui/card";
import { paginaProtegida } from "@/server/auth/paginas";
import { FormularioInsumo } from "../formulario-insumo";

export default async function NuevoInsumo() {
  await paginaProtegida("inventario:gestionar");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Nuevo insumo</h1>
      <Card>
        <CardContent>
          <FormularioInsumo />
        </CardContent>
      </Card>
    </div>
  );
}
