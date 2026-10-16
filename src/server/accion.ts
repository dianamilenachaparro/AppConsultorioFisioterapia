import "server-only";
import { unstable_rethrow } from "next/navigation";
import { registrarError } from "@/lib/log";
import { aFallo, ok, type Resultado } from "@/lib/resultado";

/**
 * Envuelve el cuerpo de una Server Action: devuelve siempre un `Resultado<T>`,
 * deja pasar `redirect()`/`notFound()` de Next.js y no filtra detalles internos.
 */
export async function accion<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    unstable_rethrow(e);
    const resultado = aFallo(e);
    if (resultado.error === "ERROR_INTERNO") registrarError("accion", e);
    return resultado;
  }
}
