import { z } from "zod";
import { DEPARTAMENTOS } from "@/lib/departamentos";
import { hoyBogota } from "@/lib/tiempo";
import { documento, fechaISO, uuid } from "./comunes";

const obligatorio = (nombre: string, max = 200) =>
  z.string().trim().min(1, `${nombre} es obligatorio`).max(max, `${nombre} es demasiado largo`);

/** Todos los campos son obligatorios en el primer registro (FR-011). */
export const pacienteSchema = z.object({
  documento,
  nombreCompleto: obligatorio("El nombre completo", 120).refine((v) => v.length >= 3, "Nombre demasiado corto"),
  telefono: z
    .string()
    .transform((v) => v.replace(/[\s\-()+]/g, ""))
    .pipe(z.string().regex(/^\d{7,15}$/, "El teléfono debe tener entre 7 y 15 dígitos")),
  fechaNacimiento: fechaISO.refine((v) => v <= hoyBogota(), "La fecha de nacimiento no puede ser futura"),
  direccion: obligatorio("La dirección"),
  departamento: z.enum(DEPARTAMENTOS, { error: "Elige un departamento de la lista" }),
  ciudad: obligatorio("La ciudad", 100),
  barrio: obligatorio("El barrio", 100),
});

/** Lo que llega del formulario: texto sin validar (lo valida `pacienteSchema`). */
export type PacienteEntrada = { [K in keyof z.input<typeof pacienteSchema>]: string };

export const editarPacienteSchema = pacienteSchema.partial().extend({ id: uuid });
