import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { puede } from "@/lib/permisos";
import { paginaProtegida } from "@/server/auth/paginas";
import { buscarPacientes, TAMANO_PAGINA_PACIENTES } from "@/server/pacientes/servicio";

export default async function Pacientes({ searchParams }: PageProps<"/pacientes">) {
  const sesion = await paginaProtegida(["pacientes:gestionar", "pacientes:consultar_propios"]);
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const pagina = Math.max(1, Number(params.pagina) || 1);
  const { filas, total } = await buscarPacientes(sesion, { q, pagina });
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_PACIENTES));
  const enlace = (p: number) => `/pacientes?${new URLSearchParams({ q, pagina: String(p) })}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Pacientes</h1>
        {puede(sesion.rol, "pacientes:gestionar") && (
          <Button asChild>
            <Link href="/pacientes/nuevo">Registrar paciente</Link>
          </Button>
        )}
      </div>
      <form className="flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por documento o nombre" aria-label="Buscar paciente" />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">{total} paciente(s)</p>
      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {filas.map((p) => (
          <li key={p.id}>
            <Link href={`/pacientes/${p.id}`} className="flex flex-col px-4 py-3 hover:bg-accent">
              <span className="font-medium">{p.nombreCompleto}</span>
              <span className="text-sm text-muted-foreground">
                Doc. {p.documento} · Tel. {p.telefono}
              </span>
            </Link>
          </li>
        ))}
        {filas.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin resultados</li>}
      </ul>
      {paginas > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
          {pagina > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={enlace(pagina - 1)}>Anterior</Link>
            </Button>
          )}
          <span className="text-sm">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Button asChild variant="outline" size="sm">
              <Link href={enlace(pagina + 1)}>Siguiente</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
