import { z } from "zod";
import { fechaISO, motivo, uuid } from "./comunes";

export const MEDIOS_PAGO = ["EFECTIVO", "TRANSFERENCIA"] as const;
export const NOMBRE_MEDIO_PAGO: Record<(typeof MEDIOS_PAGO)[number], string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
};
export const medioPago = z.enum(MEDIOS_PAGO, { error: "Elige el medio de pago" });

const pesos = (campo: string) =>
  z.coerce
    .number({ error: `${campo}: valor inválido` })
    .int(`${campo}: usa pesos enteros`)
    .min(0, `${campo} no puede ser negativo`)
    .max(2_000_000_000, `${campo}: valor demasiado alto`);

const unidades = (campo: string, minimo: number) =>
  z.coerce
    .number({ error: `${campo}: número inválido` })
    .int(`${campo} debe ser un número entero`)
    .min(minimo, minimo > 0 ? `${campo} debe ser mayor que cero` : `${campo} no puede ser negativo`)
    .max(100_000, `${campo}: cantidad demasiado alta`);

const nombre = z.string().trim().min(2, "El nombre es obligatorio").max(120, "El nombre admite máximo 120 caracteres");

export const crearInsumoSchema = z.object({
  nombre,
  costo: pesos("El costo"),
  precioVenta: pesos("El precio de venta"),
  stockInicial: unidades("El stock inicial", 0),
  stockMinimo: unidades("El stock mínimo", 0),
});

/** El stock no se edita: solo cambia con movimientos. */
export const editarInsumoSchema = z.object({
  id: uuid,
  nombre: nombre.optional(),
  costo: pesos("El costo").optional(),
  precioVenta: pesos("El precio de venta").optional(),
  stockMinimo: unidades("El stock mínimo", 0).optional(),
  activo: z.boolean().optional(),
});

export const ventaSchema = z.object({
  insumoId: uuid,
  cantidad: unidades("La cantidad", 1),
  medioPago,
  fecha: fechaISO.optional(),
});

export const reposicionSchema = z.object({
  insumoId: uuid,
  cantidad: unidades("La cantidad", 1),
  costoUnitario: pesos("El costo unitario"),
  medioPago,
  fecha: fechaISO.optional(),
});

export const anulacionSchema = z.object({ id: uuid, motivo });
