import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { ErrorDominio } from "@/lib/resultado";
import { rangoDia, rangoFechas } from "@/lib/tiempo";
import { fechaISO, uuid } from "@/lib/validacion/comunes";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

export const TAMANO_PAGINA_CITAS = 25;

const ESTADOS = ["PROGRAMADA", "ASISTIDA", "CANCELADA"] as const;

export const filtroCitasSchema = z.object({
  desde: fechaISO,
  hasta: fechaISO,
  consultorioId: uuid.optional(),
  profesionalId: uuid.optional(),
  estado: z.enum(ESTADOS).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

const seleccion = {
  id: true,
  inicio: true,
  fin: true,
  duracionMin: true,
  estado: true,
  retroactiva: true,
  motivo: true,
  zonaCorporal: true,
  paciente: { select: { id: true, nombreCompleto: true, documento: true } },
  profesional: { select: { id: true, nombreCompleto: true } },
  consultorio: { select: { id: true, nombre: true } },
} satisfies Prisma.CitaSelect;

/** Listado con filtros y conteos por estado sobre todo el filtro (FR-022). */
export async function listarCitas(sesion: Sesion, entrada: z.input<typeof filtroCitasSchema>) {
  exigirPermiso(sesion, "citas:listar");
  const f = filtroCitasSchema.parse(entrada);
  const { desde, hasta } = rangoFechas(f.desde, f.hasta);
  const profesionalId = sesion.rol === "PROFESIONAL" ? sesion.usuarioId : f.profesionalId;
  const base: Prisma.CitaWhereInput = {
    inicio: { gte: desde, lt: hasta },
    ...(f.consultorioId ? { consultorioId: f.consultorioId } : {}),
    ...(profesionalId ? { profesionalId } : {}),
  };
  const where = { ...base, ...(f.estado ? { estado: f.estado } : {}) };

  const [filas, total, porEstado] = await Promise.all([
    prisma.cita.findMany({
      where,
      select: seleccion,
      orderBy: { inicio: "asc" },
      skip: (f.pagina - 1) * TAMANO_PAGINA_CITAS,
      take: TAMANO_PAGINA_CITAS,
    }),
    prisma.cita.count({ where }),
    prisma.cita.groupBy({ by: ["estado"], where, _count: { _all: true } }),
  ]);
  const conteos = { PROGRAMADA: 0, ASISTIDA: 0, CANCELADA: 0 };
  for (const g of porEstado) conteos[g.estado] = g._count._all;
  return { filas, total, conteos };
}

/** Detalle de una cita; el Profesional solo ve las suyas. */
export async function obtenerCita(sesion: Sesion, id: string) {
  exigirPermiso(sesion, "citas:listar");
  if (!uuid.safeParse(id).success) throw new ErrorDominio("NO_ENCONTRADO", "Cita no encontrada");
  const cita = await prisma.cita.findUnique({
    where: { id },
    select: {
      ...seleccion,
      observacionCancelacion: true,
      canceladaEn: true,
      canceladaPor: { select: { nombreCompleto: true } },
      creadoEn: true,
      creadoPor: { select: { nombreCompleto: true } },
    },
  });
  if (!cita) throw new ErrorDominio("NO_ENCONTRADO", "Cita no encontrada");
  if (sesion.rol === "PROFESIONAL" && cita.profesional.id !== sesion.usuarioId) {
    throw new ErrorDominio("SIN_PERMISO");
  }
  return cita;
}

/** Agenda propia en todos los consultorios (FR-023). */
export async function obtenerMiAgenda(sesion: Sesion, { fecha }: { fecha: string }) {
  exigirPermiso(sesion, "agenda:ver_propia");
  const { desde, hasta } = rangoDia(fechaISO.parse(fecha));
  return prisma.cita.findMany({
    where: { profesionalId: sesion.usuarioId, inicio: { gte: desde, lt: hasta } },
    select: seleccion,
    orderBy: { inicio: "asc" },
  });
}
