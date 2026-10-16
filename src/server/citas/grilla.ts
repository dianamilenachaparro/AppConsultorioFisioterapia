import "server-only";
import { BLOQUES, instanteBogota, rangoDia } from "@/lib/tiempo";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

export type CitaEnBloque = {
  id: string;
  paciente: string;
  profesional: string;
  estado: "PROGRAMADA" | "ASISTIDA" | "CANCELADA";
  retroactiva: boolean;
  inicio: Date;
  fin: Date;
  /** true solo en el primer bloque de la cita. */
  esInicio: boolean;
};

export type Bloque = { hora: string; estado: "DISPONIBLE" | "OCUPADO"; cita?: CitaEnBloque };

/**
 * 19 bloques de 30 min del consultorio en la fecha dada. Un bloque está ocupado si
 * se cruza con una cita no cancelada (FR-009). Una sola consulta (SC-003).
 */
export async function obtenerGrilla(
  sesion: Sesion,
  { consultorioId, fecha }: { consultorioId: string; fecha: string },
): Promise<Bloque[]> {
  exigirPermiso(sesion, "agenda:ver_todas");
  const { desde, hasta } = rangoDia(fecha);
  const citas = await prisma.cita.findMany({
    where: { consultorioId, estado: { not: "CANCELADA" }, inicio: { lt: hasta }, fin: { gt: desde } },
    select: {
      id: true,
      inicio: true,
      fin: true,
      estado: true,
      retroactiva: true,
      paciente: { select: { nombreCompleto: true } },
      profesional: { select: { nombreCompleto: true } },
    },
    orderBy: { inicio: "asc" },
  });

  return BLOQUES.map((hora) => {
    const bInicio = instanteBogota(fecha, hora);
    const bFin = new Date(bInicio.getTime() + 30 * 60_000);
    const c = citas.find((x) => x.inicio < bFin && x.fin > bInicio);
    if (!c) return { hora, estado: "DISPONIBLE" as const };
    return {
      hora,
      estado: "OCUPADO" as const,
      cita: {
        id: c.id,
        paciente: c.paciente.nombreCompleto,
        profesional: c.profesional.nombreCompleto,
        estado: c.estado,
        retroactiva: c.retroactiva,
        inicio: c.inicio,
        fin: c.fin,
        esInicio: c.inicio.getTime() === bInicio.getTime(),
      },
    };
  });
}
