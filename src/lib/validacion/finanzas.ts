import { z } from "zod";
import { dinero, fechaISO, uuid } from "./comunes";
import { medioPago } from "./inventario";

export const cobroSchema = z.object({
  citaId: uuid,
  valor: dinero,
  medioPago,
  fecha: fechaISO.optional(),
});

export const egresoSchema = z.object({
  categoriaId: z.uuid("Elige una categoría"),
  fecha: fechaISO,
  valor: dinero,
  medioPago,
  descripcion: z
    .string()
    .trim()
    .min(3, "La descripción debe tener al menos 3 caracteres")
    .max(300, "La descripción admite máximo 300 caracteres"),
});

export const TIPOS_MOVIMIENTO = ["INGRESO", "EGRESO"] as const;
export const SUBTIPOS_INGRESO = ["TERAPIA", "VENTA_INSUMOS"] as const;

export const NOMBRE_SUBTIPO: Record<(typeof SUBTIPOS_INGRESO)[number], string> = {
  TERAPIA: "Terapia",
  VENTA_INSUMOS: "Venta de insumos",
};

const casilla = z.preprocess((v) => v === true || v === "true" || v === "1" || v === "on", z.boolean());

export const filtroFinanzasSchema = z
  .object({
    desde: fechaISO,
    hasta: fechaISO,
    tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
    subtipoIngreso: z.enum(SUBTIPOS_INGRESO).optional(),
    categoriaId: uuid.optional(),
    medioPago: medioPago.optional(),
    incluirAnulados: casilla.default(false),
  })
  .refine((f) => f.desde <= f.hasta, { message: "La fecha inicial no puede ser posterior a la final", path: ["hasta"] });

export type FiltroFinanzas = z.input<typeof filtroFinanzasSchema>;
