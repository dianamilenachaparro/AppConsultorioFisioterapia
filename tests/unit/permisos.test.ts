import { describe, expect, it } from "vitest";
import { ACCIONES, MATRIZ, puede, type Accion, type Rol } from "@/lib/permisos";

/**
 * Tabla esperada escrita a mano desde la "Matriz de permisos" de spec.md
 * (incluidas las filas aclaradas el 2026-10-14). Si cambia la matriz, debe cambiar aquí.
 */
const ESPERADO: Record<Accion, Record<Rol, boolean>> = {
  "agenda:ver_todas": { DUENO: true, RECEPCIONISTA: true, PROFESIONAL: false },
  "agenda:ver_propia": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: true },
  "citas:gestionar": { DUENO: true, RECEPCIONISTA: true, PROFESIONAL: false },
  "citas:revertir_estado": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "citas:listar": { DUENO: true, RECEPCIONISTA: true, PROFESIONAL: true },
  "pacientes:gestionar": { DUENO: true, RECEPCIONISTA: true, PROFESIONAL: false },
  "pacientes:consultar_propios": { DUENO: false, RECEPCIONISTA: false, PROFESIONAL: true },
  "atenciones:registrar": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: true },
  "historial:ver_todos": { DUENO: true, RECEPCIONISTA: true, PROFESIONAL: false },
  "historial:ver_propios": { DUENO: false, RECEPCIONISTA: false, PROFESIONAL: true },
  "marcaciones:registrar": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: true },
  "marcaciones:corregir": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "indicadores:ver_todos": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "indicadores:ver_propios": { DUENO: false, RECEPCIONISTA: false, PROFESIONAL: true },
  "cobro:registrar": { DUENO: true, RECEPCIONISTA: true, PROFESIONAL: true },
  "inventario:vender": { DUENO: true, RECEPCIONISTA: true, PROFESIONAL: false },
  "inventario:gestionar": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "movimientos:ver_propios_hoy": { DUENO: false, RECEPCIONISTA: true, PROFESIONAL: true },
  "movimientos:anular_propios_hoy": { DUENO: false, RECEPCIONISTA: true, PROFESIONAL: true },
  "movimientos:anular_todos": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "finanzas:ver": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "finanzas:egresos": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "finanzas:exportar": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "admin:usuarios": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "admin:consultorios": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
  "admin:auditoria": { DUENO: true, RECEPCIONISTA: false, PROFESIONAL: false },
};

const ROLES: Rol[] = ["DUENO", "RECEPCIONISTA", "PROFESIONAL"];

describe("matriz de permisos", () => {
  it("la tabla esperada cubre todas las acciones", () => {
    expect(Object.keys(ESPERADO).sort()).toEqual([...ACCIONES].sort());
  });

  for (const accion of ACCIONES) {
    for (const rol of ROLES) {
      it(`${rol} ${ESPERADO[accion][rol] ? "puede" : "no puede"} ${accion}`, () => {
        expect(puede(rol, accion)).toBe(ESPERADO[accion][rol]);
      });
    }
  }

  it("no hay acciones en la matriz fuera de la lista", () => {
    for (const rol of ROLES) {
      for (const a of MATRIZ[rol]) expect(ACCIONES).toContain(a);
    }
  });
});
