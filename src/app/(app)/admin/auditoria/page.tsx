import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatearFechaHora, hoyBogota, sumarDias } from "@/lib/tiempo";
import { fechaISO, uuid } from "@/lib/validacion/comunes";
import { consultarAuditoria, opcionesFiltroAuditoria } from "@/server/auditoria/consulta";
import { paginaProtegida } from "@/server/auth/paginas";

function Valores({ titulo, valores }: { titulo: string; valores: unknown }) {
  if (!valores || (typeof valores === "object" && Object.keys(valores).length === 0)) return null;
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <pre className="overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-words">
        {JSON.stringify(valores, null, 2)}
      </pre>
    </div>
  );
}

export default async function Auditoria({ searchParams }: PageProps<"/admin/auditoria">) {
  const sesion = await paginaProtegida("admin:auditoria");
  const p = await searchParams;
  const texto = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const hoy = hoyBogota();
  const desde = fechaISO.safeParse(p.desde).success ? (p.desde as string) : sumarDias(hoy, -7);
  const hasta = fechaISO.safeParse(p.hasta).success ? (p.hasta as string) : hoy;
  const usuarioId = uuid.safeParse(p.usuario).success ? (p.usuario as string) : undefined;
  const accion = texto(p.accion);
  const entidad = texto(p.entidad);
  const pagina = Math.max(1, Number(p.pagina) || 1);

  const [r, opciones] = await Promise.all([
    consultarAuditoria(sesion, { desde, hasta, usuarioId, accion, entidad, pagina }),
    opcionesFiltroAuditoria(sesion),
  ]);
  const enlacePagina = (n: number) => {
    const q = new URLSearchParams({ desde, hasta, pagina: String(n) });
    if (usuarioId) q.set("usuario", usuarioId);
    if (accion) q.set("accion", accion);
    if (entidad) q.set("entidad", entidad);
    return `/admin/auditoria?${q}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Auditoría</h1>
        <p className="text-sm text-muted-foreground">Registro de solo lectura de quién hizo qué y cuándo.</p>
      </div>
      <form className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={desde} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={hasta} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-48">
          <Label htmlFor="usuario">Usuario</Label>
          <NativeSelect id="usuario" name="usuario" defaultValue={usuarioId ?? ""}>
            <option value="">Todos</option>
            {opciones.usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombreCompleto}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <Label htmlFor="accion">Acción</Label>
          <NativeSelect id="accion" name="accion" defaultValue={accion ?? ""}>
            <option value="">Todas</option>
            {opciones.acciones.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-40">
          <Label htmlFor="entidad">Entidad</Label>
          <NativeSelect id="entidad" name="entidad" defaultValue={entidad ?? ""}>
            <option value="">Todas</option>
            {opciones.entidades.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
          Filtrar
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">{r.total} registro(s)</p>
      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {r.filas.map((f) => (
          <li key={f.id} className="px-4 py-3">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm tabular-nums text-muted-foreground">{formatearFechaHora(f.creadoEn)}</span>
                <Badge variant="secondary">{f.accion}</Badge>
                <span className="text-sm">{f.usuario}</span>
                <span className="text-xs text-muted-foreground">
                  {f.entidad} · {f.entidadId.slice(0, 8)}
                </span>
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {f.motivo && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Motivo: </span>
                    {f.motivo}
                  </p>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Valores titulo="Antes" valores={f.antes} />
                  <Valores titulo="Después" valores={f.despues} />
                </div>
              </div>
            </details>
          </li>
        ))}
        {r.filas.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin registros</li>}
      </ul>
      {r.paginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
          {r.pagina > 1 ? <Link href={enlacePagina(r.pagina - 1)}>← Anterior</Link> : <span />}
          <span className="text-muted-foreground">
            Página {r.pagina} de {r.paginas}
          </span>
          {r.pagina < r.paginas ? <Link href={enlacePagina(r.pagina + 1)}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
