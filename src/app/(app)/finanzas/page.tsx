import Link from "next/link";
import { DialogoMotivo } from "@/components/formularios/dialogo-motivo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatearCOP } from "@/lib/dinero";
import { formatearFecha, hoyBogota } from "@/lib/tiempo";
import { fechaISO, uuid } from "@/lib/validacion/comunes";
import { NOMBRE_SUBTIPO, SUBTIPOS_INGRESO, type FiltroFinanzas } from "@/lib/validacion/finanzas";
import { MEDIOS_PAGO, NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { paginaProtegida } from "@/server/auth/paginas";
import { consultarFinanzas } from "@/server/finanzas/consulta";
import { listarCategoriasEgreso } from "@/server/finanzas/egresos";
import { anularMovimientoAccion } from "./acciones";
import { BotonExportar } from "./boton-exportar";

function Total({ titulo, valor, nota }: { titulo: string; valor: number; nota?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatearCOP(valor)}</p>
        {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
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
  const [r, categorias] = await Promise.all([
    consultarFinanzas(sesion, filtro, { paginar: { pagina } }),
    listarCategoriasEgreso(sesion),
  ]);
  const enlacePagina = (n: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (typeof v === "string" && k !== "pagina") q.set(k, v);
    q.set("pagina", String(n));
    return `/finanzas?${q}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Finanzas</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/finanzas/egresos/nuevo">Registrar egreso</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/finanzas/google">Conexión con Google</Link>
          </Button>
        </div>
      </div>

      <form className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
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
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1 sm:h-9">
          <input type="checkbox" name="anulados" value="1" defaultChecked={incluirAnulados} className="size-4" />
          Incluir anulados
        </label>
        <Button type="submit" variant="outline" className="col-span-2 sm:col-span-1">
          Filtrar
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Total titulo="Ingresos" valor={r.totales.ingresos} />
        <Total titulo="Egresos" valor={r.totales.egresos} />
        <Total titulo="Balance" valor={r.totales.balance} nota={incluirAnulados ? "Los anulados no suman" : undefined} />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{r.total} movimiento(s)</p>
        <BotonExportar filtro={filtro} />
      </div>

      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {r.filas.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums text-muted-foreground">{formatearFecha(f.fecha)}</span>
                <Badge variant={f.tipo === "INGRESO" ? "secondary" : "outline"}>{f.subtipoOCategoria}</Badge>
                {f.anulado && <Badge variant="destructive">Anulado</Badge>}
              </span>
              <span className={f.anulado ? "text-muted-foreground line-through" : ""}>{f.descripcion}</span>
              <span className="text-xs text-muted-foreground">
                {NOMBRE_MEDIO_PAGO[f.medioPago]} · {f.registradoPor}
                {f.pacienteOInsumo && ` · ${f.pacienteOInsumo}`}
              </span>
            </div>
            <span className={`font-medium tabular-nums ${f.anulado ? "text-muted-foreground line-through" : ""}`}>
              {f.tipo === "EGRESO" ? "−" : "+"}
              {formatearCOP(f.valor)}
            </span>
            {!f.anulado && (
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
          </li>
        ))}
        {r.filas.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted-foreground">Sin movimientos</li>}
      </ul>
      {r.paginas > 1 && (
        <nav aria-label="Páginas" className="flex items-center justify-between text-sm">
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
