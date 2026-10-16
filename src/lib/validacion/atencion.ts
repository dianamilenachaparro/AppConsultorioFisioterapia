import { z } from "zod";
import { uuid } from "./comunes";
import { zonaCorporal } from "./cita";

const texto = (obligatorio: string, max: number) =>
  z.string().trim().min(1, obligatorio).max(max, `Máximo ${max} caracteres`);

export const dolor = z.coerce
  .number({ error: "El dolor debe ser un número de 0 a 10" })
  .int("El dolor debe ser un número entero de 0 a 10")
  .min(0, "El dolor debe estar entre 0 y 10")
  .max(10, "El dolor debe estar entre 0 y 10");

/** Campos clínicos de una atención (FR-024). */
export const camposAtencion = z.object({
  zonaCorporal,
  motivo: texto("El motivo es obligatorio", 500),
  tecnica: texto("La técnica es obligatoria", 500),
  dolor,
  notasEvolucion: texto("Las notas de evolución son obligatorias", 5000),
});

export const registrarAtencionSchema = camposAtencion.extend({ citaId: uuid });
export const editarAtencionSchema = camposAtencion.extend({ id: uuid });

export const notaAclaratoriaSchema = z.object({
  atencionId: uuid,
  texto: z
    .string()
    .trim()
    .min(5, "La nota debe tener al menos 5 caracteres")
    .max(2000, "La nota admite máximo 2000 caracteres"),
});

export type CamposAtencion = z.input<typeof camposAtencion>;
