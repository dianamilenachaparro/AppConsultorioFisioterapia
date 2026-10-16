import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { rangoFechas } from "@/lib/tiempo";
import { fechaISO, uuid } from "@/lib/validacion/comunes";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

export const TAMANO_PAGINA_AUDITORIA = 50;

export const filtroAuditoriaSchema = z.object({
  desde: fechaISO,
  hasta: fechaISO,
  usuarioId: uuid.optional(),
  accion: z.string().trim().max(60).optional(),
  entidad: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});

/** Registro de auditoría de solo lectura, del más reciente al más antiguo (FR-043). */
export async function consultarAuditoria(sesion: Sesion, entrada: z.input<typeof filtroAuditoriaSchema>) {
  exigirPermiso(sesion, "admin:auditoria");
  const f = filtroAuditoriaSchema.parse(entrada);
  const { desde, hasta } = rangoFechas(f.desde, f.hasta);
  const where: Prisma.RegistroAuditoriaWhereInput = {
    creadoEn: { gte: desde, lt: hasta },
    ...(f.usuarioId ? { usuarioId: f.usuarioId } : {}),
    ...(f.accion ? { accion: f.accion } : {}),
    ...(f.entidad ? { entidad: f.entidad } : {}),
  };
  const [filas, total] = await Promise.all([
    prisma.registroAuditoria.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (f.pagina - 1) * TAMANO_PAGINA_AUDITORIA,
      take: TAMANO_PAGINA_AUDITORIA,
      include: { usuario: { select: { nombreCompleto: true } } },
    }),
    prisma.registroAuditoria.count({ where }),
  ]);
  return {
    filas: filas.map((r) => ({
      id: r.id.toString(),
      usuario: r.usuario.nombreCompleto,
      accion: r.accion,
      entidad: r.entidad,
      entidadId: r.entidadId,
      antes: r.antes,
      despues: r.despues,
      motivo: r.motivo,
      creadoEn: r.creadoEn,
    })),
    total,
    pagina: f.pagina,
    paginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA_AUDITORIA)),
  };
}

/** Valores distintos para los filtros desplegables. */
export async function opcionesFiltroAuditoria(sesion: Sesion) {
  exigirPermiso(sesion, "admin:auditoria");
  const [acciones, entidades, usuarios] = await Promise.all([
    prisma.registroAuditoria.findMany({ distinct: ["accion"], select: { accion: true }, orderBy: { accion: "asc" } }),
    prisma.registroAuditoria.findMany({ distinct: ["entidad"], select: { entidad: true }, orderBy: { entidad: "asc" } }),
    prisma.usuario.findMany({ select: { id: true, nombreCompleto: true }, orderBy: { nombreCompleto: "asc" } }),
  ]);
  return { acciones: acciones.map((a) => a.accion), entidades: entidades.map((e) => e.entidad), usuarios };
}
