import { Card, CardContent } from "@/components/ui/card";
import { paginaProtegida } from "@/server/auth/paginas";
import { FormularioUsuario } from "../formulario-usuario";

export default async function NuevoUsuario() {
  await paginaProtegida("admin:usuarios");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Nuevo usuario</h1>
      <Card>
        <CardContent>
          <FormularioUsuario />
        </CardContent>
      </Card>
    </div>
  );
}
