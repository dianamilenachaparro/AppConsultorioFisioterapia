import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Tx } from "@/server/db";

const CAMPOS_PROHIBIDOS = new Set(["passwordHash", "password_hash", "tokenHash", "token_hash", "refreshTokenCifrado"]);

type Valores = Record<string, unknown>;

function serializable(valor: unknown): unknown {
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "bigint") return valor.toString();
  return valor;
}

function limpiar(valores?: Valores | null): Valores | undefined {
  if (!valores) return undefined;
  const salida: Valores = {};
  for (const [k, v] of Object.entries(valores)) {
    if (CAMPOS_PROHIBIDOS.has(k) || v === undefined) continue;
    salida[k] = serializable(v);
  }
  return salida;
}

/** Deja en `antes`/`despues` solo los campos que cambiaron. */
function diferencias(antes?: Valores, despues?: Valores) {
  if (!antes || !despues) return { antes, despues };
  const a: Valores = {};
  const d: Valores = {};
  for (const clave of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    if (JSON.stringify(antes[clave]) !== JSON.stringify(despues[clave])) {
      if (clave in antes) a[clave] = antes[clave];
      if (clave in despues) d[clave] = despues[clave];
    }
  }
  return { antes: a, despues: d };
}

export type EntradaAuditoria = {
  usuarioId: string;
  accion: string;
  entidad: string;
  entidadId: string;
  antes?: Valores | null;
  despues?: Valores | null;
  motivo?: string | null;
};

/** Inserta un registro en `registro_auditoria` dentro de la transacción de la acción auditada. */
export async function auditar(tx: Tx, entrada: EntradaAuditoria) {
  const { antes, despues } = diferencias(limpiar(entrada.antes), limpiar(entrada.despues));
  await tx.registroAuditoria.create({
    data: {
      usuarioId: entrada.usuarioId,
      accion: entrada.accion,
      entidad: entrada.entidad,
      entidadId: entrada.entidadId,
      antes: antes as Prisma.InputJsonValue | undefined,
      despues: despues as Prisma.InputJsonValue | undefined,
      motivo: entrada.motivo ?? null,
    },
  });
}
