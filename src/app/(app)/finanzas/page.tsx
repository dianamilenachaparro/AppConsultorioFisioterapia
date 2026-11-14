import { ReceiptTextIcon, TrendingDownIcon, TrendingUpIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { DialogoMotivo } from "@/components/formularios/dialogo-motivo";
import { BarrasPeriodo, type BarraPeriodo } from "@/components/graficas/barras-periodo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, hoyBogota } from "@/lib/tiempo";
import { fechaISO, uuid } from "@/lib/validacion/comunes";
import { NOMBRE_SUBTIPO, SUBTIPOS_INGRESO, type FiltroFinanzas } from "@/lib/validacion/finanzas";
import { MEDIOS_PAGO, NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { paginaProtegida } from "@/server/auth/paginas";
import { consultarFinanzas, type FilaFinanzas } from "@/server/finanzas/consulta";
import { listarCategoriasEgreso } from "@/server/finanzas/egresos";
import { anularMovimientoAccion } from "./acciones";
import { BotonExportar } from "./boton-exportar";

function Total({ titulo, valor, icono: Icono, color }: { titulo: string; valor: string; icono: LucideIcon; color: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-5 sm:px-6">
      <p className="flex items-center gap-3 text-sm font-semibold">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ background: color }}>
          <Icono className="size-[1.125rem]" strokeWidth={2.2} />
        </span>
        {titulo}
      </p>
      <p className="cifra text-[1.75rem] leading-none">{valor}</p>
    </div>
  );
}

const formatoCorto = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  notation: "compact",
  maximumFractionDigits: 1,
});
const formatoDia = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short" });
const formatoMes = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", month: "short" });
const formatoMesAnio = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", month: "short", year: "numeric" });

/** Suma por día (periodos de hasta un mes) o por mes, rellenando con cero los vacíos; los anulados no suman. */
function barrasDelPeriodo(filas: FilaFinanzas[], desde: string, hasta: string, tipo: "INGRESO" | "EGRESO") {
  const inicio = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  const porDia = (fin.getTime() - inicio.getTime()) / 86_400_000 < 31;
  const clave = (iso: string) => (porDia ? iso : iso.slice(0, 7));
  const suma = new Map<string, number>();
  for (const f of filas) {
    if (f.tipo === tipo && !f.anulado) suma.set(clave(f.fecha), (suma.get(clave(f.fecha)) ?? 0) + f.valor);
  }
  const barras: BarraPeriodo[] = [];
  const d = new Date(inicio);
  if (!porDia) d.setUTCDate(1);
  while (d <= fin) {
    const valor = suma.get(clave(d.toISOString().slice(0, 10))) ?? 0;
    barras.push({
      etiqueta: porDia ? String(d.getUTCDate()) : formatoMes.format(d),
      detalle: porDia ? formatoDia.format(d) : formatoMesAnio.format(d),
      valor,
      texto: formatearCOP(valor),
      corto: formatoCorto.format(valor),
    });
    if (porDia) d.setUTCDate(d.getUTCDate() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return { barras, porDia };
}

export default async function Finanzas({ searchParams }: PageProps<"/finanzas">) {
  const sesion = await paginaProtegida("finanzas:ver");
  const p = await searchParams;
  const uno = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const hoy = hoyBogota();
  const incluirAnulados = p.anulados === "1";
  const filtro: FiltroFinanzas = {
    desde: fechaISO.safeParse(p.desde).success ? (p.desde as string) : `${hoy.slice(0, 8)}01`,
    hasta: fechaISO.safeParse(p.hasta).success ? (p.hasta as string) : hoy,
    tipo: p.tipo === "INGRESO" || p.tipo === "EGRESO" ? p.tipo : undefined,
    subtipoIngreso: SUBTIPOS_INGRESO.find((s) => s === p.subtipo),
    categoriaId: uuid.safeParse(p.categoria).success ? uno(p.categoria) : undefined,
    medioPago: MEDIOS_PAGO.find((m) => m === p.medio),
    incluirAnulados,
  };
  const pagina = Math.max(1, Number(p.pagina) || 1);
  // La gráfica necesita todos los movimientos del filtro, no solo los de la página visible.
  const [r, todo, categorias] = await Promise.all([
    consultarFinanzas(sesion, filtro, { paginar: { pagina } }),
    consultarFinanzas(sesion, { ...filtro, incluirAnulados: false }),
    listarCategoriasEgreso(sesion),
  ]);
  const tipoGrafica = filtro.tipo ?? "INGRESO";
  const grafica = barrasDelPeriodo(todo.filas, filtro.desde, filtro.hasta, tipoGrafica);
  const tituloGrafica = `${tipoGrafica === "INGRESO" ? "Ingresos" : "Egresos"} por ${grafica.porDia ? "día" : "mes"}`;
  const enlacePagina = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (typeof v === "string" && k !== "pagina") q.set(k, v);
    q.set("pagina", String(n));
    return `/finanzas?${q}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/finanzas/egresos/nuevo">Registrar egreso</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/finanzas/google">Conexión con Google</Link>
          </Button>
        </div>
      </div>

      <form className="superficie grid grid-cols-2 gap-3 p-4 sm:flex sm:flex-wrap sm:items-end sm:p-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" name="desde" type="date" defaultValue={filtro.desde} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" name="hasta" type="date" defaultValue={filtro.hasta} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-36">
          <Label htmlFor="tipo">Tipo</Label>
          <NativeSelect id="tipo" name="tipo" defaultValue={filtro.tipo ?? ""}>
            <option value="">Todos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="EGRESO">Egresos</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-44">
          <Label htmlFor="subtipo">Subtipo de ingreso</Label>
          <NativeSelect id="subtipo" name="subtipo" defaultValue={filtro.subtipoIngreso ?? ""}>
            <option value="">Todos</option>
            {SUBTIPOS_INGRESO.map((s) => (
              <option key={s} value={s}>
                {NOMBRE_SUBTIPO[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-48">
          <Label htmlFor="categoria">Categoría de egreso</Label>
          <NativeSelect id="categoria" name="categoria" defaultValue={filtro.categoriaId ?? ""}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-40">
          <Label htmlFor="medio">Medio de pago</Label>
          <NativeSelect id="medio" name="medio" defaultValue={filtro.medioPago ?? ""}>
            <option value="">Todos</option>
            {MEDIOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {NOMBRE_MEDIO_PAGO[m]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1 sm:h-10">
          <input type="checkbox" name="anulados" value="1" defaultChecked={incluirAnulados} className="size-4 accent-primary" />
          Incluir anulados
        </label>
        <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
          Filtrar
        </Button>
      </form>

      <section
        aria-label="Totales del periodo"
        className="superficie grid sm:grid-cols-3 sm:py-1 [&>*+*]:border-t sm:[&>*+*]:border-t-0 sm:[&>*+*]:border-l"
      >
        <Total titulo="Ingresos" valor={formatearCOP(r.totales.ingresos)} icono={TrendingUpIcon} color="var(--serie-3)" />
        <Total titulo="Egresos" valor={formatearCOP(r.totales.egresos)} icono={TrendingDownIcon} color="var(--serie-8)" />
        <Total titulo="Movimientos" valor={String(r.total)} icono={ReceiptTextIcon} color="var(--serie-1)" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="superficie p-5 sm:p-7">
          <BarrasPeriodo titulo={tituloGrafica} datos={grafica.barras} />
        </div>
        <section
          aria-labelledby="titulo-balance"
          className="relative isolate flex flex-col gap-3 overflow-hidden rounded-lg bg-[#0b4fd6] p-6 text-white shadow-activo sm:p-7"
        >
          <svg
            aria-hidden
            viewBox="0 0 320 300"
            preserveAspectRatio="xMaxYMax slice"
            className="absolute inset-0 -z-10 size-full"
          >
            <path d="M96 300 C 130 170, 220 118, 320 128 L320 300 Z" fill="#1f6bff" />
            <path d="M200 300 C 222 238, 268 212, 320 208 L320 300 Z" fill="#22c4ff" />
          </svg>
          <h2 id="titulo-balance" className="text-lg font-bold">
            Balance del periodo
          </h2>
          <p className="cifra text-[2.25rem] leading-none">{formatearCOP(r.totales.balance)}</p>
          <p className="max-w-[26ch] text-sm text-white/85">
            Ingresos menos egresos del {formatearFecha(filtro.desde)} al {formatearFecha(filtro.hasta)}.
            {incluirAnulados && " Los anulados no suman."}
          </p>
          <div className="mt-auto pt-6">
            <BotonExportar filtro={filtro} claro />
          </div>
        </section>
      </div>

      <section aria-labelledby="titulo-movimientos" className="superficie overflow-hidden">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3 sm:px-7 sm:pt-6">
          <h2 id="titulo-movimientos" className="text-lg font-bold">
            Movimientos
          </h2>
          <p className="text-sm text-muted-foreground">{r.total} movimiento(s)</p>
        </div>
        <div
          aria-hidden
          className="mx-5 hidden grid-cols-[6.5rem_minmax(0,1fr)_7.5rem_9rem_6.5rem] gap-x-4 border-b py-2.5 text-xs font-medium text-muted-foreground sm:mx-7 md:grid"
        >
          <span>Fecha</span>
          <span>Concepto</span>
          <span>Medio</span>
          <span className="text-right">Valor</span>
          <span className="text-right">Estado</span>
        </div>
        <ul className="flex flex-col px-2 pb-2 sm:px-4">
          {r.filas.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-3 py-3.5 text-sm transition-colors duration-150 not-last:border-b hover:bg-muted/70 md:grid md:grid-cols-[6.5rem_minmax(0,1fr)_7.5rem_9rem_6.5rem] md:gap-x-4"
            >
              <span className="tabular-nums text-muted-foreground max-md:w-full">{formatearFecha(f.fecha)}</span>
              <div className="flex min-w-0 flex-col gap-1 max-md:w-full">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={f.anulado ? "text-muted-foreground line-through" : "font-semibold"}>{f.descripcion}</span>
                  <Badge variant={f.tipo === "INGRESO" ? "exito" : "secondary"}>{f.subtipoOCategoria}</Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  <span className="md:hidden">{NOMBRE_MEDIO_PAGO[f.medioPago]} · </span>
                  {f.registradoPor}
                  {f.pacienteOInsumo && ` · ${f.pacienteOInsumo}`}
                </span>
              </div>
              <span className="text-muted-foreground max-md:hidden">{NOMBRE_MEDIO_PAGO[f.medioPago]}</span>
              <span className={`cifra max-md:mr-auto md:text-right ${f.anulado ? "text-muted-foreground line-through" : ""}`}>
                {f.tipo === "EGRESO" ? "−" : "+"}
                {formatearCOP(f.valor)}
              </span>
              <span className="flex md:justify-end">
                {f.anulado ? (
                  <Badge variant="peligro">Anulado</Badge>
                ) : (
                  <DialogoMotivo
                    textoBoton="Anular"
                    titulo="Anular movimiento"
                    descripcion="Si es una venta o reposición, también se revierte el stock."
                    textoConfirmar="Anular"
                    variante="destructive"
                    ejecutar={async (motivo) => {
                      "use server";
                      return anularMovimientoAccion(f.id, motivo);
                    }}
                    exito="Movimiento anulado"
                  />
                )}
              </span>
            </li>
          ))}
          {r.filas.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted-foreground">Sin movimientos</li>}
        </ul>
      </section>
      {r.paginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm font-semibold [&_a]:text-primary">
          {pagina > 1 ? <Link href={enlacePagina(pagina - 1)}>← Anterior</Link> : <span />}
          <span className="text-muted-foreground">
            Página {pagina} de {r.paginas}
          </span>
          {pagina < r.paginas ? <Link href={enlacePagina(pagina + 1)}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
