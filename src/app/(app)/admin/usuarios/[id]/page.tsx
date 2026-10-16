import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorDominio } from "@/lib/resultado";
import { formatearFechaHora } from "@/lib/tiempo";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerUsuario } from "@/server/usuarios/servicio";
import { FormularioUsuario } from "../formulario-usuario";
import { AccionesUsuario } from "./acciones-usuario";

export default async function DetalleUsuario({ params }: PageProps<"/admin/usuarios/[id]">) {
  const sesion = await paginaProtegida("admin:usuarios");
  const { id } = await params;
  let usuario;
  try {
    usuario = await obtenerUsuario(sesion, id);
  } catch (e) {
    if (e instanceof ErrorDominio && e.codigo === "NO_ENCONTRADO") notFound();
    throw e;
  }
  const bloqueado = usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Link href="/admin/usuarios" className="text-sm underline-offset-4 hover:underline">
        ← Usuarios
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{usuario.nombreCompleto}</h1>
        {!usuario.activo && <Badge variant="destructive">Inactivo</Badge>}
        {bloqueado && <Badge variant="destructive">Bloqueado hasta {formatearFechaHora(usuario.bloqueadoHasta!)}</Badge>}
      </div>
      <AccionesUsuario id={usuario.id} nombre={usuario.nombreCompleto} activo={usuario.activo} />
      <Card>
        <CardContent>
          <FormularioUsuario key={`${usuario.rol}-${usuario.atiendePacientes}-${usuario.nombreCompleto}`} usuario={usuario} />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Creado el {formatearFechaHora(usuario.creadoEn)}</p>
    </div>
  );
}
