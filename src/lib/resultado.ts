import { z } from "zod";

/** Códigos de error de las acciones del servidor (contracts/server-actions.md). */
export type CodigoError =
  | "NO_AUTENTICADO"
  | "SIN_PERMISO"
  | "VALIDACION"
  | "NO_ENCONTRADO"
  | "CONFLICTO_CONSULTORIO"
  | "CONFLICTO_PROFESIONAL"
  | "CONFLICTO_PACIENTE"
  | "FUERA_DE_HORARIO"
  | "ESTADO_INVALIDO"
  | "STOCK_INSUFICIENTE"
  | "DUPLICADO"
  | "FUERA_DE_VENTANA"
  | "REQUIERE_CONFIRMACION"
  | "CREDENCIALES_INVALIDAS"
  | "ERROR_GOOGLE"
  | "ERROR_INTERNO";

export type Resultado<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: CodigoError;
      mensaje: string;
      campos?: Record<string, string[]>;
      data?: unknown;
    };

export type Fallo = Extract<Resultado<never>, { ok: false }>;

const MENSAJES: Record<CodigoError, string> = {
  NO_AUTENTICADO: "Tu sesión expiró. Vuelve a iniciar sesión.",
  SIN_PERMISO: "No tienes permiso para realizar esta acción.",
  VALIDACION: "Revisa los datos ingresados.",
  NO_ENCONTRADO: "No se encontró el registro.",
  CONFLICTO_CONSULTORIO: "El consultorio ya está ocupado en ese horario.",
  CONFLICTO_PROFESIONAL: "El profesional no está disponible en ese horario.",
  CONFLICTO_PACIENTE: "El paciente ya tiene una cita en ese horario.",
  FUERA_DE_HORARIO: "La cita debe estar entre las 7:30 a.m. y las 5:00 p.m.",
  ESTADO_INVALIDO: "La acción no es válida en el estado actual.",
  STOCK_INSUFICIENTE: "Stock insuficiente.",
  DUPLICADO: "Ya existe un registro con esos datos.",
  FUERA_DE_VENTANA: "Esta acción solo se puede realizar el mismo día del registro.",
  REQUIERE_CONFIRMACION: "Confirma la acción para continuar.",
  CREDENCIALES_INVALIDAS: "Cédula o contraseña incorrectas.",
  ERROR_GOOGLE: "No fue posible comunicarse con Google.",
  ERROR_INTERNO: "Ocurrió un error inesperado. Intenta de nuevo.",
};

/** Error de negocio esperado; las acciones lo convierten en `Resultado` sin exponer detalles. */
export class ErrorDominio extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje?: string,
    readonly data?: unknown,
    readonly campos?: Record<string, string[]>,
  ) {
    super(mensaje ?? MENSAJES[codigo]);
    this.name = "ErrorDominio";
  }
}

export function ok<T>(data: T): Resultado<T> {
  return { ok: true, data };
}

export function fallo(
  codigo: CodigoError,
  mensaje?: string,
  extra?: { campos?: Record<string, string[]>; data?: unknown },
): Fallo {
  return { ok: false, error: codigo, mensaje: mensaje ?? MENSAJES[codigo], ...extra };
}

/** Reúne todo el texto de un error y sus causas, para detectar SQLSTATE y nombres de restricciones. */
function textoDeError(e: unknown, profundidad = 0): string {
  if (!e || profundidad > 4) return "";
  if (typeof e === "string") return e;
  if (typeof e !== "object") return String(e);
  const obj = e as Record<string, unknown>;
  const partes = [obj.message, obj.code, obj.originalCode, obj.constraint, obj.kind]
    .filter((v) => typeof v === "string")
    .join(" ");
  let meta = "";
  try {
    meta = obj.meta ? JSON.stringify(obj.meta) : "";
  } catch {
    meta = "";
  }
  return `${partes} ${meta} ${textoDeError(obj.cause, profundidad + 1)}`;
}

const RESTRICCIONES: [string, CodigoError][] = [
  ["cita_sin_choque_consultorio", "CONFLICTO_CONSULTORIO"],
  ["cita_sin_choque_profesional", "CONFLICTO_PROFESIONAL"],
  ["cita_sin_choque_paciente", "CONFLICTO_PACIENTE"],
  ["cita_en_horario", "FUERA_DE_HORARIO"],
  ["cita_duracion_valida", "FUERA_DE_HORARIO"],
  ["insumo_stock_no_negativo", "STOCK_INSUFICIENTE"],
  ["fuera_de_ventana", "FUERA_DE_VENTANA"],
  ["marcacion_orden", "ESTADO_INVALIDO"],
];

/**
 * Traduce errores de la BD a un `ErrorDominio` conocido, o devuelve `null`.
 * Se basa en el nombre de la restricción violada (único en el esquema) y en el
 * código P2002 de Prisma para unicidad.
 */
export function traducirErrorBD(e: unknown): ErrorDominio | null {
  if (e instanceof ErrorDominio) return e;
  const texto = textoDeError(e);
  for (const [nombre, codigo] of RESTRICCIONES) {
    if (texto.includes(nombre)) return new ErrorDominio(codigo);
  }
  if (/\bP2002\b|UniqueConstraintViolation|23505/.test(texto)) return new ErrorDominio("DUPLICADO");
  if (/\bP2025\b/.test(texto)) return new ErrorDominio("NO_ENCONTRADO");
  return null;
}

/** Convierte cualquier error en un `Fallo` seguro para enviar al navegador. */
export function aFallo(e: unknown): Fallo {
  if (e instanceof z.ZodError) {
    const campos: Record<string, string[]> = {};
    for (const issue of e.issues) {
      const clave = issue.path.join(".") || "_";
      (campos[clave] ??= []).push(issue.message);
    }
    const primero = e.issues[0]?.message;
    return fallo("VALIDACION", primero ?? undefined, { campos });
  }
  const dominio = traducirErrorBD(e);
  if (dominio) {
    return fallo(dominio.codigo, dominio.message, { campos: dominio.campos, data: dominio.data });
  }
  return fallo("ERROR_INTERNO");
}
