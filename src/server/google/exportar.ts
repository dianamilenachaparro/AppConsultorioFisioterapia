import "server-only";
import { registrarError } from "@/lib/log";
import { ErrorDominio } from "@/lib/resultado";
import { fechaBogota, horaBogota } from "@/lib/tiempo";
import { filtroFinanzasSchema, NOMBRE_SUBTIPO, type FiltroFinanzas } from "@/lib/validacion/finanzas";
import { NOMBRE_MEDIO_PAGO } from "@/lib/validacion/inventario";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { consultarFinanzas, type FilaFinanzas } from "@/server/finanzas/consulta";
import { descifrar } from "./cifrado";
import { clienteSheetsGoogle, type Celda, type ClienteSheets, type FabricaClienteSheets } from "./sheets";

export const ENCABEZADOS = [
  "Fecha",
  "Tipo",
  "Subtipo / Categoría",
  "Descripción",
  "Medio de pago",
  "Valor (COP)",
  "Paciente / Insumo",
  "Registrado por",
  "ID",
] as const;

/**
 * Con USER_ENTERED, un texto que empieza por = + - @ se interpretaría como fórmula
 * (inyección de fórmulas en hojas de cálculo). Se fuerza como texto literal.
 */
export function textoSeguro(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function filaHoja(f: FilaFinanzas): Celda[] {
  return [
    f.fecha,
    f.tipo === "INGRESO" ? "Ingreso" : "Egreso",
    textoSeguro(f.subtipoOCategoria),
    textoSeguro(f.anulado ? `${f.descripcion} (ANULADO)` : f.descripcion),
    NOMBRE_MEDIO_PAGO[f.medioPago],
    f.tipo === "EGRESO" ? -f.valor : f.valor,
    textoSeguro(f.pacienteOInsumo ?? ""),
    textoSeguro(f.registradoPor),
    f.id,
  ];
}

async function describirFiltros(filtro: FiltroFinanzas) {
  const f = filtroFinanzasSchema.parse(filtro);
  const partes = [`${f.desde} a ${f.hasta}`];
  if (f.tipo) partes.push(`Tipo: ${f.tipo === "INGRESO" ? "Ingresos" : "Egresos"}`);
  if (f.subtipoIngreso) partes.push(`Subtipo: ${NOMBRE_SUBTIPO[f.subtipoIngreso]}`);
  if (f.categoriaId) {
    const c = await prisma.categoriaEgreso.findUnique({ where: { id: f.categoriaId }, select: { nombre: true } });
    partes.push(`Categoría: ${c?.nombre ?? "—"}`);
  }
  if (f.medioPago) partes.push(`Medio de pago: ${NOMBRE_MEDIO_PAGO[f.medioPago]}`);
  partes.push(f.incluirAnulados ? "Incluye anulados" : "Sin anulados");
  return { texto: partes.join(" · "), f };
}

function codigoHttp(e: unknown) {
  const x = e as { code?: unknown; status?: unknown; response?: { status?: unknown } };
  return [x.response?.status, x.status, x.code].find((v): v is number => typeof v === "number");
}

function esInvalidGrant(e: unknown) {
  const x = e as { message?: string; response?: { data?: { error?: string } } };
  return x.response?.data?.error === "invalid_grant" || /invalid_grant/.test(x.message ?? "");
}

function esTransitorio(e: unknown) {
  const status = codigoHttp(e);
  const red = (e as { code?: unknown }).code;
  return (status !== undefined && (status >= 500 || status === 429)) || ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN"].includes(String(red));
}

/** Ejecuta una llamada a Google reintentando una vez, con espera, ante errores de red, cuota o 5xx. */
async function conReintento<T>(fn: () => Promise<T>, esperaMs: number): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (!esTransitorio(e)) throw e;
    await new Promise((r) => setTimeout(r, esperaMs));
    return fn();
  }
}

/**
 * Exporta el historial filtrado a una hoja nueva en el Drive del Dueño (FR-040). Las filas y
 * los totales salen de `consultarFinanzas`, la misma función de la pantalla (SC-008); los
 * totales se escriben como números, no como fórmulas. Un fallo de Google no toca datos locales.
 */
export async function exportarFinanzasAGoogle(
  sesion: Sesion,
  filtro: FiltroFinanzas,
  crearCliente: FabricaClienteSheets = clienteSheetsGoogle,
  opciones: { esperaReintentoMs?: number; ahora?: Date } = {},
) {
  exigirPermiso(sesion, "finanzas:exportar");
  const { texto, f } = await describirFiltros(filtro);
  const conexion = await prisma.conexionGoogle.findUnique({ where: { usuarioId: sesion.usuarioId } });
  if (!conexion) throw new ErrorDominio("ERROR_GOOGLE", "Conecta tu cuenta de Google para exportar");

  const { filas, totales } = await consultarFinanzas(sesion, f);
  const n = 3 + filas.length;
  const valores: Celda[][] = [
    [`Filtros: ${texto}`],
    [],
    [...ENCABEZADOS],
    ...filas.map(filaHoja),
    [],
    ["Total ingresos", totales.ingresos],
    ["Total egresos", totales.egresos],
    ["Balance", totales.balance],
  ];
  const ahora = opciones.ahora ?? new Date();
  const titulo = `Finanzas Consultorio ${f.desde} a ${f.hasta} – exportado ${fechaBogota(ahora)} ${horaBogota(ahora)}`;
  const espera = opciones.esperaReintentoMs ?? 1500;

  let cliente: ClienteSheets;
  let hoja: { id: string; url: string };
  try {
    cliente = crearCliente(descifrar(conexion.refreshTokenCifrado));
    hoja = await conReintento(() => cliente.crearHoja(titulo), espera);
    await conReintento(() => cliente.escribirValores(hoja.id, [{ rango: `A1:I${n + 4}`, valores }]), espera);
  } catch (e) {
    if (esInvalidGrant(e)) {
      await prisma.conexionGoogle.deleteMany({ where: { usuarioId: sesion.usuarioId } });
      throw new ErrorDominio("ERROR_GOOGLE", "La conexión con Google expiró; vuelve a conectarla");
    }
    registrarError("exportar-google", e);
    throw new ErrorDominio("ERROR_GOOGLE", "No fue posible exportar a Google Sheets. Intenta de nuevo en unos minutos.");
  }

  await prisma.$transaction(async (tx) => {
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "FINANZAS_EXPORTAR",
      entidad: "finanzas",
      entidadId: hoja.id,
      despues: { filtros: f, filas: filas.length },
    });
  });
  return { urlHoja: hoja.url };
}
