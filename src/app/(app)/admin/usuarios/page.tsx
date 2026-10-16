import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NOMBRE_ROL } from "@/lib/permisos";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarUsuarios } from "@/server/usuarios/servicio";

export default async function Usuarios() {
  const sesion = await paginaProtegida("admin:usuarios");
  const usuarios = await listarUsuarios(sesion);
  const ahora = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <Button asChild>
          <Link href="/admin/usuarios/nuevo">Nuevo usuario</Link>
        </Button>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {usuarios.map((u) => (
          <li key={u.id}>
            <Link
              href={`/admin/usuarios/${u.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-accent"
            >
              <span className={u.activo ? "font-medium" : "font-medium text-muted-foreground"}>{u.nombreCompleto}</span>
              <span className="text-sm text-muted-foreground tabular-nums">{u.cedula}</span>
              <span className="flex flex-wrap gap-1 sm:ml-auto">
                <Badge variant="secondary">{NOMBRE_ROL[u.rol]}</Badge>
                {u.atiendePacientes && <Badge variant="outline">Atiende</Badge>}
                {!u.activo && <Badge variant="destructive">Inactivo</Badge>}
                {u.bloqueadoHasta && u.bloqueadoHasta > ahora && <Badge variant="destructive">Bloqueado</Badge>}
                {u.debeCambiarPassword && <Badge variant="outline">Clave temporal</Badge>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
