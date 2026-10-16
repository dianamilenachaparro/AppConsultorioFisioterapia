import { beforeEach, describe, expect, it } from "vitest";
import { asegurarCategoriasEgreso } from "@/lib/categorias-egreso";
import { hoyBogota, sumarDias } from "@/lib/tiempo";
import { revertirEstadoCita } from "@/server/citas/estados";
import { prisma } from "@/server/db";
import { anularMovimientoFinanciero } from "@/server/finanzas/anular";
import { obtenerCobrosCita, registrarCobroTerapia } from "@/server/finanzas/cobros";
import { consultarFinanzas } from "@/server/finanzas/consulta";
import { registrarEgreso } from "@/server/finanzas/egresos";
import { exportarFinanzasAGoogle } from "@/server/google/exportar";
import { crearCitaPrueba, escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;
let arriendo: string;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await asegurarCategoriasEgreso(prisma);
  e = await escenarioBase();
  arriendo = (await prisma.categoriaEgreso.findUniqueOrThrow({ where: { clave: "ARRIENDO" } })).id;
});

const D = () => sesionDe(e.dueno);
const R = () => sesionDe(e.recepcionista);
const P = () => sesionDe(e.profesional);
const HOY = () => hoyBogota();
const MANANA_INSTANTE = () => new Date(Date.now() + 86_400_000);

const cita = (estado: "PROGRAMADA" | "ASISTIDA" = "ASISTIDA", profesionalId = e.profesional.id) =>
  crearCitaPrueba({
    pacienteId: e.paciente.id,
    profesionalId,
    consultorioId: e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    fecha: HOY(),
    hora: profesionalId === e.profesional.id ? "08:00" : "10:00",
    estado,
  });

const egreso = (extra: Record<string, unknown> = {}) =>
  registrarEgreso(D(), {
    categoriaId: arriendo,
    fecha: HOY(),
    valor: 1_500_000,
    medioPago: "TRANSFERENCIA",
    descripcion: "Arriendo del local",
    ...extra,
  });

describe("cobros de terapia (FR-037, FR-038)", () => {
  it("solo en citas Asistidas", async () => {
    const c = await cita("PROGRAMADA");
    await expect(registrarCobroTerapia(R(), { citaId: c.id, valor: 80_000, medioPago: "EFECTIVO" })).rejects.toMatchObject({
      codigo: "ESTADO_INVALIDO",
    });
  });

  it("admite abonos: dos cobros en la misma cita quedan vigentes y se suman", async () => {
    const c = await cita();
    await registrarCobroTerapia(P(), { citaId: c.id, valor: 50_000, medioPago: "EFECTIVO" });
    await registrarCobroTerapia(R(), { citaId: c.id, valor: 30_000, medioPago: "TRANSFERENCIA" });
    const r = await obtenerCobrosCita(R(), { citaId: c.id });
    expect(r.cobros).toHaveLength(2);
    expect(r.sumaVigente).toBe(80_000);
  });

  it("el Profesional cobra solo sus citas", async () => {
    const ajena = await cita("ASISTIDA", e.profesional2.id);
    await expect(registrarCobroTerapia(P(), { citaId: ajena.id, valor: 1_000, medioPago: "EFECTIVO" })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    await expect(obtenerCobrosCita(P(), { citaId: ajena.id })).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });

  it("no se revierte una cita con cobro vigente; sí después de anularlo", async () => {
    const c = await cita();
    const cobro = await registrarCobroTerapia(R(), { citaId: c.id, valor: 80_000, medioPago: "EFECTIVO" });
    await expect(revertirEstadoCita(D(), { id: c.id, motivo: "Marcada por error" })).rejects.toMatchObject({
      codigo: "ESTADO_INVALIDO",
    });
    await anularMovimientoFinanciero(D(), { id: cobro.id, motivo: "Cobro equivocado" });
    await revertirEstadoCita(D(), { id: c.id, motivo: "Marcada por error" });
  });
});

describe("anulación de cobros y egresos (FR-044)", () => {
  it("el autor anula su cobro el mismo día; al día siguiente solo el Dueño", async () => {
    const c = await cita();
    const a = await registrarCobroTerapia(R(), { citaId: c.id, valor: 10_000, medioPago: "EFECTIVO" });
    await anularMovimientoFinanciero(R(), { id: a.id, motivo: "Valor equivocado" });
    const b = await registrarCobroTerapia(R(), { citaId: c.id, valor: 20_000, medioPago: "EFECTIVO" });
    await expect(
      anularMovimientoFinanciero(R(), { id: b.id, motivo: "Tarde" }, MANANA_INSTANTE()),
    ).rejects.toMatchObject({ codigo: "FUERA_DE_VENTANA", message: expect.stringContaining("Solicítalo al Dueño") });
    await anularMovimientoFinanciero(D(), { id: b.id, motivo: "Corrige el Dueño" }, MANANA_INSTANTE());
  });

  it("un egreso solo lo anula el Dueño", async () => {
    const g = await egreso();
    await expect(anularMovimientoFinanciero(R(), { id: g.id, motivo: "No me toca" })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    await anularMovimientoFinanciero(D(), { id: g.id, motivo: "Registrado dos veces" });
  });
});

describe("egresos e historial (FR-039, FR-040)", () => {
  it("el egreso exige todos los campos", async () => {
    for (const falta of ["categoriaId", "fecha", "valor", "descripcion"]) {
      await expect(egreso({ [falta]: undefined })).rejects.toMatchObject({ name: "ZodError" });
    }
  });

  it("Recepcionista y Profesional no ven finanzas, no registran egresos ni exportan", async () => {
    for (const s of [R(), P()]) {
      await expect(consultarFinanzas(s, { desde: HOY(), hasta: HOY() })).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
      await expect(registrarEgreso(s, { categoriaId: arriendo, fecha: HOY(), valor: 1, medioPago: "EFECTIVO", descripcion: "x".repeat(5) })).rejects.toMatchObject({
        codigo: "SIN_PERMISO",
      });
      await expect(exportarFinanzasAGoogle(s, { desde: HOY(), hasta: HOY() })).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    }
  });

  it("filtra por rango y medio de pago, y los totales cubren todo el filtro aunque se pagine", async () => {
    const c = await cita();
    for (let i = 0; i < 7; i++) {
      await registrarCobroTerapia(R(), { citaId: c.id, valor: 10_000 + i, medioPago: i % 2 ? "EFECTIVO" : "TRANSFERENCIA" });
    }
    await egreso({ valor: 100_000 });
    await egreso({ valor: 999, fecha: sumarDias(HOY(), -40), descripcion: "Fuera del rango" });
    const r = await consultarFinanzas(
      D(),
      { desde: sumarDias(HOY(), -7), hasta: HOY(), medioPago: "TRANSFERENCIA" },
      { paginar: { pagina: 1, tamano: 2 } },
    );
    expect(r.filas).toHaveLength(2);
    expect(r.total).toBe(5);
    expect(r.totales).toEqual({ ingresos: 10_000 + 10_002 + 10_004 + 10_006, egresos: 100_000, balance: 40_012 - 100_000 });
  });

  it("los anulados se excluyen por defecto y, si se incluyen, no suman", async () => {
    const g = await egreso({ valor: 50_000 });
    await anularMovimientoFinanciero(D(), { id: g.id, motivo: "Duplicado" });
    expect((await consultarFinanzas(D(), { desde: HOY(), hasta: HOY() })).filas).toHaveLength(0);
    const con = await consultarFinanzas(D(), { desde: HOY(), hasta: HOY(), incluirAnulados: true });
    expect(con.filas).toHaveLength(1);
    expect(con.totales.egresos).toBe(0);
  });
});
