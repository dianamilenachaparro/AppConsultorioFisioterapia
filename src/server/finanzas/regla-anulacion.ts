/** Regla de anulación (FR-044, data-model.md → "Regla de anulación"). Pura, sin acceso a datos. */
import { esMismoDiaBogota } from "@/lib/tiempo";

export type MovimientoAnulable = {
  creadoPorId: string;
  creadoEn: Date;
  tipo: "INGRESO" | "EGRESO";
  subtipoIngreso: "TERAPIA" | "VENTA_INSUMOS" | null;
};

export type Veredicto = "PERMITIDO" | "SIN_PERMISO" | "FUERA_DE_VENTANA";

/**
 * El Dueño anula todo. Recepcionista y Profesional solo cobros de terapia y ventas de
 * insumos que registraron ellos mismos, y solo el mismo día (Bogotá). Egresos y
 * reposiciones: solo el Dueño.
 */
export function veredictoAnulacion(
  sesion: { usuarioId: string; rol: "DUENO" | "RECEPCIONISTA" | "PROFESIONAL" },
  mov: MovimientoAnulable,
  ahora: Date,
): Veredicto {
  if (sesion.rol === "DUENO") return "PERMITIDO";
  if (mov.tipo !== "INGRESO" || mov.creadoPorId !== sesion.usuarioId) return "SIN_PERMISO";
  return esMismoDiaBogota(mov.creadoEn, ahora) ? "PERMITIDO" : "FUERA_DE_VENTANA";
}

export function puedeAnular(
  sesion: Parameters<typeof veredictoAnulacion>[0],
  mov: MovimientoAnulable,
  ahora: Date,
) {
  return veredictoAnulacion(sesion, mov, ahora) === "PERMITIDO";
}
