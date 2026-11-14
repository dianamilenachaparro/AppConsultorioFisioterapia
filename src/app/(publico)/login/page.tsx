import { SimboloMarca } from "@/components/navegacion/marca";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioLogin } from "./formulario-login";

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { siguiente } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center bg-lienzo px-4 py-10">
      <Card className="w-full max-w-sm [--card-spacing:--spacing(6)] sm:[--card-spacing:--spacing(8)]">
        <CardHeader className="gap-2">
          <SimboloMarca className="mb-3 size-11" />
          <CardTitle className="text-2xl font-bold tracking-tight">Consultorio</CardTitle>
          <CardDescription>Ingresa con tu número de cédula y tu contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioLogin siguiente={typeof siguiente === "string" ? siguiente : undefined} />
        </CardContent>
      </Card>
    </main>
  );
}
