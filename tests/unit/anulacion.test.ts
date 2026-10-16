import { describe, expect, it } from "vitest";
import { instanteBogota } from "@/lib/tiempo";
import { puedeAnular, veredictoAnulacion, type MovimientoAnulable } from "@/server/finanzas/regla-anulacion";

const AUTOR = "autor";
const venta = (creadoEn: Date): MovimientoAnulable => ({
  creadoPorId: AUTOR,
  creadoEn,
  tipo: "INGRESO",
  subtipoIngreso: "VENTA_INSUMOS",
});
const registrada = instanteBogota("2026-10-15", "08:00");

describe("regla de anulación (FR-044)", () => {
  it("el Dueño anula siempre, incluso egresos de otros días", () => {
    const egreso: MovimientoAnulable = { creadoPorId: "otro", creadoEn: registrada, tipo: "EGRESO", subtipoIngreso: null };
    expect(puedeAnular({ usuarioId: "dueno", rol: "DUENO" }, egreso, instanteBogota("2026-12-01", "10:00"))).toBe(true);
  });

  it("el autor anula hasta las 23:59 del mismo día en Bogotá", () => {
    const r = { usuarioId: AUTOR, rol: "RECEPCIONISTA" as const };
    expect(puedeAnular(r, venta(registrada), instanteBogota("2026-10-15", "23:59"))).toBe(true);
    expect(veredictoAnulacion(r, venta(registrada), instanteBogota("2026-10-16", "00:00"))).toBe("FUERA_DE_VENTANA");
  });

  it("quien no es el autor no anula (Recepcionista ni Profesional)", () => {
    const ahora = instanteBogota("2026-10-15", "09:00");
    expect(veredictoAnulacion({ usuarioId: "otra", rol: "RECEPCIONISTA" }, venta(registrada), ahora)).toBe("SIN_PERMISO");
    expect(veredictoAnulacion({ usuarioId: "prof", rol: "PROFESIONAL" }, venta(registrada), ahora)).toBe("SIN_PERMISO");
  });

  it("los egresos (reposiciones) solo los anula el Dueño, aunque los haya registrado otro", () => {
    const egreso: MovimientoAnulable = { creadoPorId: AUTOR, creadoEn: registrada, tipo: "EGRESO", subtipoIngreso: null };
    expect(veredictoAnulacion({ usuarioId: AUTOR, rol: "RECEPCIONISTA" }, egreso, registrada)).toBe("SIN_PERMISO");
  });
});
