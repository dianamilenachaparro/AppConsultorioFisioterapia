import { beforeEach, describe, expect, it } from "vitest";
import { obtenerHistorial } from "@/server/atenciones/historial";
import {
  agregarNotaAclaratoria,
  editarAtencion,
  obtenerVersionesAtencion,
  registrarAtencion,
} from "@/server/atenciones/servicio";
import { revertirEstadoCita } from "@/server/citas/estados";
import { prisma } from "@/server/db";
import { crearCitaPrueba, crearPacientePrueba, escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

const citaAsistida = (extra: Partial<Parameters<typeof crearCitaPrueba>[0]> = {}) =>
  crearCitaPrueba({
    pacienteId: e.paciente.id,
    profesionalId: e.profesional.id,
    consultorioId: e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    estado: "ASISTIDA",
    ...extra,
  });

const campos = {
  zonaCorporal: "LUMBAR" as const,
  motivo: "Dolor lumbar",
  tecnica: "Terapia manual y estiramientos",
  dolor: 6,
  notasEvolucion: "Mejora la movilidad",
};

async function atencionDe(citaId: string, sesion = sesionDe(e.profesional)) {
  return registrarAtencion(sesion, { citaId, ...campos });
}

/** Mueve `creado_en` a ayer saltándose la app (el trigger lo permite porque la fila se creó hoy). */
async function envejecer(atencionId: string) {
  await prisma.$executeRaw`UPDATE atencion SET creado_en = creado_en - interval '1 day' WHERE id = ${atencionId}::uuid`;
}

const MANANA_INSTANTE = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

describe("registro de atención (US4)", () => {
  it("solo en citas Asistidas", async () => {
    const c = await citaAsistida({ estado: "PROGRAMADA" });
    await expect(atencionDe(c.id)).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
  });

  it("una sola atención por cita", async () => {
    const c = await citaAsistida();
    await atencionDe(c.id);
    await expect(atencionDe(c.id)).rejects.toMatchObject({ codigo: "DUPLICADO" });
  });

  it("copia paciente, profesional y fecha de la cita y audita la creación", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    const a = await prisma.atencion.findUniqueOrThrow({ where: { id } });
    expect(a).toMatchObject({ pacienteId: c.pacienteId, profesionalId: c.profesionalId, fecha: c.inicio });
    expect(await prisma.registroAuditoria.count({ where: { accion: "ATENCION_CREAR", entidadId: id } })).toBe(1);
  });

  it.each([11, -1])("dolor %i se rechaza en la app", async (dolor) => {
    const c = await citaAsistida();
    await expect(registrarAtencion(sesionDe(e.profesional), { citaId: c.id, ...campos, dolor })).rejects.toMatchObject({
      name: "ZodError",
    });
  });

  it("dolor fuera de 0–10 también lo rechaza la BD", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await expect(prisma.$executeRaw`UPDATE atencion SET dolor = 11 WHERE id = ${id}::uuid`).rejects.toThrow(
      /atencion_dolor_rango/,
    );
  });

  it("un Profesional no registra en citas de otro", async () => {
    const c = await citaAsistida();
    await expect(atencionDe(c.id, sesionDe(e.profesional2))).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });

  it("la Recepcionista no registra atenciones", async () => {
    const c = await citaAsistida();
    await expect(atencionDe(c.id, sesionDe(e.recepcionista))).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });
});

describe("edición y notas aclaratorias (FR-025)", () => {
  it("se edita el mismo día y la versión anterior queda en la auditoría", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await editarAtencion(sesionDe(e.profesional), { id, ...campos, dolor: 3 });
    const a = await prisma.atencion.findUniqueOrThrow({ where: { id } });
    expect(a.dolor).toBe(3);
    expect(a.actualizadoPorId).toBe(e.profesional.id);
    const registro = await prisma.registroAuditoria.findFirstOrThrow({ where: { accion: "ATENCION_EDITAR", entidadId: id } });
    expect(registro.antes).toMatchObject({ dolor: 6 });
    expect(registro.despues).toMatchObject({ dolor: 3 });
    const versiones = await obtenerVersionesAtencion(sesionDe(e.recepcionista), id);
    expect(versiones).toHaveLength(1);
    expect(versiones[0].antes).toMatchObject({ dolor: 6 });
  });

  it("al día siguiente responde FUERA_DE_VENTANA", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await expect(
      editarAtencion(sesionDe(e.profesional), { id, ...campos, dolor: 2 }, MANANA_INSTANTE()),
    ).rejects.toMatchObject({ codigo: "FUERA_DE_VENTANA" });
  });

  it("la BD impide editar una atención de un día anterior", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await envejecer(id);
    await expect(prisma.$executeRaw`UPDATE atencion SET dolor = 1 WHERE id = ${id}::uuid`).rejects.toThrow(
      /fuera_de_ventana/,
    );
    // Y la app traduce el error del trigger aunque el reloj del servidor diga otra cosa.
    await expect(editarAtencion(sesionDe(e.profesional), { id, ...campos, dolor: 1 })).rejects.toMatchObject({
      codigo: "FUERA_DE_VENTANA",
    });
  });

  it("la BD impide borrar una atención", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await expect(prisma.$executeRaw`DELETE FROM atencion WHERE id = ${id}::uuid`).rejects.toThrow(/no se puede borrar/);
  });

  it("solo el autor o el Dueño editan", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await expect(editarAtencion(sesionDe(e.profesional2), { id, ...campos })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    await editarAtencion(sesionDe(e.dueno), { id, ...campos, dolor: 4 });
  });

  it("las notas aclaratorias se agregan en cualquier día y no se modifican", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await envejecer(id);
    const nota = await agregarNotaAclaratoria(sesionDe(e.profesional), {
      atencionId: id,
      texto: "Aclaro que la técnica incluyó calor local",
    });
    expect(await prisma.registroAuditoria.count({ where: { accion: "ATENCION_NOTA_AGREGAR", entidadId: id } })).toBe(1);
    await expect(
      prisma.$executeRaw`UPDATE nota_aclaratoria SET texto = 'otro texto' WHERE id = ${nota.id}::uuid`,
    ).rejects.toThrow(/solo inserción/);
    await expect(prisma.$executeRaw`DELETE FROM nota_aclaratoria WHERE id = ${nota.id}::uuid`).rejects.toThrow(
      /solo inserción/,
    );
  });

  it("la nota exige al menos 5 caracteres y la agrega solo el autor o el Dueño", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await expect(agregarNotaAclaratoria(sesionDe(e.profesional), { atencionId: id, texto: "ok" })).rejects.toMatchObject({
      name: "ZodError",
    });
    await expect(
      agregarNotaAclaratoria(sesionDe(e.profesional2), { atencionId: id, texto: "Nota de otro profesional" }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });
});

describe("historial del paciente (FR-026, FR-027)", () => {
  it("ordena por fecha desc y agrupa la serie de dolor por zona en orden ascendente", async () => {
    const fechas = ["2026-01-10", "2026-02-10", "2026-03-10"];
    for (const [i, fecha] of fechas.entries()) {
      const c = await citaAsistida({ fecha });
      await registrarAtencion(sesionDe(e.profesional), { citaId: c.id, ...campos, dolor: 8 - i * 2 });
    }
    const c = await citaAsistida({ fecha: "2026-02-20" });
    await registrarAtencion(sesionDe(e.profesional), { citaId: c.id, ...campos, zonaCorporal: "CERVICAL", dolor: 5 });

    const h = await obtenerHistorial(sesionDe(e.profesional), { pacienteId: e.paciente.id });
    expect(h.atenciones.map((a) => a.dolor)).toEqual([4, 5, 6, 8]);
    expect(h.serieDolor.LUMBAR?.map((p) => p.dolor)).toEqual([8, 6, 4]);
    expect(h.serieDolor.CERVICAL?.map((p) => p.dolor)).toEqual([5]);
    expect(h.atenciones.every((a) => a.editable)).toBe(true);
  });

  it("marca editada y no editable, y trae las notas en orden", async () => {
    const c = await citaAsistida();
    const { id } = await atencionDe(c.id);
    await editarAtencion(sesionDe(e.profesional), { id, ...campos, dolor: 5 });
    await agregarNotaAclaratoria(sesionDe(e.profesional), { atencionId: id, texto: "Primera nota" });
    await agregarNotaAclaratoria(sesionDe(e.profesional), { atencionId: id, texto: "Segunda nota" });
    const h = await obtenerHistorial(sesionDe(e.profesional), { pacienteId: e.paciente.id }, MANANA_INSTANTE());
    expect(h.atenciones[0]).toMatchObject({ editada: true, editable: false });
    expect(h.atenciones[0].notasAclaratorias.map((n) => n.texto)).toEqual(["Primera nota", "Segunda nota"]);
  });

  it("un Profesional sin citas con el paciente no lo ve; la Recepcionista sí", async () => {
    const c = await citaAsistida();
    await atencionDe(c.id);
    await expect(obtenerHistorial(sesionDe(e.profesional2), { pacienteId: e.paciente.id })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    const h = await obtenerHistorial(sesionDe(e.recepcionista), { pacienteId: e.paciente.id });
    expect(h.atenciones).toHaveLength(1);
  });

  it("un Profesional con una cita cancelada con el paciente sí lo ve", async () => {
    const otro = await crearPacientePrueba(e.recepcionista.id);
    await citaAsistida({ pacienteId: otro.id, profesionalId: e.profesional2.id, estado: "CANCELADA" });
    const h = await obtenerHistorial(sesionDe(e.profesional2), { pacienteId: otro.id });
    expect(h.atenciones).toHaveLength(0);
  });
});

describe("reversión de estado con atención (FR-021)", () => {
  it("no revierte una cita que tiene atención", async () => {
    const c = await citaAsistida();
    await atencionDe(c.id);
    await expect(
      revertirEstadoCita(sesionDe(e.dueno), { id: c.id, motivo: "Se marcó por error" }),
    ).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
  });
});
