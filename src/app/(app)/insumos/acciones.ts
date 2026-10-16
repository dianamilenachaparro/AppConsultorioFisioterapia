"use server";

import { revalidatePath } from "next/cache";
import { accion } from "@/server/accion";
import { exigirSesion } from "@/server/auth/sesion";
import {
  anularMovimientoInventario,
  crearInsumo,
  editarInsumo,
  registrarReposicion,
  registrarVenta,
} from "@/server/inventario/servicio";

type MedioPago = "EFECTIVO" | "TRANSFERENCIA";
type DatosInsumo = { nombre: string; costo: string; precioVenta: string; stockMinimo: string };

export async function crearInsumoAccion(datos: DatosInsumo & { stockInicial: string }) {
  return accion(async () => {
    const r = await crearInsumo(await exigirSesion(), datos);
    revalidatePath("/insumos");
    return r;
  });
}

export async function editarInsumoAccion(id: string, datos: Partial<DatosInsumo> & { activo?: boolean }) {
  return accion(async () => {
    await editarInsumo(await exigirSesion(), { id, ...datos });
    revalidatePath("/insumos");
    revalidatePath(`/insumos/${id}`);
  });
}

export async function registrarVentaAccion(datos: { insumoId: string; cantidad: string; medioPago: MedioPago }) {
  return accion(async () => {
    const r = await registrarVenta(await exigirSesion(), datos);
    revalidatePath("/insumos");
    return r;
  });
}

export async function registrarReposicionAccion(datos: {
  insumoId: string;
  cantidad: string;
  costoUnitario: string;
  medioPago: MedioPago;
}) {
  return accion(async () => {
    const r = await registrarReposicion(await exigirSesion(), datos);
    revalidatePath("/insumos");
    revalidatePath(`/insumos/${datos.insumoId}`);
    return r;
  });
}

export async function anularMovimientoInventarioAccion(insumoId: string, id: string, motivo: string) {
  return accion(async () => {
    await anularMovimientoInventario(await exigirSesion(), { id, motivo });
    revalidatePath(`/insumos/${insumoId}`);
  });
}
