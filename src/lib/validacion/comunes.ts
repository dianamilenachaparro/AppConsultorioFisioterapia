import { z } from "zod";

export const cedula = z
  .string()
  .trim()
  .regex(/^\d{5,15}$/, "La cédula debe tener entre 5 y 15 dígitos");

export const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres");

/** Normaliza quitando puntos, guiones y espacios, y pasa a mayúsculas. */
export function normalizarDocumento(valor: string) {
  return valor.replace(/[.\-\s]/g, "").toUpperCase();
}

export const documento = z
  .string()
  .transform(normalizarDocumento)
  .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, "El documento debe tener entre 4 y 20 letras o números"));

export const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Fecha inválida");

export const horaBloque = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|30)$/, "La hora debe ser en punto o y media (HH:00 o HH:30)");

export const dinero = z.coerce
  .number({ error: "Valor inválido" })
  .int("El valor debe ser un número entero de pesos")
  .positive("El valor debe ser mayor que cero")
  .max(2_000_000_000, "Valor demasiado alto");

export const motivo = z.string().trim().min(5, "Escribe un motivo de al menos 5 caracteres");

export const uuid = z.uuid("Identificador inválido");

export const textoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));
