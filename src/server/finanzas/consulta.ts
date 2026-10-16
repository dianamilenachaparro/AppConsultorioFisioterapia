import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { columnaDateDeFecha, fechaDeColumnaDate } from "@/lib/tiempo";
import { filtroFinanzasSchema, type FiltroFinanzas } from "@/lib/validacion/finanzas";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

export const TAMANO_PAGINA_FINANZAS = 50;

export type FilaFinanzas = {
  id: string;
  fecha: string;
  tipo: "INGRESO" | "EGRESO";
  subtipoOCategoria: string;
  descripcion: string;
  medioPago: "EFECTIVO" | "TRANSFERENCIA";
  valor: number;
  pacienteOInsumo: string | null;
  registradoPor: string;
  anulado: boolean;
};

const NOMBRE_SUBTIPO = { TERAPIA: "Terapia", VENTA_INSUMOS: "Venta de insumos" } as const;

function filtroPrisma(f: ReturnType<typeof filtroFinanzasSchema.parse>): Prisma.MovimientoFinancieroWhereInput {
  return {
    fecha: { gte: columnaDateDeFecha(f.desde), lte: columnaDateDeFecha(f.hasta) },
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.subtipoIngreso ? { subtipoIngreso: f.subtipoIngreso } : {}),
    ...(f.categoriaId ? { categoriaEgresoId: f.categoriaId } : {}),
    ...(f.medioPago ? { medioPago: f.medioPago } : {}),
    ...(f.incluirAnulados ? {} : { anulado: false }),
  };
}

/**
 * Historial financiero filtrado (solo Dueño). Es la única fuente para la pantalla y para la
 * exportación (SC-008): los totales se calculan sobre todo el filtro, no solo sobre la página.
 * Los anulados, si se incluyen, se listan pero no suman.
 */
export async function consultarFinanzas(
  sesion: Sesion,
  filtro: FiltroFinanzas,
  opciones: { paginar?: { pagina: number; tamano?: number } } = {},
) {
  exigirPermiso(sesion, "finanzas:ver");
  const f = filtroFinanzasSchema.parse(filtro);
  const where = filtroPrisma(f);
  const pag = opciones.paginar;
  const tamano = pag?.tamano ?? TAMANO_PAGINA_FINANZAS;

  const [filas, total, sumas] = await Promise.all([
    prisma.movimientoFinanciero.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
      ...(pag ? { skip: (Math.max(1, pag.pagina) - 1) * tamano, take: tamano } : {}),
      include: {
        categoriaEgreso: { select: { nombre: true } },
        cita: { select: { paciente: { select: { nombreCompleto: true } } } },
        movimientoInventario: { select: { insumo: { select: { nombre: true } } } },
        creadoPor: { select: { nombreCompleto: true } },
      },
    }),
    prisma.movimientoFinanciero.count({ where }),
    prisma.movimientoFinanciero.groupBy({ by: ["tipo"], where: { ...where, anulado: false }, _sum: { valor: true } }),
  ]);

  const suma = (tipo: "INGRESO" | "EGRESO") => Number(sumas.find((s) => s.tipo === tipo)?._sum.valor ?? 0);
  const ingresos = suma("INGRESO");
  const egresos = suma("EGRESO");

  return {
    filas: filas.map(
      (m): FilaFinanzas => ({
        id: m.id,
        fecha: fechaDeColumnaDate(m.fecha),
        tipo: m.tipo,
        subtipoOCategoria: m.subtipoIngreso ? NOMBRE_SUBTIPO[m.subtipoIngreso] : (m.categoriaEgreso?.nombre ?? ""),
        descripcion: m.descripcion,
        medioPago: m.medioPago,
        valor: m.valor,
        pacienteOInsumo: m.cita?.paciente.nombreCompleto ?? m.movimientoInventario?.insumo.nombre ?? null,
        registradoPor: m.creadoPor.nombreCompleto,
        anulado: m.anulado,
      }),
    ),
    total,
    paginas: pag ? Math.max(1, Math.ceil(total / tamano)) : 1,
    totales: { ingresos, egresos, balance: ingresos - egresos },
  };
}

export type ResultadoFinanzas = Awaited<ReturnType<typeof consultarFinanzas>>;
