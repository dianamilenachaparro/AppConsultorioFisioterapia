import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormularioLogin } from "./formulario-login";

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { siguiente } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Consultorio</CardTitle>
          <CardDescription>Ingresa con tu número de cédula y tu contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioLogin siguiente={typeof siguiente === "string" ? siguiente : undefined} />
        </CardContent>
      </Card>
    </main>
  );
}
