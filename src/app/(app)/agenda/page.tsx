import { Grilla } from "@/components/agenda/grilla";
import { FiltroAgenda } from "@/components/agenda/filtro-agenda";
import { puede } from "@/lib/permisos";
import { formatearFechaLarga, hoyBogota } from "@/lib/tiempo";
import { fechaISO } from "@/lib/validacion/comunes";
import { paginaProtegida } from "@/server/auth/paginas";
import { obtenerGrilla } from "@/server/citas/grilla";
import { listarConsultoriosActivos } from "@/server/consultorios/consulta";

export default async function Agenda({ searchParams }: PageProps<"/agenda">) {
  const sesion = await paginaProtegida("agenda:ver_todas");
  const params = await searchParams;
  const consultorios = await listarConsultoriosActivos();
  const hoy = hoyBogota();
  const fecha = fechaISO.safeParse(params.fecha).success ? (params.fecha as string) : hoy;
  const consultorio = consultorios.find((c) => c.id === params.consultorio) ?? consultorios[0];

  if (!consultorio) {
    return <p className="text-muted-foreground">No hay consultorios activos. El Dueño debe crear uno.</p>;
  }

  const bloques = await obtenerGrilla(sesion, { consultorioId: consultorio.id, fecha });
  const libres = bloques.filter((b) => b.estado === "DISPONIBLE").length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Agenda</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">
          {formatearFechaLarga(fecha)} · {consultorio.nombre} · {libres} de 19 bloques disponibles
        </p>
      </div>
      <FiltroAgenda consultorios={consultorios} consultorioId={consultorio.id} fecha={fecha} hoy={hoy} />
      <Grilla
        bloques={bloques}
        consultorioId={consultorio.id}
        fecha={fecha}
        puedeCrear={puede(sesion.rol, "citas:gestionar")}
      />
    </div>
  );
}
