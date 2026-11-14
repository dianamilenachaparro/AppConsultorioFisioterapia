import {
  AlarmClockIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarXIcon,
  CircleCheckIcon,
  HourglassIcon,
  TimerIcon,
  type LucideIcon,
} from "lucide-react";
import { puede } from "@/lib/permisos";
import { formatearFecha, hoyBogota } from "@/lib/tiempo";
import { fechaISO, uuid } from "@/lib/validacion/comunes";
import { paginaProtegida } from "@/server/auth/paginas";
import { listarConsultoriosActivos } from "@/server/consultorios/consulta";
import { TOLERANCIA_A_TIEMPO_MIN } from "@/server/indicadores/calculo";
import { obtenerIndicadores, PERIODOS } from "@/server/indicadores/consulta";
import { listarProfesionalesAsignables } from "@/server/usuarios/profesionales";
import { FiltrosIndicadores } from "./filtros";

const decimal = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

const basado = (n: number) => (n === 1 ? "1 cita" : `${n} citas`);

/** Una métrica dentro de la tarjeta ancha: ícono de color, cifra grande y cuántas citas la sustentan. */
function Dato({
  titulo,
  valor,
  unidad,
  nota,
  muestras,
  icono: Icono,
  color,
}: {
  titulo: string;
  valor: number | null;
  unidad?: string;
  nota: string;
  muestras: number;
  icono: LucideIcon;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-5 sm:px-6 lg:py-6">
      <p className="flex items-center gap-3 text-sm font-semibold">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full text-white"
          style={{ background: color }}
        >
          <Icono className="size-[1.125rem]" strokeWidth={2.2} />
        </span>
        {titulo}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="cifra text-[2rem] leading-none">
          {valor === null ? "—" : decimal.format(valor)}
          {valor !== null && unidad && (
            <span className="ml-1 text-lg font-semibold text-muted-foreground">{unidad}</span>
          )}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[0.72rem] font-semibold text-muted-foreground tabular-nums">
          {basado(muestras)}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">{nota}</p>
    </div>
  );
}

const CONTEOS: [string, "programadas" | "asistidas" | "canceladas", LucideIcon, string][] = [
  ["Programadas", "programadas", CalendarClockIcon, "bg-info-suave text-info"],
  ["Asistidas", "asistidas", CalendarCheckIcon, "bg-exito-suave text-exito"],
  ["Canceladas", "canceladas", CalendarXIcon, "bg-peligro-suave text-peligro"],
];

export default async function Indicadores({ searchParams }: PageProps<"/indicadores">) {
  const sesion = await paginaProtegida(["indicadores:ver_todos", "indicadores:ver_propios"]);
  const params = await searchParams;
  const texto = (v: unknown) => (typeof v === "string" ? v : undefined);
  const periodo = PERIODOS.find((p) => p === params.periodo) ?? "SEMANA";
  const fecha = fechaISO.safeParse(params.fecha).success ? (params.fecha as string) : hoyBogota();
  const verTodos = puede(sesion.rol, "indicadores:ver_todos");
  const profesional = verTodos && uuid.safeParse(params.profesional).success ? texto(params.profesional) : undefined;
  const consultorio = uuid.safeParse(params.consultorio).success ? texto(params.consultorio) : undefined;

  const [r, consultorios, profesionales] = await Promise.all([
    obtenerIndicadores(sesion, { periodo, fecha, profesionalId: profesional, consultorioId: consultorio }),
    listarConsultoriosActivos(),
    verTodos ? listarProfesionalesAsignables() : Promise.resolve(undefined),
  ]);
  const hasta = new Date(r.rango.hasta.getTime() - 1);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{verTodos ? "Indicadores" : "Mis indicadores"}</h1>
        <p className="text-sm text-muted-foreground">
          {formatearFecha(r.rango.desde)}
          {periodo !== "DIA" && ` – ${formatearFecha(hasta)}`}
        </p>
      </div>
      <FiltrosIndicadores
        filtro={{ periodo, fecha, profesional, consultorio }}
        profesionales={profesionales?.map((p) => ({ id: p.id, nombre: p.nombreCompleto }))}
        consultorios={consultorios}
      />
      <section
        aria-label="Tiempos de atención"
        className="superficie grid sm:grid-cols-2 lg:grid-cols-4 lg:py-1 [&>*+*]:border-t sm:[&>*:nth-child(2)]:border-t-0 sm:[&>*:nth-child(even)]:border-l lg:[&>*+*]:border-t-0 lg:[&>*+*]:border-l"
      >
        <Dato
          titulo="Espera promedio"
          valor={r.esperaPromedioMin}
          unidad="min"
          nota="De la llegada al ingreso a terapia."
          muestras={r.muestras.espera}
          icono={HourglassIcon}
          color="var(--serie-2)"
        />
        <Dato
          titulo="Duración real promedio"
          valor={r.duracionRealPromedioMin}
          unidad="min"
          nota="Del ingreso al fin de la terapia."
          muestras={r.muestras.duracion}
          icono={TimerIcon}
          color="var(--serie-3)"
        />
        <Dato
          titulo="Retraso promedio"
          valor={r.retrasoPromedioMin}
          unidad="min"
          nota="Ingreso frente a la hora programada."
          muestras={r.muestras.puntualidad}
          icono={AlarmClockIcon}
          color="var(--serie-8)"
        />
        <Dato
          titulo="Iniciadas a tiempo"
          valor={r.porcentajeATiempo}
          unidad="%"
          nota={`Hasta ${TOLERANCIA_A_TIEMPO_MIN} min de retraso.`}
          muestras={r.muestras.puntualidad}
          icono={CircleCheckIcon}
          color="var(--serie-1)"
        />
      </section>
      <section aria-label="Citas del periodo" className="grid gap-4 sm:grid-cols-3">
        {CONTEOS.map(([nombre, clave, Icono, tono]) => (
          <div key={clave} className="superficie flex items-center gap-4 p-5">
            <span aria-hidden className={`grid size-11 shrink-0 place-items-center rounded-full ${tono}`}>
              <Icono className="size-5" strokeWidth={2.2} />
            </span>
            <div>
              <p className="cifra text-2xl leading-tight">{r.conteos[clave]}</p>
              <p className="text-sm text-muted-foreground">{nombre}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
