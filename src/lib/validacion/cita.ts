import { z } from "zod";
import { fechaISO, horaBloque, uuid } from "./comunes";

export const ZONAS = [
  "CERVICAL",
  "DORSAL",
  "LUMBAR",
  "HOMBRO",
  "CODO",
  "MUNECA_MANO",
  "CADERA",
  "RODILLA",
  "TOBILLO_PIE",
  "OTRA",
] as const;

export const NOMBRE_ZONA: Record<(typeof ZONAS)[number], string> = {
  CERVICAL: "Cervical",
  DORSAL: "Dorsal",
  LUMBAR: "Lumbar",
  HOMBRO: "Hombro",
  CODO: "Codo",
  MUNECA_MANO: "Muñeca / mano",
  CADERA: "Cadera",
  RODILLA: "Rodilla",
  TOBILLO_PIE: "Tobillo / pie",
  OTRA: "Otra",
};

export const zonaCorporal = z.enum(ZONAS, { error: "Elige la zona corporal" });

function aMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export const APERTURA_MIN = 7 * 60 + 30;
export const CIERRE_MIN = 17 * 60;

/** ¿Una cita de `duracionMin` que empieza a `hora` cabe en 07:30–17:00? (FR-016) */
export function dentroDeHorario(hora: string, duracionMin: number) {
  const inicio = aMinutos(hora);
  return inicio >= APERTURA_MIN && inicio + duracionMin <= CIERRE_MIN;
}

export const duracionMin = z.coerce
  .number({ error: "Duración inválida" })
  .int()
  .min(30, "La duración mínima es 30 minutos")
  .max(570, "La duración máxima es 570 minutos")
  .refine((v) => v % 30 === 0, "La duración debe ser múltiplo de 30 minutos");

const camposHorario = {
  consultorioId: uuid,
  profesionalId: uuid,
  fecha: fechaISO,
  horaInicio: horaBloque,
  duracionMin,
};

export const crearCitaSchema = z.object({
  pacienteId: uuid,
  ...camposHorario,
  motivo: z.string().trim().min(1, "Escribe el motivo de la terapia").max(500, "Máximo 500 caracteres"),
  zonaCorporal,
});

export const reprogramarCitaSchema = z.object({ id: uuid, ...camposHorario }).partial({
  consultorioId: true,
  profesionalId: true,
  fecha: true,
  horaInicio: true,
  duracionMin: true,
});

export type CrearCitaEntrada = z.input<typeof crearCitaSchema>;
