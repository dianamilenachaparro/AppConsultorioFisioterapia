import { beforeEach, describe, expect, it } from "vitest";
import { instanteBogota, hoyBogota, sumarDias } from "@/lib/tiempo";
import { crearCita } from "@/server/citas/crear";
import { prisma } from "@/server/db";
import { crearConsultorioPrueba, crearUsuarioPrueba, escenarioBase, limpiarBaseDeDatos, MANANA, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

const cita = (extra: Record<string, unknown> = {}) => ({
  pacienteId: e.paciente.id,
  consultorioId: e.consultorio.id,
  profesionalId: e.profesional.id,
  fecha: MANANA(),
  horaInicio: "09:00",
  duracionMin: 30,
  motivo: "Dolor lumbar",
  zonaCorporal: "LUMBAR" as const,
  ...extra,
});

/** Inserta por SQL directo, saltándose la aplicación. */
async function insertarDirecto(fecha: string, hora: string, duracionMin: number) {
  const inicio = instanteBogota(fecha, hora);
  const fin = new Date(inicio.getTime() + duracionMin * 60_000);
  return prisma.$executeRaw`
    INSERT INTO cita (paciente_id, profesional_id, consultorio_id, inicio, duracion_min, fin, motivo, zona_corporal, creado_por)
    VALUES (${e.paciente.id}::uuid, ${e.profesional.id}::uuid, ${e.consultorio.id}::uuid, ${inicio}, ${duracionMin}, ${fin},
            'Prueba', 'LUMBAR', ${e.recepcionista.id}::uuid)`;
}

describe("horario de citas (FR-016)", () => {
  it.each([
    ["16:00", 90],
    ["07:00", 30],
    ["16:30", 60],
  ])("rechaza inicio %s con %i min", async (hora, duracion) => {
    await expect(
      crearCita(sesionDe(e.recepcionista), cita({ horaInicio: hora, duracionMin: duracion })),
    ).rejects.toMatchObject({ codigo: "FUERA_DE_HORARIO" });
  });

  it("rechaza minutos que no son :00 ni :30", async () => {
    await expect(crearCita(sesionDe(e.recepcionista), cita({ horaInicio: "09:15" }))).rejects.toMatchObject({
      name: "ZodError",
    });
  });

  it("acepta la última cita de 30 min a las 16:30", async () => {
    await expect(crearCita(sesionDe(e.recepcionista), cita({ horaInicio: "16:30" }))).resolves.toBeTruthy();
  });

  it.each([
    ["16:00", 90],
    ["07:00", 30],
    ["09:15", 30],
  ])("la BD también rechaza por SQL directo %s con %i min", async (hora, duracion) => {
    await expect(insertarDirecto(MANANA(), hora, duracion)).rejects.toThrow();
  });

  it("una cita en fecha pasada queda marcada como retroactiva (FR-018)", async () => {
    const ayer = sumarDias(hoyBogota(), -1);
    const r = await crearCita(sesionDe(e.recepcionista), cita({ fecha: ayer }));
    expect(r.retroactiva).toBe(true);
    const futura = await crearCita(sesionDe(e.recepcionista), cita({ horaInicio: "11:00" }));
    expect(futura.retroactiva).toBe(false);
  });

  it("no permite consultorios inactivos ni profesionales no asignables", async () => {
    const inactivo = await crearConsultorioPrueba({ activo: false });
    const recep = await crearUsuarioPrueba({ rol: "RECEPCIONISTA" });
    const r = sesionDe(e.recepcionista);
    await expect(crearCita(r, cita({ consultorioId: inactivo.id }))).rejects.toMatchObject({ codigo: "VALIDACION" });
    await expect(crearCita(r, cita({ profesionalId: recep.id }))).rejects.toMatchObject({ codigo: "VALIDACION" });
  });
});
