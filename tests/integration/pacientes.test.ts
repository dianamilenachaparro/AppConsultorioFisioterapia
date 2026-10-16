import { beforeEach, describe, expect, it } from "vitest";
import {
  buscarPacientePorDocumento,
  buscarPacientes,
  crearPaciente,
  editarPaciente,
} from "@/server/pacientes/servicio";
import { prisma } from "@/server/db";
import { crearCitaPrueba, crearPacientePrueba, escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

const nuevo = {
  documento: "1.020.304.050",
  nombreCompleto: "Ana María Gómez",
  telefono: "300 123 4567",
  fechaNacimiento: "1985-03-20",
  direccion: "Carrera 10 # 20-30",
  departamento: "Antioquia",
  ciudad: "Medellín",
  barrio: "Laureles",
};

describe("pacientes (US2)", () => {
  it("exige los 8 campos del primer registro", async () => {
    await expect(crearPaciente(sesionDe(e.recepcionista), { ...nuevo, barrio: "" })).rejects.toMatchObject({
      name: "ZodError",
    });
  });

  it("normaliza el documento y rechaza duplicados devolviendo el paciente existente", async () => {
    const r = sesionDe(e.recepcionista);
    const creado = await crearPaciente(r, nuevo);
    expect(creado.documento).toBe("1020304050");
    await expect(crearPaciente(r, { ...nuevo, documento: "1020 304 050" })).rejects.toMatchObject({
      codigo: "DUPLICADO",
      data: { id: creado.id },
    });
  });

  it("carga los datos al buscar por documento (FR-012)", async () => {
    const r = sesionDe(e.recepcionista);
    await crearPaciente(r, nuevo);
    const p = await buscarPacientePorDocumento(r, "1020304050");
    expect(p).toMatchObject({ nombreCompleto: "Ana María Gómez", barrio: "Laureles" });
    expect(await buscarPacientePorDocumento(r, "999999")).toBeNull();
  });

  it("el Profesional solo encuentra pacientes con alguna cita suya", async () => {
    const otro = await crearPacientePrueba(e.recepcionista.id);
    await crearCitaPrueba({
      pacienteId: e.paciente.id,
      profesionalId: e.profesional.id,
      consultorioId: e.consultorio.id,
      creadoPorId: e.recepcionista.id,
    });
    const { filas } = await buscarPacientes(sesionDe(e.profesional), {});
    expect(filas.map((f) => f.id)).toEqual([e.paciente.id]);
    expect(filas.map((f) => f.id)).not.toContain(otro.id);
    await expect(buscarPacientePorDocumento(sesionDe(e.profesional), e.paciente.documento)).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
  });

  it("la Recepcionista edita datos y queda auditado, pero no cambia el documento", async () => {
    const r = sesionDe(e.recepcionista);
    await editarPaciente(r, { id: e.paciente.id, telefono: "3109998877" });
    const log = await prisma.registroAuditoria.findFirst({ where: { accion: "PACIENTE_EDITAR" } });
    expect(log?.antes).toMatchObject({ telefono: "3001234567" });
    await expect(editarPaciente(r, { id: e.paciente.id, documento: "NUEVO123" })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
  });
});
