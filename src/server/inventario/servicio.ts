import "server-only";
import type { z } from "zod";
import { formatearCOP } from "@/lib/dinero";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { columnaDateDeFecha, hoyBogota } from "@/lib/tiempo";
import { uuid } from "@/lib/validacion/comunes";
import {
  anulacionSchema,
  crearInsumoSchema,
  editarInsumoSchema,
  reposicionSchema,
  ventaSchema,
} from "@/lib/validacion/inventario";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma, type Tx } from "@/server/db";
import { exigirAnulable } from "@/server/finanzas/anulacion";

const nombreDuplicado = () =>
  new ErrorDominio("DUPLICADO", "Ya existe un insumo con ese nombre", undefined, { nombre: ["Nombre en uso"] });

async function exigirNombreLibre(tx: Tx, nombre: string, exceptoId?: string) {
  const otro = await tx.insumo.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) },
    select: { id: true },
  });
  if (otro) throw nombreDuplicado();
}

/** Bloquea la fila del insumo para el resto de la transacción. */
async function bloquearInsumo(tx: Tx, id: string) {
  const filas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM insumo WHERE id = ${id}::uuid FOR UPDATE`;
  if (filas.length === 0) throw new ErrorDominio("NO_ENCONTRADO", "Insumo no encontrado");
  return tx.insumo.findUniqueOrThrow({ where: { id } });
}

async function categoriaCompraInsumos(tx: Tx) {
  const c = await tx.categoriaEgreso.findUnique({ where: { clave: "COMPRA_INSUMOS" }, select: { id: true } });
  if (!c) throw new Error("Falta la categoría de egreso COMPRA_INSUMOS: ejecuta pnpm db:seed");
  return c.id;
}

const fechaMovimiento = (fecha: string | undefined, ahora: Date) => columnaDateDeFecha(fecha ?? hoyBogota(ahora));

/** D: todos los insumos; R: solo los activos, para vender. Incluye la alerta de stock bajo (FR-036). */
export async function listarInsumos(sesion: Sesion) {
  exigirPermiso(sesion, ["inventario:gestionar", "inventario:vender"]);
  const gestiona = sesion.rol === "DUENO";
  const insumos = await prisma.insumo.findMany({
    where: gestiona ? {} : { activo: true },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });
  return insumos.map((i) => ({
    id: i.id,
    nombre: i.nombre,
    precioVenta: i.precioVenta,
    stock: i.stock,
    stockMinimo: i.stockMinimo,
    activo: i.activo,
    bajoMinimo: i.stock < i.stockMinimo,
    ...(gestiona ? { costo: i.costo } : {}),
  }));
}

export async function obtenerInsumo(sesion: Sesion, id: string) {
  exigirPermiso(sesion, "inventario:gestionar");
  const i = uuid.safeParse(id).success ? await prisma.insumo.findUnique({ where: { id } }) : null;
  if (!i) throw new ErrorDominio("NO_ENCONTRADO", "Insumo no encontrado");
  return { ...i, bajoMinimo: i.stock < i.stockMinimo };
}

/** Crea el insumo; el stock inicial entra como movimiento AJUSTE_INICIAL sin efecto financiero. */
export async function crearInsumo(sesion: Sesion, entrada: z.input<typeof crearInsumoSchema>, ahora = new Date()) {
  exigirPermiso(sesion, "inventario:gestionar");
  const d = crearInsumoSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      await exigirNombreLibre(tx, d.nombre);
      const insumo = await tx.insumo.create({
        data: { nombre: d.nombre, costo: d.costo, precioVenta: d.precioVenta, stock: d.stockInicial, stockMinimo: d.stockMinimo },
      });
      if (d.stockInicial > 0) {
        await tx.movimientoInventario.create({
          data: {
            insumoId: insumo.id,
            tipo: "AJUSTE_INICIAL",
            cantidad: d.stockInicial,
            valorUnitario: d.costo,
            fecha: fechaMovimiento(undefined, ahora),
            creadoPorId: sesion.usuarioId,
          },
        });
      }
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "INSUMO_CREAR",
        entidad: "insumo",
        entidadId: insumo.id,
        despues: { ...d },
      });
      return { id: insumo.id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

export async function editarInsumo(sesion: Sesion, entrada: z.input<typeof editarInsumoSchema>) {
  exigirPermiso(sesion, "inventario:gestionar");
  const { id, ...cambios } = editarInsumoSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await tx.insumo.findUnique({ where: { id } });
      if (!actual) throw new ErrorDominio("NO_ENCONTRADO", "Insumo no encontrado");
      if (cambios.nombre) await exigirNombreLibre(tx, cambios.nombre, id);
      const nuevo = await tx.insumo.update({ where: { id }, data: cambios });
      const campos = (i: typeof actual) => ({
        nombre: i.nombre,
        costo: i.costo,
        precioVenta: i.precioVenta,
        stockMinimo: i.stockMinimo,
        activo: i.activo,
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "INSUMO_EDITAR",
        entidad: "insumo",
        entidadId: id,
        antes: campos(actual),
        despues: campos(nuevo),
      });
      return { id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/** Venta: descuenta stock y genera el ingreso VENTA_INSUMOS en la misma transacción (FR-034). */
export async function registrarVenta(sesion: Sesion, entrada: z.input<typeof ventaSchema>, ahora = new Date()) {
  exigirPermiso(sesion, "inventario:vender");
  const d = ventaSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const insumo = await bloquearInsumo(tx, d.insumoId);
      if (!insumo.activo) throw new ErrorDominio("VALIDACION", "El insumo no está activo");
      if (insumo.stock < d.cantidad) {
        throw new ErrorDominio("STOCK_INSUFICIENTE", `Solo hay ${insumo.stock} unidad(es) de ${insumo.nombre}`);
      }
      const fecha = fechaMovimiento(d.fecha, ahora);
      const valor = d.cantidad * insumo.precioVenta;
      await tx.insumo.update({ where: { id: insumo.id }, data: { stock: { decrement: d.cantidad } } });
      const mov = await tx.movimientoInventario.create({
        data: {
          insumoId: insumo.id,
          tipo: "VENTA",
          cantidad: d.cantidad,
          valorUnitario: insumo.precioVenta,
          fecha,
          creadoPorId: sesion.usuarioId,
        },
      });
      // Un insumo con precio 0 no genera ingreso (valor > 0 en la BD).
      if (valor > 0) {
        await tx.movimientoFinanciero.create({
          data: {
            tipo: "INGRESO",
            subtipoIngreso: "VENTA_INSUMOS",
            fecha,
            valor,
            medioPago: d.medioPago,
            descripcion: `Venta de ${d.cantidad} × ${insumo.nombre}`,
            movimientoInventarioId: mov.id,
            creadoPorId: sesion.usuarioId,
          },
        });
      }
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "INVENTARIO_VENTA",
        entidad: "movimiento_inventario",
        entidadId: mov.id,
        despues: { insumo: insumo.nombre, cantidad: d.cantidad, valor, medioPago: d.medioPago },
      });
      return { id: mov.id, valor, total: formatearCOP(valor) };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/** Reposición (solo Dueño): suma stock y genera el egreso COMPRA_INSUMOS (FR-035). */
export async function registrarReposicion(sesion: Sesion, entrada: z.input<typeof reposicionSchema>, ahora = new Date()) {
  exigirPermiso(sesion, "inventario:gestionar");
  const d = reposicionSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const insumo = await bloquearInsumo(tx, d.insumoId);
      const fecha = fechaMovimiento(d.fecha, ahora);
      const valor = d.cantidad * d.costoUnitario;
      await tx.insumo.update({ where: { id: insumo.id }, data: { stock: { increment: d.cantidad } } });
      const mov = await tx.movimientoInventario.create({
        data: {
          insumoId: insumo.id,
          tipo: "REPOSICION",
          cantidad: d.cantidad,
          valorUnitario: d.costoUnitario,
          fecha,
          creadoPorId: sesion.usuarioId,
        },
      });
      if (valor > 0) {
        await tx.movimientoFinanciero.create({
          data: {
            tipo: "EGRESO",
            categoriaEgresoId: await categoriaCompraInsumos(tx),
            fecha,
            valor,
            medioPago: d.medioPago,
            descripcion: `Compra de ${d.cantidad} × ${insumo.nombre}`,
            movimientoInventarioId: mov.id,
            creadoPorId: sesion.usuarioId,
          },
        });
      }
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "INVENTARIO_REPOSICION",
        entidad: "movimiento_inventario",
        entidadId: mov.id,
        despues: { insumo: insumo.nombre, cantidad: d.cantidad, costoUnitario: d.costoUnitario, valor },
      });
      return { id: mov.id, valor };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/**
 * Anula una venta o reposición: revierte el stock (falla si quedaría negativo) y anula
 * el movimiento financiero enlazado, todo en una transacción. Aplica la regla de anulación
 * sobre el financiero (FR-044); un ajuste inicial o un movimiento sin financiero, solo el Dueño.
 */
export async function anularMovimientoInventario(
  sesion: Sesion,
  entrada: z.input<typeof anulacionSchema>,
  ahora = new Date(),
) {
  exigirPermiso(sesion, ["inventario:gestionar", "movimientos:anular_propios_hoy", "movimientos:anular_todos"]);
  const { id, motivo } = anulacionSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ insumo_id: string }[]>`
        SELECT insumo_id FROM movimiento_inventario WHERE id = ${id}::uuid FOR UPDATE`;
      if (filas.length === 0) throw new ErrorDominio("NO_ENCONTRADO", "Movimiento no encontrado");
      const insumo = await bloquearInsumo(tx, filas[0].insumo_id);
      const mov = await tx.movimientoInventario.findUniqueOrThrow({ where: { id }, include: { financiero: true } });
      const fin = mov.financiero;
      if (fin) exigirAnulable(sesion, { ...fin, anulado: mov.anulado }, ahora);
      else if (sesion.rol !== "DUENO") throw new ErrorDominio("SIN_PERMISO");
      if (mov.anulado) throw new ErrorDominio("ESTADO_INVALIDO", "El movimiento ya está anulado");

      const delta = mov.tipo === "VENTA" ? mov.cantidad : -mov.cantidad;
      if (insumo.stock + delta < 0) {
        throw new ErrorDominio("STOCK_INSUFICIENTE", "No se puede anular: el stock quedaría negativo");
      }
      await tx.insumo.update({ where: { id: insumo.id }, data: { stock: { increment: delta } } });
      const anulacion = { anulado: true, anuladoPorId: sesion.usuarioId, anuladoEn: ahora, motivoAnulacion: motivo };
      await tx.movimientoInventario.update({ where: { id }, data: anulacion });
      if (fin) await tx.movimientoFinanciero.update({ where: { id: fin.id }, data: anulacion });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "MOVIMIENTO_ANULAR",
        entidad: "movimiento_inventario",
        entidadId: id,
        antes: { anulado: false, stock: insumo.stock },
        despues: { anulado: true, stock: insumo.stock + delta },
        motivo,
      });
      return { id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}

/** Historial de movimientos de un insumo (solo Dueño), del más reciente al más antiguo. */
export async function listarMovimientosInsumo(sesion: Sesion, insumoId: string) {
  exigirPermiso(sesion, "inventario:gestionar");
  return prisma.movimientoInventario.findMany({
    where: { insumoId: uuid.parse(insumoId) },
    orderBy: { creadoEn: "desc" },
    include: {
      creadoPor: { select: { nombreCompleto: true } },
      financiero: { select: { valor: true, medioPago: true } },
    },
  });
}
