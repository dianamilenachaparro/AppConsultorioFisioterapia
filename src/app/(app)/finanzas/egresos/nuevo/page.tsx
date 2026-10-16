import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { hoyBogota } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarCategoriasEgreso } from "@/server/finanzas/egresos";
import { FormularioEgreso } from "./formulario-egreso";

export default async function NuevoEgreso() {
  const sesion = await paginaProtegida("finanzas:egresos");
  const categorias = await listarCategoriasEgreso(sesion);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/finanzas" className="text-sm underline-offset-4 hover:underline">
        ← Finanzas
      </Link>
      <h1 className="text-xl font-semibold">Registrar egreso</h1>
      <Card>
        <CardContent>
          <FormularioEgreso categorias={categorias} hoy={hoyBogota()} />
        </CardContent>
      </Card>
    </div>
  );
}
