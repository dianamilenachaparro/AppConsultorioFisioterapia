import { beforeEach, describe, expect, it } from "vitest";
import { asegurarCategoriasEgreso } from "@/lib/categorias-egreso";
import { prisma } from "@/server/db";
import { anularMiMovimiento, listarMisMovimientosHoy } from "@/server/finanzas/mis-movimientos";
import {
  anularMovimientoInventario,
  crearInsumo,
  listarInsumos,
  registrarReposicion,
  registrarVenta,
} from "@/server/inventario/servicio";
import { escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await asegurarCategoriasEgreso(prisma);
  e = await escenarioBase();
});

const D = () => sesionDe(e.dueno);
const R = () => sesionDe(e.recepcionista);
const MANANA_INSTANTE = () => new Date(Date.now() + 86_400_000);

async function insumo(stockInicial = 10, extra: Record<string, unknown> = {}) {
  const { id } = await crearInsumo(D(), {
    nombre: `Gel ${Math.random().toString(36).slice(2, 8)}`,
    costo: 10_000,
    precioVenta: 20_000,
    stockInicial,
    stockMinimo: 3,
    ...extra,
  });
  return id;
}
const stock = async (id: string) => (await prisma.insumo.findUniqueOrThrow({ where: { id } })).stock;

/** SC-007: stock = Σ(AJUSTE_INICIAL + REPOSICION) − Σ(VENTA) no anulados, y un financiero por venta/reposición. */
async function verificarInvariante(insumoId: string) {
  const movs = await prisma.movimientoInventario.findMany({ where: { insumoId }, include: { financiero: true } });
  const esperado = movs
    .filter((m) => !m.anulado)
    .reduce((s, m) => s + (m.tipo === "VENTA" ? -m.cantidad : m.cantidad), 0);
  expect(await stock(insumoId)).toBe(esperado);
  for (const m of movs) {
    if (m.tipo === "AJUSTE_INICIAL") expect(m.financiero).toBeNull();
    else {
      expect(m.financiero).not.toBeNull();
      expect(m.financiero!.anulado).toBe(m.anulado);
    }
  }
}

describe("ventas y reposiciones (FR-034, FR-035)", () => {
  it("crear con stock inicial genera AJUSTE_INICIAL sin movimiento financiero", async () => {
    const id = await insumo(5);
    const movs = await prisma.movimientoInventario.findMany({ where: { insumoId: id }, include: { financiero: true } });
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ tipo: "AJUSTE_INICIAL", cantidad: 5, financiero: null });
  });

  it("venta: descuenta stock y crea el ingreso por cantidad × precio", async () => {
    const id = await insumo(10);
    await registrarVenta(R(), { insumoId: id, cantidad: 3, medioPago: "TRANSFERENCIA" });
    expect(await stock(id)).toBe(7);
    const fin = await prisma.movimientoFinanciero.findFirstOrThrow({ where: { subtipoIngreso: "VENTA_INSUMOS" } });
    expect(fin).toMatchObject({ tipo: "INGRESO", valor: 60_000, medioPago: "TRANSFERENCIA", creadoPorId: e.recepcionista.id });
  });

  it("venta sin stock suficiente se rechaza y no cambia nada", async () => {
    const id = await insumo(2);
    await expect(registrarVenta(R(), { insumoId: id, cantidad: 8, medioPago: "EFECTIVO" })).rejects.toMatchObject({
      codigo: "STOCK_INSUFICIENTE",
    });
    expect(await stock(id)).toBe(2);
    expect(await prisma.movimientoFinanciero.count()).toBe(0);
    expect(await prisma.movimientoInventario.count({ where: { tipo: "VENTA" } })).toBe(0);
  });

  it("reposición: suma stock y crea el egreso COMPRA_INSUMOS", async () => {
    const id = await insumo(10);
    await registrarReposicion(D(), { insumoId: id, cantidad: 20, costoUnitario: 9_000, medioPago: "EFECTIVO" });
    expect(await stock(id)).toBe(30);
    const fin = await prisma.movimientoFinanciero.findFirstOrThrow({
      where: { tipo: "EGRESO" },
      include: { categoriaEgreso: true },
    });
    expect(fin.valor).toBe(180_000);
    expect(fin.categoriaEgreso?.clave).toBe("COMPRA_INSUMOS");
  });

  it("la Recepcionista no repone y el Profesional no vende", async () => {
    const id = await insumo(10);
    await expect(
      registrarReposicion(R(), { insumoId: id, cantidad: 1, costoUnitario: 1, medioPago: "EFECTIVO" }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(
      registrarVenta(sesionDe(e.profesional), { insumoId: id, cantidad: 1, medioPago: "EFECTIVO" }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });

  it("marca bajo el mínimo y la Recepcionista solo ve insumos activos", async () => {
    const bajo = await insumo(2);
    const inactivo = await insumo(10);
    await prisma.insumo.update({ where: { id: inactivo }, data: { activo: false } });
    const lista = await listarInsumos(R());
    expect(lista.map((i) => i.id)).toEqual([bajo]);
    expect(lista[0].bajoMinimo).toBe(true);
    expect(lista[0]).not.toHaveProperty("costo");
  });

  it("nombre único sin distinguir mayúsculas", async () => {
    await insumo(1, { nombre: "Cojín cervical" });
    await expect(insumo(1, { nombre: "COJÍN CERVICAL" })).rejects.toMatchObject({ codigo: "DUPLICADO" });
  });
});

describe("anulación (FR-044)", () => {
  it("la Recepcionista anula su venta de hoy: repone stock y anula el ingreso", async () => {
    const id = await insumo(10);
    const v = await registrarVenta(R(), { insumoId: id, cantidad: 4, medioPago: "EFECTIVO" });
    await anularMovimientoInventario(R(), { id: v.id, motivo: "Se equivocó de producto" });
    expect(await stock(id)).toBe(10);
    const fin = await prisma.movimientoFinanciero.findFirstOrThrow({ where: { movimientoInventarioId: v.id } });
    expect(fin).toMatchObject({ anulado: true, motivoAnulacion: "Se equivocó de producto" });
    await expect(
      anularMovimientoInventario(D(), { id: v.id, motivo: "Otra vez" }),
    ).rejects.toMatchObject({ codigo: "ESTADO_INVALIDO" });
  });

  it("al día siguiente la Recepcionista ya no puede; el Dueño sí", async () => {
    const id = await insumo(10);
    const v = await registrarVenta(R(), { insumoId: id, cantidad: 1, medioPago: "EFECTIVO" });
    await expect(
      anularMovimientoInventario(R(), { id: v.id, motivo: "Tarde" }, MANANA_INSTANTE()),
    ).rejects.toMatchObject({ codigo: "FUERA_DE_VENTANA" });
    await anularMovimientoInventario(D(), { id: v.id, motivo: "Corrección del Dueño" }, MANANA_INSTANTE());
    expect(await stock(id)).toBe(10);
  });

  it("no anula ventas de otros ni reposiciones", async () => {
    const id = await insumo(10);
    const ajena = await registrarVenta(D(), { insumoId: id, cantidad: 1, medioPago: "EFECTIVO" });
    const repo = await registrarReposicion(D(), { insumoId: id, cantidad: 5, costoUnitario: 1_000, medioPago: "EFECTIVO" });
    await expect(anularMovimientoInventario(R(), { id: ajena.id, motivo: "No es mía" })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
    await expect(anularMovimientoInventario(R(), { id: repo.id, motivo: "No me toca" })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
  });

  it("anular una reposición que dejaría el stock negativo se rechaza", async () => {
    const id = await insumo(0);
    const repo = await registrarReposicion(D(), { insumoId: id, cantidad: 5, costoUnitario: 1_000, medioPago: "EFECTIVO" });
    await registrarVenta(D(), { insumoId: id, cantidad: 4, medioPago: "EFECTIVO" });
    await expect(anularMovimientoInventario(D(), { id: repo.id, motivo: "Compra duplicada" })).rejects.toMatchObject({
      codigo: "STOCK_INSUFICIENTE",
    });
    expect(await stock(id)).toBe(1);
  });

  it("el invariante de stock se mantiene tras 50 operaciones aleatorias (SC-007)", async () => {
    const id = await insumo(10);
    let semilla = 42;
    const azar = () => ((semilla = (semilla * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
    const hechos: string[] = [];
    for (let i = 0; i < 50; i++) {
      const op = azar();
      try {
        if (op < 0.45) {
          hechos.push((await registrarVenta(R(), { insumoId: id, cantidad: 1 + Math.floor(azar() * 4), medioPago: "EFECTIVO" })).id);
        } else if (op < 0.75) {
          const r = await registrarReposicion(D(), { insumoId: id, cantidad: 1 + Math.floor(azar() * 5), costoUnitario: 1_000, medioPago: "TRANSFERENCIA" });
          hechos.push(r.id);
        } else if (hechos.length) {
          const elegido = hechos.splice(Math.floor(azar() * hechos.length), 1)[0];
          await anularMovimientoInventario(D(), { id: elegido, motivo: "Prueba aleatoria" });
        }
      } catch (err) {
        expect(err).toMatchObject({ codigo: "STOCK_INSUFICIENTE" });
      }
    }
    await verificarInvariante(id);
  });
});

describe("mis movimientos de hoy (FR-041)", () => {
  it("lista solo los propios de hoy, sin totales, y permite anularlos", async () => {
    const id = await insumo(10);
    await registrarVenta(R(), { insumoId: id, cantidad: 1, medioPago: "EFECTIVO" });
    await registrarVenta(D(), { insumoId: id, cantidad: 2, medioPago: "EFECTIVO" });
    const lista = await listarMisMovimientosHoy(R());
    expect(Array.isArray(lista)).toBe(true);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ valor: 20_000, anulable: true });
    await anularMiMovimiento(R(), { id: lista[0].id, motivo: "Cliente devolvió el producto" });
    expect(await stock(id)).toBe(8);
    const despues = await listarMisMovimientosHoy(R());
    expect(despues[0]).toMatchObject({ anulado: true, anulable: false });
    expect(await listarMisMovimientosHoy(R(), MANANA_INSTANTE())).toHaveLength(0);
  });
});
