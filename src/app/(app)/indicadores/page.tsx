import { Card, CardContent } from "@/components/ui/card";
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

function Dato({
  titulo,
  valor,
  unidad,
  nota,
}: {
  titulo: string;
  valor: number | null;
  unidad?: string;
  nota: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className="text-3xl font-semibold tabular-nums">
          {valor === null ? "—" : decimal.format(valor)}
          {valor !== null && unidad && <span className="ml-1 text-base font-normal text-muted-foreground">{unidad}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{nota}</p>
      </CardContent>
    </Card>
  );
}

const basado = (n: number) => (n === 1 ? "Basado en 1 cita" : `Basado en ${n} citas`);

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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{verTodos ? "Indicadores" : "Mis indicadores"}</h1>
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dato titulo="Espera promedio" valor={r.esperaPromedioMin} unidad="min" nota={`Llegada → ingreso. ${basado(r.muestras.espera)}`} />
        <Dato
          titulo="Duración real promedio"
          valor={r.duracionRealPromedioMin}
          unidad="min"
          nota={`Ingreso → fin. ${basado(r.muestras.duracion)}`}
        />
        <Dato
          titulo="Retraso promedio"
          valor={r.retrasoPromedioMin}
          unidad="min"
          nota={`Ingreso vs. hora programada. ${basado(r.muestras.puntualidad)}`}
        />
        <Dato
          titulo="Iniciadas a tiempo"
          valor={r.porcentajeATiempo}
          unidad="%"
          nota={`Hasta ${TOLERANCIA_A_TIEMPO_MIN} min de retraso. ${basado(r.muestras.puntualidad)}`}
        />
      </div>
      <Card>
        <CardContent className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["Programadas", r.conteos.programadas],
              ["Asistidas", r.conteos.asistidas],
              ["Canceladas", r.conteos.canceladas],
            ] as const
          ).map(([nombre, n]) => (
            <div key={nombre}>
              <p className="text-2xl font-semibold tabular-nums">{n}</p>
              <p className="text-sm text-muted-foreground">{nombre}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
