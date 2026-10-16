import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { rangoDia, rangoMes, rangoSemana } from "@/lib/tiempo";
import { fechaISO, uuid } from "@/lib/validacion/comunes";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { calcularIndicadores, type FilaIndicador } from "./calculo";

export const PERIODOS = ["DIA", "SEMANA", "MES"] as const;

export const filtroIndicadoresSchema = z.object({
  periodo: z.enum(PERIODOS).default("SEMANA"),
  fecha: fechaISO,
  profesionalId: uuid.optional(),
  consultorioId: uuid.optional(),
});

const RANGOS = { DIA: rangoDia, SEMANA: rangoSemana, MES: rangoMes };

/** Indicadores de tiempos del periodo (Bogotá); el Profesional siempre ve solo los suyos (FR-031, FR-032). */
export async function obtenerIndicadores(sesion: Sesion, entrada: z.input<typeof filtroIndicadoresSchema>) {
  exigirPermiso(sesion, ["indicadores:ver_todos", "indicadores:ver_propios"]);
  const f = filtroIndicadoresSchema.parse(entrada);
  const rango = RANGOS[f.periodo](f.fecha);
  const profesionalId = sesion.rol === "PROFESIONAL" ? sesion.usuarioId : f.profesionalId;

  const filas = await prisma.$queryRaw<FilaIndicador[]>`
    SELECT c.inicio,
           c.estado::text AS estado,
           m.llegada_en AS "llegadaEn",
           m.ingreso_en AS "ingresoEn",
           m.fin_en AS "finEn"
    FROM cita c
    LEFT JOIN marcacion m ON m.cita_id = c.id
    WHERE c.inicio >= ${rango.desde} AND c.inicio < ${rango.hasta}
      ${profesionalId ? Prisma.sql`AND c.profesional_id = ${profesionalId}::uuid` : Prisma.empty}
      ${f.consultorioId ? Prisma.sql`AND c.consultorio_id = ${f.consultorioId}::uuid` : Prisma.empty}`;

  return { rango, ...calcularIndicadores(filas) };
}
