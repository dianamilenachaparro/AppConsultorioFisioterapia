import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatearFechaHora } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { exigirSesion } from "@/server/auth/sesion";
import { desconectarGoogle, obtenerConexion } from "@/server/google/oauth";

const MENSAJES: Record<string, string> = {
  cancelado: "Se canceló la conexión en Google.",
  estado: "La solicitud de conexión no es válida o expiró. Intenta de nuevo.",
  google: "Google no respondió como se esperaba. Intenta de nuevo en unos minutos.",
};

async function desconectar() {
  "use server";
  await desconectarGoogle(await exigirSesion());
  revalidatePath("/finanzas/google");
}

export default async function ConexionGoogle({ searchParams }: PageProps<"/finanzas/google">) {
  const sesion = await paginaProtegida("finanzas:exportar");
  const p = await searchParams;
  const conexion = await obtenerConexion(sesion);
  const error = typeof p.error === "string" ? MENSAJES[p.error] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <Link href="/finanzas" className="text-sm underline-offset-4 hover:underline">
        ← Finanzas
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Conexión con Google</h1>
        <p className="text-sm text-muted-foreground">
          Se usa solo para crear hojas de Google Sheets con el historial financiero. La aplicación solo puede ver los archivos que ella misma crea en tu Drive.
        </p>
      </div>
      {p.conectado === "1" && (
        <p role="status" className="text-sm font-medium text-green-700 dark:text-green-400">
          Cuenta conectada.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Card>
        <CardContent className="flex flex-col gap-3">
          {conexion ? (
            <>
              <p>
                Conectado como <strong>{conexion.emailGoogle}</strong>
              </p>
              <p className="text-xs text-muted-foreground">Desde {formatearFechaHora(conexion.conectadoEn)}</p>
              <form action={desconectar}>
                <Button type="submit" variant="outline">
                  Desconectar
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm">No hay ninguna cuenta de Google conectada.</p>
              <Button asChild className="self-start">
                {/* Ruta API: navegación completa, no del lado del cliente. */}
                <a href="/api/google/oauth/iniciar">Conectar cuenta de Google</a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
