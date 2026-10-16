import { beforeEach, describe, expect, it } from "vitest";
import { instanteBogota } from "@/lib/tiempo";
import { prisma } from "@/server/db";
import { corregirMarcacion, marcarFin, marcarIngreso, marcarLlegada } from "@/server/marcaciones/servicio";
import { crearCitaPrueba, escenarioBase, limpiarBaseDeDatos, MANANA, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

/** Cita de mañana a las 09:00; el "ahora" de cada marca se fija ese mismo día. */
const nuevaCita = (extra: Partial<Parameters<typeof crearCitaPrueba>[0]> = {}) =>
  crearCitaPrueba({
    pacienteId: e.paciente.id,
    profesionalId: e.profesional.id,
    consultorioId: e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    ...extra,
  });
const a = (hora: string) => instanteBogota(MANANA(), hora);
const prof = () => sesionDe(e.profesional);

describe("marcación de tiempos (FR-028, FR-029)", () => {
  it("marca en orden y el ingreso deja la cita Asistida en la misma transacción", async () => {
    const c = await nuevaCita();
    const r1 = await marcarLlegada(prof(), { citaId: c.id }, a("08:55"));
    expect(r1.siguiente).toBe("INGRESO");
    expect((await prisma.cita.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe("PROGRAMADA");
    const r2 = await marcarIngreso(prof(), { citaId: c.id }, a("09:10"));
    expect(r2.siguiente).toBe("FIN");
    expect((await prisma.cita.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe("ASISTIDA");
    const r3 = await marcarFin(prof(), { citaId: c.id }, a("09:40"));
    expect(r3.siguiente).toBeNull();
    const m = await prisma.marcacion.findUniqueOrThrow({ where: { citaId: c.id } });
    expect(m).toMatchObject({ llegadaPorId: e.profesional.id, ingresoPorId: e.profesional.id, finPorId: e.profesional.id });
    expect(await prisma.registroAuditoria.count({ where: { accion: "MARCACION_REGISTRAR", entidadId: c.id } })).toBe(3);
  });

  it("no permite saltarse marcas ni repetirlas", async () => {
    const c = await nuevaCita();
    await expect(marcarIngreso(prof(), { citaId: c.id }, a("09:00"))).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
    await expect(marcarFin(prof(), { citaId: c.id }, a("09:00"))).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
    await marcarLlegada(prof(), { citaId: c.id }, a("08:55"));
    await expect(marcarLlegada(prof(), { citaId: c.id }, a("08:56"))).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
    await expect(marcarFin(prof(), { citaId: c.id }, a("09:00"))).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
  });

  it("solo el profesional asignado marca", async () => {
    const c = await nuevaCita();
    await expect(marcarLlegada(sesionDe(e.profesional2), { citaId: c.id }, a("08:55"))).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    await expect(marcarLlegada(sesionDe(e.recepcionista), { citaId: c.id }, a("08:55"))).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
  });

  it("solo citas de hoy y no canceladas", async () => {
    const c = await nuevaCita();
    await expect(marcarLlegada(prof(), { citaId: c.id }, new Date(a("08:55").getTime() - 86_400_000))).rejects.toMatchObject({
      codigo: "ESTADO_INVALIDO",
    });
    const cancelada = await nuevaCita({ hora: "11:00", estado: "CANCELADA" });
    await expect(marcarLlegada(prof(), { citaId: cancelada.id }, a("10:55"))).rejects.toMatchObject({
      codigo: "ESTADO_INVALIDO",
    });
  });

  it("la BD rechaza marcas fuera de orden", async () => {
    const c = await nuevaCita();
    await expect(
      prisma.marcacion.create({ data: { citaId: c.id, ingresoEn: a("09:00") } }),
    ).rejects.toThrow(/marcacion_orden/);
    await expect(
      prisma.marcacion.create({ data: { citaId: c.id, llegadaEn: a("09:00"), ingresoEn: a("08:50") } }),
    ).rejects.toThrow(/marcacion_orden/);
  });
});

describe("corrección de marcaciones (FR-030)", () => {
  it("el Dueño corrige respetando el orden y queda auditado con motivo", async () => {
    const c = await nuevaCita();
    await marcarLlegada(prof(), { citaId: c.id }, a("08:55"));
    await marcarIngreso(prof(), { citaId: c.id }, a("09:10"));
    await corregirMarcacion(sesionDe(e.dueno), {
      citaId: c.id,
      ingresoEn: a("09:02"),
      finEn: a("09:35"),
      motivo: "El profesional olvidó marcar a tiempo",
    });
    const m = await prisma.marcacion.findUniqueOrThrow({ where: { citaId: c.id } });
    expect(m.ingresoEn).toEqual(a("09:02"));
    expect(m.ingresoPorId).toBe(e.dueno.id);
    expect(m.llegadaPorId).toBe(e.profesional.id);
    const reg = await prisma.registroAuditoria.findFirstOrThrow({ where: { accion: "MARCACION_CORREGIR", entidadId: c.id } });
    expect(reg.motivo).toBe("El profesional olvidó marcar a tiempo");
    expect(reg.antes).toMatchObject({ ingresoEn: a("09:10").toISOString(), finEn: null });
    expect(reg.despues).toMatchObject({ ingresoEn: a("09:02").toISOString(), finEn: a("09:35").toISOString() });
  });

  it("rechaza una corrección que rompe el orden", async () => {
    const c = await nuevaCita();
    await marcarLlegada(prof(), { citaId: c.id }, a("08:55"));
    await expect(
      corregirMarcacion(sesionDe(e.dueno), { citaId: c.id, ingresoEn: a("08:30"), motivo: "Corrección errónea" }),
    ).rejects.toMatchObject({ codigo: "VALIDACION" });
    await expect(
      corregirMarcacion(sesionDe(e.dueno), { citaId: c.id, finEn: a("09:30"), motivo: "Corrección errónea" }),
    ).rejects.toMatchObject({ codigo: "VALIDACION" });
  });

  it("registra tiempos de una cita retroactiva y la deja Asistida", async () => {
    const c = await nuevaCita();
    await corregirMarcacion(sesionDe(e.dueno), {
      citaId: c.id,
      llegadaEn: a("08:50"),
      ingresoEn: a("09:00"),
      finEn: a("09:30"),
      motivo: "Registro retroactivo",
    });
    expect((await prisma.cita.findUniqueOrThrow({ where: { id: c.id } })).estado).toBe("ASISTIDA");
  });

  it("el Profesional no corrige", async () => {
    const c = await nuevaCita();
    await expect(
      corregirMarcacion(prof(), { citaId: c.id, llegadaEn: a("08:50"), motivo: "Quiero corregir" }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });
});
