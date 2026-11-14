import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { puede } from "@/lib/permisos";
import { iniciales } from "@/lib/utils";
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
        {puede(sesion.rol, "pacientes:gestionar") && (
          <Button asChild>
            <Link href="/pacientes/nuevo">Registrar paciente</Link>
          </Button>
        )}
      </div>
      <form className="superficie flex gap-2 p-3 sm:p-4" role="search">
        <Input name="q" defaultValue={q} placeholder="Buscar por documento o nombre" aria-label="Buscar paciente" />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
      <section aria-label="Resultados" className="superficie overflow-hidden">
        <p className="px-5 pt-5 pb-3 text-sm text-muted-foreground sm:px-7 sm:pt-6">{total} paciente(s)</p>
        <ul className="flex flex-col px-2 pb-2 sm:px-4">
          {filas.map((p) => (
            <li key={p.id} className="not-last:border-b">
              <Link
                href={`/pacientes/${p.id}`}
                className="flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-150 hover:bg-muted/70"
              >
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
                >
                  {iniciales(p.nombreCompleto)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{p.nombreCompleto}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    Doc. {p.documento} · Tel. {p.telefono}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {filas.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Sin resultados</li>}
        </ul>
      </section>
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
