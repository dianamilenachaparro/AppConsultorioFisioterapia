import { beforeEach, describe, expect, it } from "vitest";
import { cancelarCita, marcarAsistida, revertirEstadoCita } from "@/server/citas/estados";
import { obtenerGrilla } from "@/server/citas/grilla";
import { listarCitas } from "@/server/citas/listar";
import { reprogramarCita } from "@/server/citas/reprogramar";
import { prisma } from "@/server/db";
import { crearCitaPrueba, crearPacientePrueba, escenarioBase, limpiarBaseDeDatos, MANANA, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

const nuevaCita = (extra: Partial<Parameters<typeof crearCitaPrueba>[0]> = {}) =>
  crearCitaPrueba({
    pacienteId: e.paciente.id,
    profesionalId: e.profesional.id,
    consultorioId: e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    ...extra,
  });

describe("estados de citas (US3)", () => {
  it("no permite cancelar sin observación", async () => {
    const c = await nuevaCita();
    await expect(cancelarCita(sesionDe(e.recepcionista), { id: c.id, observacion: "" })).rejects.toMatchObject({
      name: "ZodError",
    });
    await expect(cancelarCita(sesionDe(e.recepcionista), { id: c.id, observacion: "no" })).rejects.toMatchObject({
      name: "ZodError",
    });
  });

  it("cancelar guarda quién y cuándo y libera los bloques", async () => {
    const c = await nuevaCita();
    await cancelarCita(sesionDe(e.recepcionista), { id: c.id, observacion: "El paciente avisó que no viene" });
    const fila = await prisma.cita.findUniqueOrThrow({ where: { id: c.id } });
    expect(fila.estado).toBe("CANCELADA");
    expect(fila.canceladaPorId).toBe(e.recepcionista.id);
    expect(fila.canceladaEn).not.toBeNull();
    const grilla = await obtenerGrilla(sesionDe(e.recepcionista), { consultorioId: e.consultorio.id, fecha: MANANA() });
    expect(grilla.every((b) => b.estado === "DISPONIBLE")).toBe(true);
  });

  it("no cancela ni reprograma una cita Asistida", async () => {
    const c = await nuevaCita();
    await marcarAsistida(sesionDe(e.recepcionista), { id: c.id });
    await expect(
      cancelarCita(sesionDe(e.recepcionista), { id: c.id, observacion: "Motivo cualquiera" }),
    ).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
    await expect(reprogramarCita(sesionDe(e.recepcionista), { id: c.id, horaInicio: "11:00" })).rejects.toMatchObject({
      codigo: "ESTADO_INVALIDO",
    });
  });

  it("reprogramar a un horario ocupado se rechaza con el conflicto", async () => {
    const otro = await crearPacientePrueba(e.recepcionista.id);
    await nuevaCita({ hora: "10:00", pacienteId: otro.id, profesionalId: e.profesional2.id });
    const c = await nuevaCita();
    await expect(reprogramarCita(sesionDe(e.recepcionista), { id: c.id, horaInicio: "10:00" })).rejects.toMatchObject({
      codigo: "CONFLICTO_CONSULTORIO",
    });
    await reprogramarCita(sesionDe(e.recepcionista), { id: c.id, horaInicio: "11:00", duracionMin: 60 });
    const fila = await prisma.cita.findUniqueOrThrow({ where: { id: c.id } });
    expect(fila.duracionMin).toBe(60);
  });

  it("solo el Dueño revierte a Programada, re-validando choques", async () => {
    const c = await nuevaCita();
    await cancelarCita(sesionDe(e.recepcionista), { id: c.id, observacion: "Cancelada por error" });
    await expect(
      revertirEstadoCita(sesionDe(e.recepcionista), { id: c.id, motivo: "Fue un error" }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });

    // Otra cita ocupa ahora el bloque: revertir debe fallar por choque.
    const otro = await crearPacientePrueba(e.recepcionista.id);
    const ocupante = await nuevaCita({ pacienteId: otro.id, profesionalId: e.profesional2.id });
    await expect(
      revertirEstadoCita(sesionDe(e.dueno), { id: c.id, motivo: "Fue un error" }),
    ).rejects.toMatchObject({ codigo: "CONFLICTO_CONSULTORIO" });

    await prisma.cita.delete({ where: { id: ocupante.id } });
    await revertirEstadoCita(sesionDe(e.dueno), { id: c.id, motivo: "Fue un error" });
    expect((await prisma.cita.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe("PROGRAMADA");
  });

  it("filtra por profesional, estado y rango, con conteos correctos", async () => {
    const otro = await crearPacientePrueba(e.recepcionista.id);
    const a = await nuevaCita({ hora: "08:00" });
    await nuevaCita({ hora: "09:00" });
    await nuevaCita({ hora: "10:00", pacienteId: otro.id, profesionalId: e.profesional2.id });
    await marcarAsistida(sesionDe(e.recepcionista), { id: a.id });

    const r = await listarCitas(sesionDe(e.recepcionista), {
      desde: MANANA(),
      hasta: MANANA(),
      profesionalId: e.profesional.id,
      estado: "ASISTIDA",
    });
    expect(r.filas.map((f) => f.id)).toEqual([a.id]);
    expect(r.total).toBe(1);

    const todos = await listarCitas(sesionDe(e.recepcionista), { desde: MANANA(), hasta: MANANA() });
    expect(todos.conteos).toEqual({ PROGRAMADA: 2, ASISTIDA: 1, CANCELADA: 0 });
  });

  it("el Profesional solo recibe sus citas aunque pida las de otro", async () => {
    const otro = await crearPacientePrueba(e.recepcionista.id);
    await nuevaCita();
    await nuevaCita({ hora: "10:00", pacienteId: otro.id, profesionalId: e.profesional2.id });
    const r = await listarCitas(sesionDe(e.profesional), {
      desde: MANANA(),
      hasta: MANANA(),
      profesionalId: e.profesional2.id,
    });
    expect(r.filas.every((f) => f.profesional.id === e.profesional.id)).toBe(true);
    expect(r.total).toBe(1);
  });
});
