import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sesionDeSolicitud } from "@/server/auth/paginas";
import { FormularioCambioPassword } from "./formulario";

// No usa paginaProtegida: debe abrirse aunque la contraseña esté pendiente de cambio.
export default async function CambiarPassword() {
  const sesion = await sesionDeSolicitud();
  if (!sesion) redirect("/login");
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        {sesion.debeCambiarPassword && (
          <CardDescription>Antes de continuar debes definir una contraseña personal.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <FormularioCambioPassword />
      </CardContent>
    </Card>
  );
}
