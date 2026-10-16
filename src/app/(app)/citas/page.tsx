import Link from "next/link";
import { EtiquetaEstado, EtiquetaRetroactiva, NOMBRE_ESTADO } from "@/components/agenda/etiquetas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatearFecha, formatearHora, hoyBogota } from "@/lib/tiempo";
import { NOMBRE_ZONA } from "@/lib/validacion/cita";
import { paginaProtegida } from "@/server/auth/paginas";
import { filtroCitasSchema, listarCitas, TAMANO_PAGINA_CITAS } from "@/server/citas/listar";
import { listarConsultoriosActivos } from "@/server/consultorios/consulta";
import { listarProfesionalesAsignables } from "@/server/usuarios/profesionales";

const texto = (v: string | string[] | undefined) => (typeof v === "string" && v ? v : undefined);

export default async function Citas({ searchParams }: PageProps<"/citas">) {
  const sesion = await paginaProtegida("citas:listar");
  const p = await searchParams;
  const hoy = hoyBogota();
  const parsed = filtroCitasSchema.safeParse({
    desde: texto(p.desde) ?? hoy,
    hasta: texto(p.hasta) ?? hoy,
    consultorioId: texto(p.consultorio),
    profesionalId: texto(p.profesional),
    estado: texto(p.estado),
    pagina: texto(p.pagina) ?? 1,
  });
  const filtro = parsed.success ? parsed.data : { desde: hoy, hasta: hoy, pagina: 1 };
  const esProfesional = sesion.rol === "PROFESIONAL";

  const [{ filas, total, conteos }, consultorios, profesionales] = await Promise.all([
    listarCitas(sesion, filtro),
    listarConsultoriosActivos(),
    esProfesional ? Promise.resolve([]) : listarProfesionalesAsignables(),
  ]);
  const paginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_CITAS));
  const qs = (pagina: number) => {
    const q = new URLSearchParams();
    q.set("desde", filtro.desde);
    q.set("hasta", filtro.hasta);
    if ("consultorioId" in filtro && filtro.consultorioId) q.set("consultorio", filtro.consultorioId);
    if ("profesionalId" in filtro && filtro.profesionalId) q.set("profesional", filtro.profesionalId);
    if ("estado" in filtro && filtro.estado) q.set("estado", filtro.estado);
    q.set("pagina", String(pagina));
    return `/citas?${q}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Citas</h1>
      <form className="grid gap-3 rounded-lg border bg-background p-3 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={filtro.desde} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={filtro.hasta} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="consultorio">Consultorio</Label>
          <NativeSelect id="consultorio" name="consultorio" defaultValue={texto(p.consultorio) ?? ""}>
            <option value="">Todos</option>
            {consultorios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
        {!esProfesional && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profesional">Profesional</Label>
            <NativeSelect id="profesional" name="profesional" defaultValue={texto(p.profesional) ?? ""}>
              <option value="">Todos</option>
              {profesionales.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nombreCompleto}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="estado">Estado</Label>
          <NativeSelect id="estado" name="estado" defaultValue={texto(p.estado) ?? ""}>
            <option value="">Todos</option>
            {(["PROGRAMADA", "ASISTIDA", "CANCELADA"] as const).map((e) => (
              <option key={e} value={e}>
                {NOMBRE_ESTADO[e]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">Filtrar</Button>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-background px-2 py-1 font-medium">Total: {total}</span>
        <span className="rounded-md bg-background px-2 py-1">Programadas: {conteos.PROGRAMADA}</span>
        <span className="rounded-md bg-background px-2 py-1">Asistidas: {conteos.ASISTIDA}</span>
        <span className="rounded-md bg-background px-2 py-1">Canceladas: {conteos.CANCELADA}</span>
      </div>

      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {filas.map((c) => (
          <li key={c.id}>
            <Link href={`/citas/${c.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-accent">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {formatearFecha(c.inicio)} · {formatearHora(c.inicio)}–{formatearHora(c.fin)}
                </span>
                <EtiquetaEstado estado={c.estado} />
                {c.retroactiva && <EtiquetaRetroactiva />}
              </span>
              <span className="text-sm">{c.paciente.nombreCompleto}</span>
              <span className="text-sm text-muted-foreground">
                {c.profesional.nombreCompleto} · {c.consultorio.nombre} · {NOMBRE_ZONA[c.zonaCorporal]}
              </span>
            </Link>
          </li>
        ))}
        {filas.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin citas</li>}
      </ul>

      {paginas > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
          {filtro.pagina > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={qs(filtro.pagina - 1)}>Anterior</Link>
            </Button>
          )}
          <span className="text-sm">
            Página {filtro.pagina} de {paginas}
          </span>
          {filtro.pagina < paginas && (
            <Button asChild variant="outline" size="sm">
              <Link href={qs(filtro.pagina + 1)}>Siguiente</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
