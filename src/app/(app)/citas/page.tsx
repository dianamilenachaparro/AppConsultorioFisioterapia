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
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Citas</h1>
      <form className="superficie grid gap-3 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-6 lg:items-end">
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

      <section aria-label="Resultados" className="superficie overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 pt-5 pb-3 text-sm sm:px-7 sm:pt-6">
          <span className="mr-2 text-lg font-bold">Total: {total}</span>
          <span className="rounded-full bg-info-suave px-3 py-1 font-semibold text-info">Programadas: {conteos.PROGRAMADA}</span>
          <span className="rounded-full bg-exito-suave px-3 py-1 font-semibold text-exito">Asistidas: {conteos.ASISTIDA}</span>
          <span className="rounded-full bg-peligro-suave px-3 py-1 font-semibold text-peligro">Canceladas: {conteos.CANCELADA}</span>
        </div>
        <div
          aria-hidden
          className="mx-5 hidden grid-cols-[14rem_minmax(0,1fr)_minmax(0,1.3fr)_7.5rem] gap-x-4 border-b py-2.5 text-xs font-medium text-muted-foreground sm:mx-7 md:grid"
        >
          <span>Fecha y hora</span>
          <span>Paciente</span>
          <span>Profesional y consultorio</span>
          <span className="text-right">Estado</span>
        </div>
        <ul className="flex flex-col px-2 pb-2 sm:px-4">
          {filas.map((c) => (
            <li key={c.id} className="not-last:border-b">
              <Link
                href={`/citas/${c.id}`}
                className="flex flex-col gap-1 rounded-md px-3 py-3.5 text-sm transition-colors duration-150 hover:bg-muted/70 md:grid md:grid-cols-[14rem_minmax(0,1fr)_minmax(0,1.3fr)_7.5rem] md:items-center md:gap-x-4"
              >
                <span className="font-semibold tabular-nums">
                  {formatearFecha(c.inicio)} · {formatearHora(c.inicio)}–{formatearHora(c.fin)}
                </span>
                <span className="font-semibold md:truncate">{c.paciente.nombreCompleto}</span>
                <span className="text-muted-foreground md:truncate">
                  {c.profesional.nombreCompleto} · {c.consultorio.nombre} · {NOMBRE_ZONA[c.zonaCorporal]}
                </span>
                <span className="flex flex-wrap gap-1 md:justify-end">
                  <EtiquetaEstado estado={c.estado} />
                  {c.retroactiva && <EtiquetaRetroactiva />}
                </span>
              </Link>
            </li>
          ))}
          {filas.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Sin citas</li>}
        </ul>
      </section>

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
