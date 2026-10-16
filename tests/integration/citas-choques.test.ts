import { beforeEach, describe, expect, it } from "vitest";
import { crearCita } from "@/server/citas/crear";
import { obtenerGrilla } from "@/server/citas/grilla";
import { prisma } from "@/server/db";
import { crearPacientePrueba, escenarioBase, limpiarBaseDeDatos, MANANA, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

const cita = (extra: Partial<Parameters<typeof crearCita>[1]> = {}) => ({
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

describe("citas sin choques (US2, SC-001)", () => {
  it("dos confirmaciones simultáneas del mismo consultorio y hora: exactamente una se guarda", async () => {
    const otroPaciente = await crearPacientePrueba(e.recepcionista.id);
    const r = sesionDe(e.recepcionista);
    const resultados = await Promise.allSettled([
      crearCita(r, cita()),
      crearCita(r, cita({ pacienteId: otroPaciente.id, profesionalId: e.profesional2.id })),
    ]);
    const exitos = resultados.filter((x) => x.status === "fulfilled");
    const fallos = resultados.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
    expect(exitos).toHaveLength(1);
    expect(fallos).toHaveLength(1);
    expect(fallos[0].reason).toMatchObject({ codigo: "CONFLICTO_CONSULTORIO" });
    expect(await prisma.cita.count()).toBe(1);
  });

  it("rechaza citas parcialmente superpuestas en el mismo consultorio", async () => {
    const r = sesionDe(e.recepcionista);
    const otro = await crearPacientePrueba(e.recepcionista.id);
    await crearCita(r, cita({ duracionMin: 60 }));
    await expect(
      crearCita(r, cita({ pacienteId: otro.id, profesionalId: e.profesional2.id, horaInicio: "09:30" })),
    ).rejects.toMatchObject({ codigo: "CONFLICTO_CONSULTORIO" });
  });

  it("un profesional no puede estar en dos consultorios a la misma hora", async () => {
    const r = sesionDe(e.recepcionista);
    const otro = await crearPacientePrueba(e.recepcionista.id);
    await crearCita(r, cita());
    await expect(
      crearCita(r, cita({ pacienteId: otro.id, consultorioId: e.consultorio2.id })),
    ).rejects.toMatchObject({ codigo: "CONFLICTO_PROFESIONAL" });
  });

  it("un paciente no puede tener dos citas superpuestas", async () => {
    const r = sesionDe(e.recepcionista);
    await crearCita(r, cita());
    await expect(
      crearCita(r, cita({ consultorioId: e.consultorio2.id, profesionalId: e.profesional2.id })),
    ).rejects.toMatchObject({ codigo: "CONFLICTO_PACIENTE" });
  });

  it("un paciente puede tener varias citas activas sin superposición (FR-017)", async () => {
    const r = sesionDe(e.recepcionista);
    await crearCita(r, cita());
    await crearCita(r, cita({ horaInicio: "10:00" }));
    expect(await prisma.cita.count()).toBe(2);
  });

  it("una cita cancelada libera su bloque", async () => {
    const r = sesionDe(e.recepcionista);
    const { id } = await crearCita(r, cita());
    await prisma.cita.update({
      where: { id },
      data: {
        estado: "CANCELADA",
        observacionCancelacion: "Paciente avisó",
        canceladaPorId: e.recepcionista.id,
        canceladaEn: new Date(),
      },
    });
    const otro = await crearPacientePrueba(e.recepcionista.id);
    await expect(crearCita(r, cita({ pacienteId: otro.id }))).resolves.toBeTruthy();
  });

  it("una cita de 60 min a las 09:00 ocupa los bloques 09:00 y 09:30 en la grilla", async () => {
    const r = sesionDe(e.recepcionista);
    await crearCita(r, cita({ duracionMin: 60 }));
    const grilla = await obtenerGrilla(r, { consultorioId: e.consultorio.id, fecha: MANANA() });
    expect(grilla).toHaveLength(19);
    const ocupados = grilla.filter((b) => b.estado === "OCUPADO").map((b) => b.hora);
    expect(ocupados).toEqual(["09:00", "09:30"]);
  });

  it("el Profesional no puede crear citas ni ver la grilla general", async () => {
    const p = sesionDe(e.profesional);
    await expect(crearCita(p, cita())).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(obtenerGrilla(p, { consultorioId: e.consultorio.id, fecha: MANANA() })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
  });
});
