/**
 * Fuente única de la matriz de permisos (spec.md → "Matriz de permisos").
 * La usan los servicios del servidor (autorización real), los layouts (menús) y las pruebas.
 * Los permisos "propios" se completan con filtros dentro de cada consulta
 * (por ejemplo `profesional_id = sesion.usuarioId`).
 */

export type Rol = "DUENO" | "RECEPCIONISTA" | "PROFESIONAL";

export const ACCIONES = [
  "agenda:ver_todas",
  "agenda:ver_propia",
  "citas:gestionar",
  "citas:revertir_estado",
  "citas:listar",
  "pacientes:gestionar",
  "pacientes:consultar_propios",
  "atenciones:registrar",
  "historial:ver_todos",
  "historial:ver_propios",
  "marcaciones:registrar",
  "marcaciones:corregir",
  "indicadores:ver_todos",
  "indicadores:ver_propios",
  "cobro:registrar",
  "inventario:vender",
  "inventario:gestionar",
  "movimientos:ver_propios_hoy",
  "movimientos:anular_propios_hoy",
  "movimientos:anular_todos",
  "finanzas:ver",
  "finanzas:egresos",
  "finanzas:exportar",
  "admin:usuarios",
  "admin:consultorios",
  "admin:auditoria",
] as const;

export type Accion = (typeof ACCIONES)[number];

export const MATRIZ: Record<Rol, ReadonlySet<Accion>> = {
  DUENO: new Set<Accion>([
    "agenda:ver_todas",
    // Solo aplica cuando el Dueño es el profesional de la cita (FR-028, supuestos).
    "agenda:ver_propia",
    "citas:gestionar",
    "citas:revertir_estado",
    "citas:listar",
    "pacientes:gestionar",
    "atenciones:registrar",
    "historial:ver_todos",
    "marcaciones:registrar",
    "marcaciones:corregir",
    "indicadores:ver_todos",
    "cobro:registrar",
    "inventario:vender",
    "inventario:gestionar",
    "movimientos:anular_todos",
    "finanzas:ver",
    "finanzas:egresos",
    "finanzas:exportar",
    "admin:usuarios",
    "admin:consultorios",
    "admin:auditoria",
  ]),
  RECEPCIONISTA: new Set<Accion>([
    "agenda:ver_todas",
    "citas:gestionar",
    "citas:listar",
    "pacientes:gestionar",
    "historial:ver_todos",
    "cobro:registrar",
    "inventario:vender",
    "movimientos:ver_propios_hoy",
    "movimientos:anular_propios_hoy",
  ]),
  PROFESIONAL: new Set<Accion>([
    "agenda:ver_propia",
    "citas:listar",
    "pacientes:consultar_propios",
    "atenciones:registrar",
    "historial:ver_propios",
    "marcaciones:registrar",
    "indicadores:ver_propios",
    "cobro:registrar",
    "movimientos:ver_propios_hoy",
    "movimientos:anular_propios_hoy",
  ]),
};

export function puede(rol: Rol, accion: Accion): boolean {
  return MATRIZ[rol].has(accion);
}

export function puedeAlguna(rol: Rol, acciones: readonly Accion[]): boolean {
  return acciones.some((a) => puede(rol, a));
}

export const NOMBRE_ROL: Record<Rol, string> = {
  DUENO: "Dueño",
  RECEPCIONISTA: "Recepcionista",
  PROFESIONAL: "Profesional",
};
