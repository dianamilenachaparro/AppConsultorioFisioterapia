import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorDominio } from "@/lib/resultado";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerInsumo } from "@/server/inventario/servicio";
import { FormularioReposicion } from "../../formulario-movimiento";

export default async function ReponerInsumo({ params }: PageProps<"/insumos/[id]/reponer">) {
  const sesion = await paginaProtegida("inventario:gestionar");
  const { id } = await params;
  let insumo;
  try {
    insumo = await obtenerInsumo(sesion, id);
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === "NO_ENCONTRADO") notFound();
    throw e;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <Link href={`/insumos/${id}`} className="text-sm underline-offset-4 hover:underline">
        ← {insumo.nombre}
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Reponer {insumo.nombre}</h1>
        <p className="text-sm text-muted-foreground">Stock actual: {insumo.stock}. Se registrará como egreso “Compra de insumos”.</p>
      </div>
      <Card>
        <CardContent>
          <FormularioReposicion insumo={insumo} />
        </CardContent>
      </Card>
    </div>
  );
}
