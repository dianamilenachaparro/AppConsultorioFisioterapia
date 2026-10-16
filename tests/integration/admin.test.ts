import { beforeEach, describe, expect, it } from "vitest";
import { hoyBogota } from "@/lib/tiempo";
import { consultarAuditoria } from "@/server/auditoria/consulta";
import { autenticar } from "@/server/auth/login";
import { crearSesionEnBD } from "@/server/auth/sesion";
import { crearCita } from "@/server/citas/crear";
import { listarConsultoriosActivos } from "@/server/consultorios/consulta";
import { cambiarEstadoConsultorio, crearConsultorio, editarConsultorio } from "@/server/consultorios/servicio";
import { prisma } from "@/server/db";
import {
  cambiarEstadoUsuario,
  crearUsuario,
  editarUsuario,
  restablecerPassword,
} from "@/server/usuarios/servicio";
import { crearCitaPrueba, escenarioBase, limpiarBaseDeDatos, MANANA, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

const dueno = () => sesionDe(e.dueno);
const nuevoUsuario = (extra: Record<string, unknown> = {}) => ({
  cedula: "1234567890",
  nombreCompleto: "Ana Torres",
  rol: "PROFESIONAL" as const,
  passwordInicial: "temporal123",
  ...extra,
});
const citaFutura = (extra: Partial<Parameters<typeof crearCitaPrueba>[0]> = {}) =>
  crearCitaPrueba({
    pacienteId: e.paciente.id,
    profesionalId: e.profesional.id,
    consultorioId: e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    ...extra,
  });

describe("usuarios (FR-003)", () => {
  it("crea un usuario que entra con su rol y debe cambiar la contraseña", async () => {
    const u = await crearUsuario(dueno(), nuevoUsuario());
    expect(u).toMatchObject({ rol: "PROFESIONAL", atiendePacientes: true, debeCambiarPassword: true });
    const login = await autenticar({ cedula: "1234567890", password: "temporal123" });
    expect(login).toMatchObject({ id: u.id, rol: "PROFESIONAL", debeCambiarPassword: true });
    const reg = await prisma.registroAuditoria.findFirstOrThrow({ where: { accion: "USUARIO_CREAR", entidadId: u.id } });
    expect(JSON.stringify(reg.despues)).not.toMatch(/hash|password/i);
  });

  it("rechaza una cédula repetida", async () => {
    await crearUsuario(dueno(), nuevoUsuario());
    await expect(crearUsuario(dueno(), nuevoUsuario({ nombreCompleto: "Otra persona" }))).rejects.toMatchObject({
      codigo: "DUPLICADO",
    });
  });

  it("una Recepcionista no puede atender pacientes", async () => {
    await expect(
      crearUsuario(dueno(), nuevoUsuario({ rol: "RECEPCIONISTA", atiendePacientes: true })),
    ).rejects.toMatchObject({ codigo: "VALIDACION" });
    await expect(
      editarUsuario(dueno(), { id: e.recepcionista.id, atiendePacientes: true }),
    ).rejects.toMatchObject({ codigo: "VALIDACION" });
    const r = await crearUsuario(dueno(), nuevoUsuario({ rol: "RECEPCIONISTA" }));
    expect(r.atiendePacientes).toBe(false);
  });

  it("pasar un Profesional a Recepcionista le quita atender pacientes y cierra sus sesiones", async () => {
    await crearSesionEnBD(e.profesional2.id);
    const r = await editarUsuario(dueno(), { id: e.profesional2.id, rol: "RECEPCIONISTA" });
    expect(r.atiendePacientes).toBe(false);
    expect(await prisma.sesion.count({ where: { usuarioId: e.profesional2.id } })).toBe(0);
  });

  it("no deja el sistema sin Dueño activo", async () => {
    await expect(cambiarEstadoUsuario(dueno(), { id: e.dueno.id, activo: false })).rejects.toMatchObject({
      codigo: "VALIDACION",
    });
    await expect(editarUsuario(dueno(), { id: e.dueno.id, rol: "PROFESIONAL" })).rejects.toMatchObject({
      codigo: "VALIDACION",
    });
    const otro = await crearUsuario(dueno(), nuevoUsuario({ rol: "DUENO" }));
    await cambiarEstadoUsuario(dueno(), { id: otro.id, activo: false });
    await expect(cambiarEstadoUsuario(dueno(), { id: e.dueno.id, activo: false })).rejects.toMatchObject({
      codigo: "VALIDACION",
    });
  });

  it("desactivar un Profesional con citas futuras pide confirmación y conserva las citas", async () => {
    const c = await citaFutura();
    await expect(cambiarEstadoUsuario(dueno(), { id: e.profesional.id, activo: false })).rejects.toMatchObject({
      codigo: "REQUIERE_CONFIRMACION",
      data: [expect.objectContaining({ id: c.id })],
    });
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: e.profesional.id } })).activo).toBe(true);
    await crearSesionEnBD(e.profesional.id);
    await cambiarEstadoUsuario(dueno(), { id: e.profesional.id, activo: false, confirmar: true });
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: e.profesional.id } })).activo).toBe(false);
    expect(await prisma.cita.count({ where: { id: c.id, estado: "PROGRAMADA" } })).toBe(1);
    expect(await prisma.sesion.count({ where: { usuarioId: e.profesional.id } })).toBe(0);
    await expect(autenticar({ cedula: e.profesional.cedula, password: "clave-prueba-123" })).rejects.toMatchObject({
      codigo: "CREDENCIALES_INVALIDAS",
    });
  });

  it("restablecer contraseña cierra sesiones, quita el bloqueo y exige cambiarla", async () => {
    await prisma.usuario.update({
      where: { id: e.recepcionista.id },
      data: { bloqueadoHasta: new Date(Date.now() + 600_000), intentosFallidos: 3 },
    });
    await crearSesionEnBD(e.recepcionista.id);
    await restablecerPassword(dueno(), { id: e.recepcionista.id, passwordNueva: "nueva-clave-1" });
    expect(await prisma.sesion.count({ where: { usuarioId: e.recepcionista.id } })).toBe(0);
    const u = await autenticar({ cedula: e.recepcionista.cedula, password: "nueva-clave-1" });
    expect(u.debeCambiarPassword).toBe(true);
  });
});

describe("consultorios (FR-007)", () => {
  it("un consultorio nuevo aparece para agendar y el nombre no se repite", async () => {
    const { id } = await crearConsultorio(dueno(), { nombre: "Consultorio 4" });
    expect((await listarConsultoriosActivos()).map((c) => c.id)).toContain(id);
    await expect(crearConsultorio(dueno(), { nombre: "  consultorio 4 " })).rejects.toMatchObject({ codigo: "DUPLICADO" });
    await expect(editarConsultorio(dueno(), { id: e.consultorio.id, nombre: "CONSULTORIO 4" })).rejects.toMatchObject({
      codigo: "DUPLICADO",
    });
  });

  it("desactivado pide confirmación si tiene citas, deja de ofrecerse y no admite nuevas citas", async () => {
    const c = await citaFutura();
    await expect(cambiarEstadoConsultorio(dueno(), { id: e.consultorio.id, activo: false })).rejects.toMatchObject({
      codigo: "REQUIERE_CONFIRMACION",
    });
    await cambiarEstadoConsultorio(dueno(), { id: e.consultorio.id, activo: false, confirmar: true });
    expect((await listarConsultoriosActivos()).map((x) => x.id)).not.toContain(e.consultorio.id);
    expect(await prisma.cita.count({ where: { id: c.id } })).toBe(1);
    await expect(
      crearCita(sesionDe(e.recepcionista), {
        pacienteId: e.paciente.id,
        consultorioId: e.consultorio.id,
        profesionalId: e.profesional2.id,
        fecha: MANANA(),
        horaInicio: "14:00",
        duracionMin: 30,
        motivo: "Dolor lumbar",
        zonaCorporal: "LUMBAR",
      }),
    ).rejects.toMatchObject({ codigo: "VALIDACION" });
  });
});

describe("permisos y auditoría de administración", () => {
  it("la Recepcionista no puede administrar", async () => {
    const r = sesionDe(e.recepcionista);
    await expect(crearUsuario(r, nuevoUsuario())).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(cambiarEstadoUsuario(r, { id: e.profesional.id, activo: false })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    await expect(restablecerPassword(r, { id: e.profesional.id, passwordNueva: "x".repeat(8) })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    await expect(crearConsultorio(r, { nombre: "Consultorio 9" })).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(
      consultarAuditoria(r, { desde: hoyBogota(), hasta: hoyBogota() }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });

  it("la auditoría lista las acciones de administración de hoy", async () => {
    await crearConsultorio(dueno(), { nombre: "Consultorio 5" });
    await crearUsuario(dueno(), nuevoUsuario());
    const r = await consultarAuditoria(dueno(), { desde: hoyBogota(), hasta: hoyBogota(), entidad: "consultorio" });
    expect(r.filas.map((f) => f.accion)).toEqual(["CONSULTORIO_CREAR"]);
    const todas = await consultarAuditoria(dueno(), { desde: hoyBogota(), hasta: hoyBogota() });
    expect(todas.filas[0].accion).toBe("USUARIO_CREAR");
  });
});
