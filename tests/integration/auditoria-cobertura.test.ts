import { beforeEach, describe, expect, it } from "vitest";
import { asegurarCategoriasEgreso } from "@/lib/categorias-egreso";
import { hoyBogota, instanteBogota } from "@/lib/tiempo";
import { agregarNotaAclaratoria, editarAtencion, registrarAtencion } from "@/server/atenciones/servicio";
import { crearCita } from "@/server/citas/crear";
import { cancelarCita, marcarAsistida, revertirEstadoCita } from "@/server/citas/estados";
import { reprogramarCita } from "@/server/citas/reprogramar";
import { cambiarEstadoConsultorio, crearConsultorio, editarConsultorio } from "@/server/consultorios/servicio";
import { prisma } from "@/server/db";
import { anularMovimientoFinanciero } from "@/server/finanzas/anular";
import { registrarCobroTerapia } from "@/server/finanzas/cobros";
import { registrarEgreso } from "@/server/finanzas/egresos";
import {
  anularMovimientoInventario,
  crearInsumo,
  editarInsumo,
  registrarReposicion,
  registrarVenta,
} from "@/server/inventario/servicio";
import { corregirMarcacion, marcarFin, marcarIngreso, marcarLlegada } from "@/server/marcaciones/servicio";
import { crearPaciente, editarPaciente } from "@/server/pacientes/servicio";
import { cambiarEstadoUsuario, crearUsuario, editarUsuario, restablecerPassword } from "@/server/usuarios/servicio";
import { crearCitaPrueba, escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;
const HOY = () => hoyBogota();

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await asegurarCategoriasEgreso(prisma);
  e = await escenarioBase();
});

const D = () => sesionDe(e.dueno);
const R = () => sesionDe(e.recepcionista);
const P = () => sesionDe(e.profesional);
const campos = { zonaCorporal: "LUMBAR" as const, motivo: "Dolor", tecnica: "Manual", dolor: 5, notasEvolucion: "Bien" };

const citaHoy = (estado: "PROGRAMADA" | "ASISTIDA" = "PROGRAMADA", hora = "08:00") =>
  crearCitaPrueba({
    pacienteId: e.paciente.id,
    profesionalId: e.profesional.id,
    consultorioId: e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    fecha: HOY(),
    hora,
    estado,
  });

const ultimoId = async () => (await prisma.registroAuditoria.aggregate({ _max: { id: true } }))._max.id ?? BigInt(0);

/** Ejecuta la acción y comprueba que dejó exactamente una fila completa en la auditoría. */
async function unaFila(accionEsperada: string, fn: () => Promise<unknown>) {
  const desde = await ultimoId();
  await fn();
  const nuevas = await prisma.registroAuditoria.findMany({ where: { id: { gt: desde } } });
  expect(nuevas.map((n) => n.accion)).toEqual([accionEsperada]);
  const [fila] = nuevas;
  expect(fila.usuarioId).toBeTruthy();
  expect(fila.entidadId).toBeTruthy();
  expect(fila.creadoEn).toBeInstanceOf(Date);
}

/** Una entrada inválida no deja ninguna fila. */
async function ningunaFila(fn: () => Promise<unknown>) {
  const desde = await ultimoId();
  await expect(fn()).rejects.toBeTruthy();
  expect(await prisma.registroAuditoria.count({ where: { id: { gt: desde } } })).toBe(0);
}

describe("cobertura de auditoría (SC-006)", () => {
  it("citas", async () => {
    const nueva = {
      pacienteId: e.paciente.id,
      consultorioId: e.consultorio.id,
      profesionalId: e.profesional.id,
      fecha: HOY(),
      horaInicio: "09:00",
      duracionMin: 30,
      motivo: "Control",
      zonaCorporal: "LUMBAR" as const,
    };
    await ningunaFila(() => crearCita(R(), { ...nueva, horaInicio: "09:15" }));
    await unaFila("CITA_CREAR", () => crearCita(R(), nueva));
    const c = await citaHoy("PROGRAMADA", "11:00");
    await ningunaFila(() => reprogramarCita(R(), { id: c.id, horaInicio: "11:15" }));
    await unaFila("CITA_REPROGRAMAR", () => reprogramarCita(R(), { id: c.id, horaInicio: "12:00" }));
    await ningunaFila(() => cancelarCita(R(), { id: c.id, observacion: "no" }));
    await unaFila("CITA_CANCELAR", () => cancelarCita(R(), { id: c.id, observacion: "El paciente no puede" }));
    await ningunaFila(() => revertirEstadoCita(D(), { id: c.id, motivo: "x" }));
    await unaFila("CITA_REVERTIR_ESTADO", () => revertirEstadoCita(D(), { id: c.id, motivo: "Se canceló por error" }));
    await unaFila("CITA_MARCAR_ASISTIDA", () => marcarAsistida(R(), { id: c.id }));
  });

  it("marcaciones", async () => {
    const c = await citaHoy();
    await unaFila("MARCACION_REGISTRAR", () => marcarLlegada(P(), { citaId: c.id }));
    await unaFila("MARCACION_REGISTRAR", () => marcarIngreso(P(), { citaId: c.id }));
    await unaFila("MARCACION_REGISTRAR", () => marcarFin(P(), { citaId: c.id }));
    await ningunaFila(() => corregirMarcacion(D(), { citaId: c.id, llegadaEn: instanteBogota(HOY(), "07:00"), motivo: "x" }));
    await unaFila("MARCACION_CORREGIR", () =>
      corregirMarcacion(D(), { citaId: c.id, llegadaEn: instanteBogota(HOY(), "07:00"), motivo: "Olvidó marcar" }),
    );
  });

  it("atenciones y notas", async () => {
    const c = await citaHoy("ASISTIDA");
    await ningunaFila(() => registrarAtencion(P(), { citaId: c.id, ...campos, dolor: 11 }));
    let id = "";
    await unaFila("ATENCION_CREAR", async () => {
      id = (await registrarAtencion(P(), { citaId: c.id, ...campos })).id;
    });
    await ningunaFila(() => editarAtencion(P(), { id, ...campos, tecnica: "" }));
    await unaFila("ATENCION_EDITAR", () => editarAtencion(P(), { id, ...campos, dolor: 3 }));
    await ningunaFila(() => agregarNotaAclaratoria(P(), { atencionId: id, texto: "no" }));
    await unaFila("ATENCION_NOTA_AGREGAR", () => agregarNotaAclaratoria(P(), { atencionId: id, texto: "Nota aclaratoria" }));
  });

  it("inventario", async () => {
    const datos = { nombre: "Gel", costo: 1_000, precioVenta: 2_000, stockInicial: 5, stockMinimo: 1 };
    await ningunaFila(() => crearInsumo(D(), { ...datos, costo: -1 }));
    let insumo = "";
    await unaFila("INSUMO_CREAR", async () => {
      insumo = (await crearInsumo(D(), datos)).id;
    });
    await unaFila("INSUMO_EDITAR", () => editarInsumo(D(), { id: insumo, precioVenta: 2_500 }));
    await ningunaFila(() => registrarVenta(R(), { insumoId: insumo, cantidad: 0, medioPago: "EFECTIVO" }));
    let venta = "";
    await unaFila("INVENTARIO_VENTA", async () => {
      venta = (await registrarVenta(R(), { insumoId: insumo, cantidad: 1, medioPago: "EFECTIVO" })).id;
    });
    await unaFila("INVENTARIO_REPOSICION", () =>
      registrarReposicion(D(), { insumoId: insumo, cantidad: 3, costoUnitario: 900, medioPago: "EFECTIVO" }),
    );
    await ningunaFila(() => anularMovimientoInventario(R(), { id: venta, motivo: "x" }));
    await unaFila("MOVIMIENTO_ANULAR", () => anularMovimientoInventario(R(), { id: venta, motivo: "Venta equivocada" }));
  });

  it("cobros, egresos y anulaciones", async () => {
    const c = await citaHoy("ASISTIDA");
    await ningunaFila(() => registrarCobroTerapia(R(), { citaId: c.id, valor: 0, medioPago: "EFECTIVO" }));
    let cobro = "";
    await unaFila("COBRO_CREAR", async () => {
      cobro = (await registrarCobroTerapia(R(), { citaId: c.id, valor: 50_000, medioPago: "EFECTIVO" })).id;
    });
    const categoria = (await prisma.categoriaEgreso.findFirstOrThrow()).id;
    const egreso = { categoriaId: categoria, fecha: HOY(), valor: 10_000, medioPago: "EFECTIVO" as const, descripcion: "Papelería" };
    await ningunaFila(() => registrarEgreso(D(), { ...egreso, descripcion: "" }));
    await unaFila("EGRESO_CREAR", () => registrarEgreso(D(), egreso));
    await unaFila("MOVIMIENTO_ANULAR", () => anularMovimientoFinanciero(R(), { id: cobro, motivo: "Valor equivocado" }));
  });

  it("usuarios", async () => {
    const nuevo = { cedula: "77777777", nombreCompleto: "Usuario Nuevo", rol: "PROFESIONAL" as const, passwordInicial: "clave12345" };
    await ningunaFila(() => crearUsuario(D(), { ...nuevo, passwordInicial: "corta" }));
    await unaFila("USUARIO_CREAR", () => crearUsuario(D(), nuevo));
    await unaFila("USUARIO_EDITAR", () => editarUsuario(D(), { id: e.profesional2.id, nombreCompleto: "Nombre Editado" }));
    await unaFila("USUARIO_DESACTIVAR", () => cambiarEstadoUsuario(D(), { id: e.profesional2.id, activo: false }));
    await unaFila("USUARIO_RESTABLECER_PASSWORD", () =>
      restablecerPassword(D(), { id: e.profesional2.id, passwordNueva: "temporal-1" }),
    );
  });

  it("consultorios", async () => {
    await ningunaFila(() => crearConsultorio(D(), { nombre: "" }));
    await unaFila("CONSULTORIO_CREAR", () => crearConsultorio(D(), { nombre: "Consultorio 9" }));
    await unaFila("CONSULTORIO_EDITAR", () => editarConsultorio(D(), { id: e.consultorio2.id, nombre: "Sala B" }));
    await unaFila("CONSULTORIO_DESACTIVAR", () => cambiarEstadoConsultorio(D(), { id: e.consultorio2.id, activo: false }));
  });

  it("pacientes", async () => {
    const datos = {
      documento: "AUD123",
      nombreCompleto: "Paciente Auditoría",
      telefono: "3000000000",
      fechaNacimiento: "1990-01-01",
      direccion: "Calle 1",
      departamento: "Antioquia",
      ciudad: "Medellín",
      barrio: "Centro",
    };
    await ningunaFila(() => crearPaciente(R(), { ...datos, telefono: "" }));
    await unaFila("PACIENTE_CREAR", () => crearPaciente(R(), datos));
    await unaFila("PACIENTE_EDITAR", () => editarPaciente(R(), { id: e.paciente.id, telefono: "3111111111" }));
  });
});
