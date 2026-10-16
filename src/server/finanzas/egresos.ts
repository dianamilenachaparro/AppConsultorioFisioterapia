import "server-only";
import type { z } from "zod";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { columnaDateDeFecha } from "@/lib/tiempo";
import { egresoSchema } from "@/lib/validacion/finanzas";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

export async function listarCategoriasEgreso(sesion: Sesion) {
  exigirPermiso(sesion, ["finanzas:egresos", "finanzas:ver"]);
  return prisma.categoriaEgreso.findMany({
    where: { activo: true },
    select: { id: true, clave: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

/** Egreso manual (solo Dueño); todos los campos obligatorios (FR-039). */
export async function registrarEgreso(sesion: Sesion, entrada: z.input<typeof egresoSchema>) {
  exigirPermiso(sesion, "finanzas:egresos");
  const d = egresoSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const categoria = await tx.categoriaEgreso.findUnique({ where: { id: d.categoriaId }, select: { activo: true } });
      if (!categoria?.activo) {
        throw new ErrorDominio("VALIDACION", "Categoría no válida", undefined, { categoriaId: ["Elige una categoría"] });
      }
      const mov = await tx.movimientoFinanciero.create({
        data: {
          tipo: "EGRESO",
          categoriaEgresoId: d.categoriaId,
          fecha: columnaDateDeFecha(d.fecha),
          valor: d.valor,
          medioPago: d.medioPago,
          descripcion: d.descripcion,
          creadoPorId: sesion.usuarioId,
        },
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "EGRESO_CREAR",
        entidad: "movimiento_financiero",
        entidadId: mov.id,
        despues: { ...d },
      });
      return { id: mov.id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}
